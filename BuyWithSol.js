import axios from 'axios'; 
import solanaweb3, { Connection, PublicKey, Transaction, Keypair } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
} from "@solana/spl-token";
import bs58 from "bs58";
import moment from "moment";
import dotenv from 'dotenv';
dotenv.config({ path: './keys.env' }); 

// --- Connection Setup ---
const connection = new Connection("https://api.devnet.solana.com");

// --- Sale Periods ---
const salePeriods = [
  { start: "2024-12-29", end: "2025-01-02", price: 0.00105, availableTokens: 70000000 },
  { start: "2025-01-03", end: "2025-01-20", price: 0.001125, availableTokens: 80000000 },
  { start: "2025-01-21", end: "2025-01-30", price: 0.0012, availableTokens: 100000000 },
  { start: "2025-01-31", end: "2025-02-09", price: 0.001275, availableTokens: 100000000 },
  { start: "2025-02-10", end: "2025-02-19", price: 0.00135, availableTokens: 90000000 },
  { start: "2025-02-20", end: "2025-02-29", price: 0.001425, availableTokens: 60000000 },
];

// --- Global Addresses/Keys ---
const USDTaddress = process.env.USDT_ADDRESS;
const fundsReceiverAddress = process.env.FUNDS_RECEIVER_ADDRESS;
const ICOHolderAddress = process.env.ICO_HOLDER_ADDRESS;
const ICOToken = process.env.ICO_TOKEN;
const ICOTokenPrivateKey = process.env.ICO_TOKEN_PRIVATE_KEY;
const buyerPrivateKey = process.env.BUYER_PRIVATE_KEY;

// --- Helper Functions ---
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getCurrentSalePeriod = () => {
  const currentDate = moment().startOf("day");
  for (let i = 0; i < salePeriods.length; i++) {
    const saleStart = moment(salePeriods[i].start);
    const saleEnd = moment(salePeriods[i].end);
    if (currentDate.isBetween(saleStart, saleEnd, null, "[]")) {
      return {
        sale: i + 1,
        price: salePeriods[i].price,
        availableTokens: salePeriods[i].availableTokens,
      };
    }
  }
  return null;
};

const fetchSolanaPrice = async () => {
  try {
    const url =
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd";
    const response = await axios.get(url);
    return response.data.solana.usd;
  } catch (error) {
    throw new Error("Error fetching Solana price");
  }
};

const getTokenBalance = async (walletAddress, ICOToken, decimals = 9) => {
  try {
    const senderPubKey = new PublicKey(walletAddress);
    const mintAddress = new PublicKey(ICOToken);
    const senderTokenAccount = await getAssociatedTokenAddress(mintAddress, senderPubKey);
    const senderTokenAccountInfo = await connection.getAccountInfo(senderTokenAccount);
    const senderTokenBalance = senderTokenAccountInfo
      ? senderTokenAccountInfo.data.readBigUInt64LE(64)
      : 0n;
    return Number(senderTokenBalance) / 10 ** decimals;
  } catch (error) {
    throw new Error("Error fetching token balance");
  }
};

const getSolBalance = async (walletAddress) => {
  try {
    const walletPubKey = new PublicKey(walletAddress);
    const balance = await connection.getBalance(walletPubKey);
    return balance / 1e9; // from lamports to SOL
  } catch (error) {
    throw new Error("Error fetching SOL balance");
  }
};

// Transfer SOL from one wallet to another
const transferSol = async (ICOTOkenPrivateKey, recipientAddress, amount) => {
    const senderWallet = solanaweb3.Keypair.fromSecretKey(bs58.decode(ICOTOkenPrivateKey));
    const recipientPublicKey = new PublicKey(recipientAddress);

    let transaction = new solanaweb3.Transaction().add(
        solanaweb3.SystemProgram.transfer({
            fromPubkey: senderWallet.publicKey,
            toPubkey: recipientPublicKey,
            lamports: amount * solanaweb3.LAMPORTS_PER_SOL,
        })
    );

    transaction.feePayer = senderWallet.publicKey;

    try {
        let transactionHash = await connection.sendTransaction(transaction, [senderWallet]);
        return transactionHash; // Return the transaction hash if successful
    } catch (error) {
        console.error("SOL transfer failed:", error);
        throw new Error("SOL transfer failed");
    }
};

const transferToken = async (
    ICOTOkenPrivateKey,
  recipientAddress,
  amount,
  ICOToken
) => {
  try {
    const senderWallet = Keypair.fromSecretKey(bs58.decode(ICOTOkenPrivateKey));
    const recipientPublicKey = new PublicKey(recipientAddress);
    const tokenMintPublicKey = new PublicKey(ICOToken);
    const mintAccountInfo = await connection.getParsedAccountInfo(tokenMintPublicKey);
    const decimals = mintAccountInfo.value.data.parsed.info.decimals;
    const amountInSmallestUnit = Math.round(amount * 10 ** decimals);

    const senderTokenAccount = await getAssociatedTokenAddress(
      tokenMintPublicKey,
      senderWallet.publicKey
    );
    const recipientTokenAccount = await getAssociatedTokenAddress(
      tokenMintPublicKey,
      recipientPublicKey,
      true
    );

    const transaction = new Transaction();
    const recipientTokenAccountInfo = await connection.getAccountInfo(recipientTokenAccount);

    // Create a recipient token account if it doesn't exist
    if (!recipientTokenAccountInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          senderWallet.publicKey,
          recipientTokenAccount,
          recipientPublicKey,
          tokenMintPublicKey
        )
      );
    }

    transaction.add(
      createTransferInstruction(
        senderTokenAccount,
        recipientTokenAccount,
        senderWallet.publicKey,
        amountInSmallestUnit
      )
    );

    transaction.feePayer = senderWallet.publicKey;
    return await connection.sendTransaction(transaction, [senderWallet]);
  } catch (error) {
    throw new Error("Token transfer failed");
  }
};

const confirmTransaction = async (transactionHash) => {
  try {
    const confirmation = await connection.confirmTransaction(transactionHash);
    if (confirmation.value.err) {
      throw new Error("Transaction failed");
    }
  } catch {
    throw new Error("Error confirming transaction");
  }
};

// --- Helper to calculate leftover tokens and check availability ---
const calculatePhaseBalance = (currentSale) => {
  // phaseminimumBalance is how many tokens remain after subtracting the phase’s available tokens
  // from a hypothetical total pool. Adjust the "basePool" numbers per phase as needed.
  switch (currentSale.sale) {
    case 1:
      return 500000000 - currentSale.availableTokens;
    case 2:
      return 430000000 - currentSale.availableTokens;
    case 3:
      return 350000000 - currentSale.availableTokens;
    case 4:
      return 250000000 - currentSale.availableTokens;
    case 5:
      return 150000000 - currentSale.availableTokens;
    case 6:
      return 60000000 - currentSale.availableTokens;
    default:
      throw new Error("Sale period not defined.");
  }
};

// --- Core Logic for Buying Tokens ---
const buyWithSol = async (tokenBuyerAddress, amountOfTokenToBuy) => {
  let transactionSuccess = false;
  try {
    const currentSale = getCurrentSalePeriod();
    if (!currentSale) throw new Error("No active sale at the moment.");

    await sleep(5000);

    const tokenHolderBalance = await getTokenBalance(ICOHolderAddress, ICOToken);
    const remainingBalance = tokenHolderBalance - amountOfTokenToBuy;
    const phaseminimumBalance = calculatePhaseBalance(currentSale);
    const tokenInSale = remainingBalance - phaseminimumBalance;

    if (phaseminimumBalance > remainingBalance || tokenInSale < 0) {
      throw new Error("Not enough tokens for the current sale.");
    }

    const tokenPriceUSD = currentSale.price;
    const amountInUSDT = amountOfTokenToBuy * tokenPriceUSD;
    const solPrice = await fetchSolanaPrice();
    const amountInSOL = amountInUSDT / solPrice;
    const buyerSolBalance = await getSolBalance(tokenBuyerAddress);

    if (buyerSolBalance < amountInSOL) {
      throw new Error("Buyer does not have enough SOL");
    }
 
    // 1) Transfer SOL from buyer -> fundsReceiver
    const solTransferHash = await transferSol(
      buyerPrivateKey,
      fundsReceiverAddress,
      amountInSOL.toFixed(8)
    );
    await confirmTransaction(solTransferHash);
 
    // 2) Transfer token from tokenHolder -> buyer
    const tokenTransferHash = await transferToken(
        ICOTokenPrivateKey,
      tokenBuyerAddress,
      amountOfTokenToBuy,
      ICOToken
    );
    await confirmTransaction(tokenTransferHash);

    transactionSuccess = true;
    console.log(
      `Transaction successful. ${amountOfTokenToBuy} tokens sent, ~${amountInSOL.toFixed(
        8
      )} SOL received.`
    );
    console.log(`SOL transfer: ${solTransferHash}`);
    console.log(`Token transfer: ${tokenTransferHash}`);
  } catch (error) {
    console.error(`Error during SOL purchase transaction: ${error.message}`);
    if (transactionSuccess) {
      // If partial rollback needed, handle here
    }
  }
};

const buyWithUSDT = async (tokenBuyerAddress, amountOfTokenToBuy) => {
      
  let transactionSuccess = false;
  try {
    const currentSale = getCurrentSalePeriod();
    if (!currentSale) throw new Error("No active sale at the moment.");

    await sleep(8000);

    const tokenHolderBalance = await getTokenBalance(ICOHolderAddress, ICOToken);
    const remainingBalance = tokenHolderBalance - amountOfTokenToBuy;
    const phaseminimumBalance = calculatePhaseBalance(currentSale);
    const tokenInSale = remainingBalance - phaseminimumBalance;

    if (phaseminimumBalance > remainingBalance || tokenInSale < 0) {
      throw new Error("Not enough tokens for the current sale.");
    }

    const tokenPriceUSD = currentSale.price;
    const amountInUSDT = amountOfTokenToBuy * tokenPriceUSD;
    const buyerUSDTBalance = await getTokenBalance(tokenBuyerAddress, USDTaddress, 6);

    if (buyerUSDTBalance < amountInUSDT) {
      throw new Error("Buyer does not have enough USDT");
    }
    // 1) Transfer USDT from buyer -> fundsReceiver
    const usdtTransferHash = await transferToken(
      buyerPrivateKey,
      fundsReceiverAddress,
      amountInUSDT,
      USDTaddress
    );
    await confirmTransaction(usdtTransferHash);
 
    // 2) Transfer token from tokenHolder -> buyer
    const tokenTransferHash = await transferToken(
        ICOTokenPrivateKey,
      tokenBuyerAddress,
      amountOfTokenToBuy,
      ICOToken
    );
    await confirmTransaction(tokenTransferHash);

    transactionSuccess = true;
    console.log(`Transaction successful. ${amountOfTokenToBuy} tokens sent, ~${amountInUSDT.toFixed(2)} USDT received.`);
    console.log(`USDT transfer: ${usdtTransferHash}`);
    console.log(`Token transfer: ${tokenTransferHash}`);
  } catch (error) {
    console.error(`Error during USDT purchase transaction: ${error.message}`);
    if (transactionSuccess) {
      // If partial rollback needed, handle here
    }
  }
};

const amountOfTokenToBuy = 10000;
const tokenBuyerAddress = "4zAoNKa2pHnSwhYN5XEgK4K7RvhGaQvM3a8LwqtXShVE";

// Uncomment whichever purchase flow you want to test
buyWithUSDT(tokenBuyerAddress, amountOfTokenToBuy);
// buyWithSol(tokenBuyerAddress, amountOfTokenToBuy);
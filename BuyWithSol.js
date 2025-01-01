import axios from 'axios';
import solanaweb3 from "@solana/web3.js";
import { Connection, PublicKey, Transaction, Keypair } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccount, createTransferInstruction } from '@solana/spl-token';
import bs58 from 'bs58';
import moment from 'moment'; // For handling dates more easily

// Set up the Solana connection to Devnet
const connection = new Connection('https://api.devnet.solana.com');

// Define sale periods
const salePeriods = [
    { start: '2024-12-29', end: '2024-12-30', price: 0.00105, availableTokens: 700 }, // Sale 1
    { start: '2024-12-31', end: '2024-12-31', price: 0.001125, availableTokens: 800 }, // Sale 2
    { start: '2025-01-01', end: '2025-01-30', price: 0.0012, availableTokens: 1000 }, // Sale 3
    { start: '2025-01-31', end: '2025-02-09', price: 0.001275, availableTokens: 1000 },  // Sale 4
    { start: '2025-02-10', end: '2025-02-19', price: 0.00135, availableTokens: 900 }, // Sale 5
    { start: '2025-02-20', end: '2025-02-29', price: 0.001425, availableTokens: 600 }, // Sale 6
];

// Function to get the current sale period and token price
const getCurrentSalePeriod = () => {
    const currentDate = moment().startOf('day'); // Use the current date with time set to 00:00:00
    
    for (let i = 0; i < salePeriods.length; i++) {
        const saleStart = moment(salePeriods[i].start);
        const saleEnd = moment(salePeriods[i].end);
        
        // Check if the current date is within the sale period
        if (currentDate.isBetween(saleStart, saleEnd, null, '[]')) {
            return { 
                sale: i + 1, 
                price: salePeriods[i].price, 
                availableTokens: salePeriods[i].availableTokens, 
                start: saleStart.format('YYYY-MM-DD'), 
                end: saleEnd.format('YYYY-MM-DD') 
            };
        }
    }
    
    // Return null if no sale is active
    return null;
};

// Fetch Solana price from CoinGecko
const fetchSolanaPrice = async () => {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        return response.data.solana.usd;
    } catch (error) {
        console.error('Error fetching Solana price:', error);
        throw error;
    }
};

// Get token balance from a wallet
const getTokenBalance = async (walletAddress, tokenMintAddress) => {
    const senderPubKey = new PublicKey(walletAddress);
    const mintAddress = new PublicKey(tokenMintAddress);

    try {
        const senderTokenAccount = await getAssociatedTokenAddress(mintAddress, senderPubKey);
        const senderTokenAccountInfo = await connection.getAccountInfo(senderTokenAccount);
        const senderTokenBalance = senderTokenAccountInfo
            ? senderTokenAccountInfo.data.readBigUInt64LE(64)
            : 0n;
        const decimals = 9; // Update based on token's decimal places
        return (Number(senderTokenBalance) / 10 ** decimals).toFixed(4);
    } catch (error) {
        console.error('Error fetching token balance:', error);
        throw error;
    }
};

// Get SOL balance from a wallet
const getSolBalance = async (walletAddress) => {
    const walletPubKey = new PublicKey(walletAddress);
    try {
        const balance = await connection.getBalance(walletPubKey);
        return balance / 1e9; // Convert from lamports to SOL
    } catch (error) {
        console.error('Error fetching SOL balance:', error);
        throw error;
    }
};

// Transfer SOL from one wallet to another
const transferSol = async (senderPrivateKey, recipientAddress, amount) => {
    const senderWallet = solanaweb3.Keypair.fromSecretKey(bs58.decode(senderPrivateKey));
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

// Transfer custom token from one wallet to another
const transferToken = async (senderPrivateKey, recipientAddress, amount, tokenMintAddress) => {
    const senderWallet = Keypair.fromSecretKey(bs58.decode(senderPrivateKey));
    const recipientPublicKey = new PublicKey(recipientAddress);
    const tokenMintPublicKey = new PublicKey(tokenMintAddress);

    const senderTokenAccount = await getAssociatedTokenAddress(tokenMintPublicKey, senderWallet.publicKey);
    const recipientTokenAccount = await getAssociatedTokenAddress(tokenMintPublicKey, recipientPublicKey);

    const senderTokenAccountInfo = await connection.getAccountInfo(senderTokenAccount);
    if (!senderTokenAccountInfo) {
        console.log("Sender's token account does not exist, creating it...");
        const createSenderTokenAccountTx = new Transaction().add(
            createAssociatedTokenAccount(senderWallet.publicKey, senderWallet.publicKey, tokenMintPublicKey)
        );
        await connection.sendTransaction(createSenderTokenAccountTx, [senderWallet]);
    }

    const recipientTokenAccountInfo = await connection.getAccountInfo(recipientTokenAccount);
    if (!recipientTokenAccountInfo) {
        console.log("Recipient's token account does not exist, creating it...");
        const createRecipientTokenAccountTx = new Transaction().add(
            createAssociatedTokenAccount(senderWallet.publicKey, recipientPublicKey, tokenMintPublicKey)
        );
        await connection.sendTransaction(createRecipientTokenAccountTx, [senderWallet]);
    }

    const transaction = new Transaction().add(
        createTransferInstruction(
            senderTokenAccount,
            recipientTokenAccount,
            senderWallet.publicKey,
            amount * 1e9
        )
    );
    transaction.feePayer = senderWallet.publicKey;

    try {
        const transactionHash = await connection.sendTransaction(transaction, [senderWallet]);
        return transactionHash; // Return the transaction hash if successful
    } catch (error) {
        console.error('Token transfer failed:', error);
        throw new Error("Token transfer failed");
    }
};

// Wait for transaction confirmation
const confirmTransaction = async (transactionHash) => {
    try {
        const confirmation = await connection.confirmTransaction(transactionHash);
        if (confirmation.value.err) {
            throw new Error("Transaction failed");
        }
        console.log("Transaction confirmed!");
    } catch (error) {
        console.error("Error confirming transaction:", error);
    }
};

// Sleep function to delay balance check
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  

// Major function to buy tokens with SOL
const buyWithSol = async (tokenHolderAddress, tokenBuyerAddress, amountOfTokenToBuy, tokenMintAddress) => {
    const senderPrivateKey = '5eqVQ4tUcK3ZmQ2d7PwxXExPLKG2mLdxYUqoYHec8mryoFvaaJiHQmAn5Sy6JfsApNUKGLc9mUYroBWkpZaB7Cp3';  // Replace with actual private key
    const buyerPrivateKey = 'FvYGxo5NtopzP5YgW83qNYF6ioLakFG7oGNQn7hEVBNzjCtUhW3fTEHjisSBQxwSJ7QoWyFNTzrba1BKGUjybuD';    // Replace with actual private key
    const fundsReceiverAddress = 'Exgg7y6KYDMsEWgJEpp9rRenVwZ9VRTPTdXUxFCtAGkW'; // Replace with actual address

    let transactionSuccess = false; // Flag to ensure both transfers succeed
    let phaseminimumBalance = 0;
    let tokenInSale = 0;

    try {
        // Fetch the current sale period and price
        const currentSale = getCurrentSalePeriod();
        if (!currentSale) {
            throw new Error('No active sale at the moment.');
        }
        await sleep(5000);  // Wait for 2 seconds before fetching the updated balance
        // Fetch the token balance of the token holder
        const tokenHolderBalance = await getTokenBalance(tokenHolderAddress, tokenMintAddress);
        console.log(`Wallet Balance: ${tokenHolderBalance} tokens`);

        // Calculate remaining balance after the purchase
        const remainingBalance = tokenHolderBalance - amountOfTokenToBuy;
        console.log(`Remaining Balance after transfer: ${remainingBalance} tokens`);

        // Calculate the minimum balance left for the phase after subtracting available tokens for the current sale
        if (currentSale.sale === 1) { // 700
            phaseminimumBalance = 5000 - currentSale.availableTokens;
            console.log(`Phase tokens Balance: ${phaseminimumBalance} tokens`);
        } else if (currentSale.sale === 2) { // 800
            phaseminimumBalance = 4300 - currentSale.availableTokens;
            console.log(`Phase tokens Balance: ${phaseminimumBalance} tokens`);
        } else if (currentSale.sale === 3) { // 1000
            phaseminimumBalance = 3500 - currentSale.availableTokens;
            console.log(`Phase tokens Balance: ${phaseminimumBalance} tokens`);
        } else if (currentSale.sale === 4) { // 1000
            phaseminimumBalance = 2500 - currentSale.availableTokens;
            console.log(`Phase tokens Balance: ${phaseminimumBalance} tokens`);
        } else if (currentSale.sale === 5) { // 900
            phaseminimumBalance = 1500 - currentSale.availableTokens;
            console.log(`Phase tokens Balance: ${phaseminimumBalance} tokens`);
        } else if (currentSale.sale === 6) { // 600
            phaseminimumBalance = 600 - currentSale.availableTokens;
            console.log(`Phase tokens Balance: ${phaseminimumBalance} tokens`);
        } else {
            throw new Error('Sale period not defined.');
        }

        tokenInSale = remainingBalance - phaseminimumBalance;
        console.log(`Tokens in sale: ${tokenInSale} tokens`);

        if (phaseminimumBalance > remainingBalance || tokenInSale < 0) {
            throw new Error('Not enough tokens for the current sale.');
        }

        console.log(`Token holder has enough tokens: ${remainingBalance} tokens`);
        console.log(`Remaining tokens in this sale: ${remainingBalance - phaseminimumBalance} tokens`);

        // The price for the token in the current sale
        const tokenPriceUSD = currentSale.price;
        console.log(`Current Sale ${currentSale.sale} is active. Token Price: ${tokenPriceUSD} USD`);

        const amountInUSDT = amountOfTokenToBuy * tokenPriceUSD;
        console.log(`Amount in USDT: ${amountInUSDT}`);

        const solPrice = await fetchSolanaPrice();
        console.log(`Solana price: $${solPrice} USD`);

        const amountInSOL = amountInUSDT / solPrice;
        console.log(`Amount in SOL required: ${amountInSOL.toFixed(8)} SOL`);

        // Fetch buyer's SOL balance
        const buyerSolBalance = await getSolBalance(tokenBuyerAddress);
        if (buyerSolBalance < amountInSOL) {
            throw new Error('Buyer does not have enough SOL');
        }
        console.log(`Buyer has enough SOL: ${buyerSolBalance} SOL`);

        // Begin atomic transaction: Try both transfers together
        const solTransferHash = await transferSol(buyerPrivateKey, fundsReceiverAddress, amountInSOL.toFixed(8));
        await confirmTransaction(solTransferHash); // Wait for the SOL transfer to be confirmed

        const tokenTransferHash = await transferToken(senderPrivateKey, tokenBuyerAddress, amountOfTokenToBuy, tokenMintAddress);
        await confirmTransaction(tokenTransferHash); // Wait for the token transfer to be confirmed
        console.log(`Transaction successful. ${amountOfTokenToBuy} tokens sent to buyer and ${amountInSOL.toFixed(8)} SOL received`);
        console.log(`Sol transaction Hash: ${solTransferHash}`);
        console.log(`Token transaction Hash: ${tokenTransferHash}`);
        transactionSuccess = true;

    } catch (error) {
        console.error(`Error during transaction: ${error.message}`);
        if (transactionSuccess) {
            // Handle partial rollback if needed (e.g., reverse token or SOL transfers)
        }
    }
};


const tokenHolderAddress = 'Agb7ne7s4hMoRjQX82ME7q5XhjMW5bfkCn5HShkTsnk3';
const tokenBuyerAddress = 'A8Q6ubg2yWpGEt3ppAv79K3ifvznis4McGZuT7QgDerX';
const amountOfTokenToBuy = 100;
const tokenMintAddress = 'AfAqPBBiQErFXXeUAwkoZWDaEAyshZCMndXd55gM2aX';
buyWithSol(tokenHolderAddress, tokenBuyerAddress, amountOfTokenToBuy,tokenMintAddress);
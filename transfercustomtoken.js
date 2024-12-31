


// this code works fine it transfer ico token from 1 wallet to another wallet 

import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import bs58 from "bs58";
import { 
    getAssociatedTokenAddress, 
    createAssociatedTokenAccount, 
    createTransferInstruction, 
    TOKEN_PROGRAM_ID 
} from "@solana/spl-token";

// Create a connection to the Solana devnet
const connection = new Connection("https://api.devnet.solana.com");

// Function to send SPL token from sender to recipient
async function sendSPLToken(senderPrivateKey, recipientAddress, amount, tokenMintAddress) {
    // Decode sender's private key to create the Keypair
    const senderWallet = Keypair.fromSecretKey(bs58.decode(senderPrivateKey));

    // Convert recipient's address (string) into a PublicKey
    const recipientPublicKey = new PublicKey(recipientAddress);

    // Convert the token mint address to PublicKey
    const tokenMintPublicKey = new PublicKey(tokenMintAddress);

    // Get sender's associated token account for the custom token
    const senderTokenAccount = await getAssociatedTokenAddress(tokenMintPublicKey, senderWallet.publicKey);

    // Get recipient's associated token account for the custom token
    const recipientTokenAccount = await getAssociatedTokenAddress(tokenMintPublicKey, recipientPublicKey);

    // Check if sender's token account exists, if not, create it
    const senderTokenAccountInfo = await connection.getAccountInfo(senderTokenAccount);
    if (!senderTokenAccountInfo) {
        console.log("Sender's token account does not exist, creating it...");
        const createSenderTokenAccountTx = new Transaction().add(
            createAssociatedTokenAccount(
                senderWallet.publicKey, // payer (sender)
                senderWallet.publicKey, // owner
                tokenMintPublicKey // mint
            )
        );
        await connection.sendTransaction(createSenderTokenAccountTx, [senderWallet]);
    }

    // Check if recipient's token account exists, if not, create it
    const recipientTokenAccountInfo = await connection.getAccountInfo(recipientTokenAccount);
    if (!recipientTokenAccountInfo) {
        console.log("Recipient's token account does not exist, creating it...");
        const createRecipientTokenAccountTx = new Transaction().add(
            createAssociatedTokenAccount(
                senderWallet.publicKey, // payer (sender)
                recipientPublicKey, // owner
                tokenMintPublicKey // mint
            )
        );
        await connection.sendTransaction(createRecipientTokenAccountTx, [senderWallet]);
    }

    // Create a transaction to transfer SPL token
    let transaction = new Transaction().add(
        createTransferInstruction(
            senderTokenAccount, // Sender's token account address
            recipientTokenAccount, // Recipient's token account address
            senderWallet.publicKey, // Sender's public key (signer)
            amount * (10 ** 9) // Amount to transfer, assuming 6 decimals for the token
        )
    );

    // Set the fee payer as the sender's public key
    transaction.feePayer = senderWallet.publicKey;

    // Send the transaction
    try {
        let transactionHash = await connection.sendTransaction(transaction, [senderWallet]);
        console.log(`Transaction Hash: ${transactionHash}`);
    } catch (error) {
        console.error("Transaction failed:", error);
    }
}

// Example usage
const senderPrivateKey = "5eqVQ4tUcK3ZmQ2d7PwxXExPLKG2mLdxYUqoYHec8mryoFvaaJiHQmAn5Sy6JfsApNUKGLc9mUYroBWkpZaB7Cp3";  // Replace with actual private key
const recipientAddress = "A8Q6ubg2yWpGEt3ppAv79K3ifvznis4McGZuT7QgDerX";  // Replace with actual recipient address
const amountToTransfer = 50; // Amount to transfer
const tokenMintAddress = "AfAqPBBiQErFXXeUAwkoZWDaEAyshZCMndXd55gM2aX"; // Replace with the mint address of your SPL token

sendSPLToken(senderPrivateKey, recipientAddress, amountToTransfer, tokenMintAddress);

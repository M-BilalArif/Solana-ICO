// code working fine transfer sol from 1 wallet to another wallet 

import solanaweb3, { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

// Create a connection to the Solana devnet
const connection = new solanaweb3.Connection("https://api.devnet.solana.com");

// Function to send SOL from sender to recipient
async function sendSol(senderPrivateKey, recipientAddress, amount) {
    // Decode sender's private key to create the Keypair
    const senderWallet = solanaweb3.Keypair.fromSecretKey(bs58.decode(senderPrivateKey));

    // Convert recipient's address (string) into a PublicKey
    const recipientPublicKey = new PublicKey(recipientAddress);

    // Create a transaction to transfer SOL
    let transaction = new solanaweb3.Transaction().add(
        solanaweb3.SystemProgram.transfer({
            fromPubkey: senderWallet.publicKey,
            toPubkey: recipientPublicKey,
            lamports: amount * solanaweb3.LAMPORTS_PER_SOL, // Convert amount to lamports
        })
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
const recipientAddress = "Agb7ne7s4hMoRjQX82ME7q5XhjMW5bfkCn5HShkTsnk3";  // Replace with actual recipient address
const amountToTransfer = 1; // Amount to transfer (in SOL)

sendSol(senderPrivateKey, recipientAddress, amountToTransfer);

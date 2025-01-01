import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import bs58 from "bs58";
import {
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    createTransferInstruction,
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
    const recipientTokenAccount = await getAssociatedTokenAddress(
        tokenMintPublicKey,
        recipientPublicKey,
        true // Allow owner off-curve
    );

    const transaction = new Transaction();

    // Check if recipient's token account exists; if not, create it
    const recipientTokenAccountInfo = await connection.getAccountInfo(recipientTokenAccount);
    if (!recipientTokenAccountInfo) {
        console.log("Recipient's token account does not exist, creating it...");
        transaction.add(
            createAssociatedTokenAccountInstruction(
                senderWallet.publicKey, // Payer
                recipientTokenAccount,  // New associated token account
                recipientPublicKey,     // Owner of the token account
                tokenMintPublicKey      // Token mint
            )
        );
    }

    // Create a transfer instruction
    transaction.add(
        createTransferInstruction(
            senderTokenAccount,      // Sender's token account
            recipientTokenAccount,   // Recipient's token account
            senderWallet.publicKey,  // Signer (sender)
            amount * 10 ** 9        // Amount to transfer, adjust decimals
        )
    );

    // Set the fee payer as the sender's public key
    transaction.feePayer = senderWallet.publicKey;

    try {
        // Send the transaction
        const transactionHash = await connection.sendTransaction(transaction, [senderWallet]);
        console.log(`Transaction Hash: ${transactionHash}`);
    } catch (error) {
        console.error("Transaction failed:", error);
    }
}

// Example usage
const senderPrivateKey = "5eqVQ4tUcK3ZmQ2d7PwxXExPLKG2mLdxYUqoYHec8mryoFvaaJiHQmAn5Sy6JfsApNUKGLc9mUYroBWkpZaB7Cp3"; // Replace with actual private key
const recipientAddress = "AewuvZG6EDUFJ72ujEBSbQRr86nFdPZ2YgsYc4aCJKKy"; // Replace with actual recipient address
const amountToTransfer = 50; // Amount to transfer
const tokenMintAddress = "AfAqPBBiQErFXXeUAwkoZWDaEAyshZCMndXd55gM2aX"; // Replace with the mint address of your SPL token

sendSPLToken(senderPrivateKey, recipientAddress, amountToTransfer, tokenMintAddress);

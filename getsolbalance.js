
//code fine it gets the sol balance from wallet 
import solanaweb3, { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

// Create a connection to the Solana devnet
const connection = new solanaweb3.Connection("https://api.devnet.solana.com");

// Replace these with the actual public keys you want to check
const senderPublicKey = new PublicKey("Agb7ne7s4hMoRjQX82ME7q5XhjMW5bfkCn5HShkTsnk3");
const reciverPublicKey = new PublicKey("A8Q6ubg2yWpGEt3ppAv79K3ifvznis4McGZuT7QgDerX");

(async () => {
    try {
        // Get the balance of the sender and receiver using their public keys
        let senderBalance = await connection.getBalance(senderPublicKey);
        let reciverBalance = await connection.getBalance(reciverPublicKey);

        // Convert the balance from lamports to SOL and log it
        console.log(`Sender's balance: ${senderBalance / solanaweb3.LAMPORTS_PER_SOL} SOL`);
        console.log(`Receiver's balance: ${reciverBalance / solanaweb3.LAMPORTS_PER_SOL} SOL`);
    } catch (error) {
        console.error("Error fetching balance:", error);
    }
})();

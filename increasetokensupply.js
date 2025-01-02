import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';
import bs58 from 'bs58'; // Import default export

// Replace with the base58 encoded private key of the mint authority
const mintAuthorityPrivateKey = '2ZSRCrt9bqYsG3Uu7UEyZCSEnnnFxXLeCaTQtA9v1iKh9BcYaKLVEbdxYBnLtMfNdDN8HSh2s4RMe9DQ9LBe6F3i'; // Replace with your mint authority's private key

// Replace with your token mint address
const existingTokenMintAddress = '6aMEYfWrthqmmW3i72sWbD1ne8jaX8GcbFHL7esH1V8X'; // Replace with your existing token's mint address

(async () => {
  try {
    // Decode the mint authority private key into a Uint8Array
    const decodedPrivateKey = bs58.decode(mintAuthorityPrivateKey);

    // Ensure the private key is 64 bytes long
    if (decodedPrivateKey.length !== 64) {
      throw new Error('Private key size is invalid. It should be 64 bytes.');
    }

    // Create a connection to the Solana devnet or mainnet
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

    // Use the decoded private key to create the mint authority Keypair
    const mintAuthority = Keypair.fromSecretKey(decodedPrivateKey);

    // Convert the token mint address to a PublicKey
    const tokenMint = new PublicKey(existingTokenMintAddress);

    // Ensure the mint authority has enough SOL for fees (Check wallet balance)
    const balance = await connection.getBalance(mintAuthority.publicKey);
    console.log('Mint authority wallet balance:', balance / LAMPORTS_PER_SOL, 'SOL');

    if (balance < 0.01 * LAMPORTS_PER_SOL) {
      console.log('Insufficient SOL in mint authority wallet to pay for transaction fees.');
      return;
    }

    // Get or create the associated token account for the mint authority
    console.log('Getting or creating associated token account...');
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      mintAuthority,      // Payer for transaction fees
      tokenMint,          // Existing token mint address
      mintAuthority.publicKey // Owner of the token account
    );

    console.log('Associated token account:', tokenAccount.address.toBase58());

    // Mint additional tokens to the associated token account
    const additionalTokens = 499985000 * (10 ** 6); // Adjust the amount and decimals as per your token
    console.log(`Minting ${additionalTokens} additional tokens...`);

    await mintTo(
      connection,
      mintAuthority,       // Transaction payer
      tokenMint,           // Token mint address
      tokenAccount.address, // Target token account
      mintAuthority,       // Mint authority
      additionalTokens     // Amount to mint
    );

    console.log('Minting completed.');
    console.log('New token balance in the associated token account:');
    const tokenAccountBalance = await connection.getTokenAccountBalance(tokenAccount.address);
    console.log(tokenAccountBalance.value.amount);
  } catch (error) {
    console.error('Error:', error.message);
  }
})();

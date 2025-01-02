  import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
  import { createMint, getOrCreateAssociatedTokenAccount, mintTo, transfer } from '@solana/spl-token';
  import bs58 from 'bs58'; // Import default export

  // Replace with the base58 encoded private key string
  const externalWalletPrivateKey = '2ZSRCrt9bqYsG3Uu7UEyZCSEnnnFxXLeCaTQtA9v1iKh9BcYaKLVEbdxYBnLtMfNdDN8HSh2s4RMe9DQ9LBe6F3i'; // Example private key in base58 format

  (async () => {
    // Decode the private key string into a Uint8Array
    const decodedPrivateKey = bs58.decode(externalWalletPrivateKey); // Use the default export

    // Ensure the private key is 64 bytes long (Solana private key should be 64 bytes)
    if (decodedPrivateKey.length !== 64) {
      throw new Error('Private key size is invalid. It should be 64 bytes.');
    }

    // Connect to the Solana devnet or mainnet
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

    // Use the decoded private key to create the wallet Keypair
    const externalWallet = Keypair.fromSecretKey(decodedPrivateKey); // Create Keypair from decoded private key

    // Ensure external wallet has enough SOL for fees (Check wallet balance)
    const balance = await connection.getBalance(externalWallet.publicKey);
    console.log('External wallet balance:', balance / LAMPORTS_PER_SOL, 'SOL');

    if (balance < 0.01 * LAMPORTS_PER_SOL) {
      console.log('Insufficient SOL in external wallet to pay for transaction fees.');
      return;
    }

    // Create a new Mint for the token with 6 decimals
    const mintAuthority = externalWallet; // Set the external wallet as the mint authority
    const freezeAuthority = null; // Optional, can be set to `null` if you don't need a freeze authority
    const decimals = 6; // Set custom decimals

    console.log('Creating a new mint...');
    const mint = await createMint(
      connection,           // Solana connection
      externalWallet,       // External wallet as the payer for fees
      mintAuthority.publicKey, // Mint authority
      freezeAuthority,      // Freeze authority (optional)
      decimals              // Number of decimals
    );

    console.log('New token mint created:', mint.toBase58());

    // Create an associated token account for the external wallet
    console.log('Creating associated token account...');
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      externalWallet, // External wallet for paying the fees
      mint,           // Mint address
      externalWallet.publicKey // Owner of the token account
    );

    console.log('Associated token account created:', tokenAccount.address.toBase58());

    // Mint 10,000 tokens to the associated token account
    const amountToMint = 10000 * (10 ** decimals); // 10,000 tokens with 6 decimals
    console.log('Minting', amountToMint, 'tokens...');
    await mintTo(
      connection,
      externalWallet,  // External wallet for the transaction
      mint,            // Mint address
      tokenAccount.address, // Token account to mint tokens to
      mintAuthority,   // Mint authority
      amountToMint     // Amount to mint
    );

    console.log('Minting completed.');
    console.log('New token balance in the associated token account:');
    const tokenAccountBalance = await connection.getTokenAccountBalance(tokenAccount.address);
    console.log(tokenAccountBalance.value.amount);

    // Create an associated token account for the recipient if it doesn't exist
    const recipient = '4zAoNKa2pHnSwhYN5XEgK4K7RvhGaQvM3a8LwqtXShVE'; // Recipient wallet address
    const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      externalWallet,  // External wallet for paying the fees
      mint,            // Mint address
      recipient        // Recipient public key
    );

    console.log('Recipient associated token account created:', recipientTokenAccount.address.toBase58());

    // Transfer 10,000 tokens to the recipient
    console.log('Transferring tokens...');
    await transfer(
      connection,
      externalWallet,  // External wallet for paying the fees
      tokenAccount.address, // Source token account
      recipientTokenAccount.address, // Recipient token account
      externalWallet,  // Owner of the source token account
      amountToMint     // Amount of tokens to transfer
    );

    console.log('Transfer completed.');
    console.log('New token balance in recipient account:');
    const recipientBalance = await connection.getTokenAccountBalance(recipientTokenAccount.address);
    console.log(recipientBalance.value.amount);
  })();

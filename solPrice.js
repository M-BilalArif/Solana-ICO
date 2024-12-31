import axios from 'axios';

// Function to fetch Solana price
const fetchSolanaPrice = async () => {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');

        // Extract the price from the response
        const solanaPrice = response.data.solana.usd;

        // Log the price
        console.log(`Current Solana (SOL) price: $${solanaPrice} USD`);
    } catch (error) {
        if (error.response && error.response.status === 429) {
            // Rate limit exceeded, retry after specified period
            const retryAfter = error.response.headers['retry-after'];
            console.log(`Rate limit exceeded. Retrying in ${retryAfter} seconds...`);
            setTimeout(fetchSolanaPrice, retryAfter * 1000); // Retry after the "retry-after" period
        } else {
            console.error("Error fetching Solana price:", error);
        }
    }
};

// Call the function
fetchSolanaPrice();

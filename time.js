import moment from 'moment'; // For handling dates more easily

// Define the sale periods in terms of start and end dates
const salePeriods = [
    { start: '2024-12-30', end: '2025-01-10' },
    { start: '2025-01-11', end: '2025-01-20' },
    { start: '2025-01-21', end: '2025-01-30' },
    { start: '2025-01-31', end: '2025-02-09' },
    { start: '2025-02-10', end: '2025-02-19' }
];

// Function to get the current sale period
const getCurrentSalePeriod = () => {
    const currentDate = moment().startOf('day'); // Use the current date with time set to 00:00:00
    
    for (let i = 0; i < salePeriods.length; i++) {
        const saleStart = moment(salePeriods[i].start);
        const saleEnd = moment(salePeriods[i].end);
        
        // Check if the current date is within the sale period
        if (currentDate.isBetween(saleStart, saleEnd, null, '[]')) {
            return { sale: i + 1, start: saleStart.format('YYYY-MM-DD'), end: saleEnd.format('YYYY-MM-DD') };
        }
    }
    
    // Return null if no sale is active
    return null;
};

// Function to display the active sale period
const startSaleTimer = () => {
    const currentSale = getCurrentSalePeriod();
    
    if (currentSale) {
        console.log(`Sale ${currentSale.sale} is active. Start date: ${currentSale.start}, End date: ${currentSale.end}`);
    } else {
        console.log('No active sales at the moment. Please wait for the next sale period.');
    }
};

// Start the sale check when you run the script
startSaleTimer();

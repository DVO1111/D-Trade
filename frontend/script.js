/**
 * D-Trade Professional Trading Interface
 * Enhanced with more tokens, logos, and advanced chart features
 */

// DOM Elements
const connectWalletBtn = document.getElementById('connectWallet');
const walletModal = document.getElementById('walletModal');
const closeModal = document.getElementById('closeModal');
const walletOptions = document.getElementById('walletOptions');

// Status elements
const walletIndicator = document.getElementById('walletIndicator');
const walletStatusText = document.getElementById('walletStatusText');
const currentPrice = document.getElementById('currentPrice');
const priceChange = document.getElementById('priceChange');

// Trading elements
const tradeAmount = document.getElementById('tradeAmount');
const buyBtn = document.getElementById('buyBtn');
const sellBtn = document.getElementById('sellBtn');
const buyEstimate = document.getElementById('buyEstimate');
const sellEstimate = document.getElementById('sellEstimate');
const tradeMessage = document.getElementById('tradeMessage');

// Swap elements
const payAmount = document.getElementById('payAmount');
const getAmount = document.getElementById('getAmount');
const payTokenSelect = document.getElementById('payTokenSelect');
const getTokenSelect = document.getElementById('getTokenSelect');
const flipTokens = document.getElementById('flipTokens');
const swapBtn = document.getElementById('swapBtn');
const swapBtnText = document.getElementById('swapBtnText');
const swapSettings = document.getElementById('swapSettings');
const slippageSettings = document.getElementById('slippageSettings');

// Balance elements
const usdtBalance = document.getElementById('usdtBalance');
const payTokenBalance = document.getElementById('payTokenBalance');
const getTokenBalance = document.getElementById('getTokenBalance');
const portfolioUSDT = document.getElementById('portfolioUSDT');
const portfolioSOL = document.getElementById('portfolioSOL');
const totalValue = document.getElementById('totalValue');
const totalPnL = document.getElementById('totalPnL');

// Chart and trades
const tradingChart = document.getElementById('tradingChart');
const tradesList = document.getElementById('tradesList');

// Token modal
const tokenModal = document.getElementById('tokenModal');
const closeTokenModal = document.getElementById('closeTokenModal');

// State Management
let currentWallet = null;
let currentProvider = null;
let currentPayToken = 'USDT';
let currentGetToken = 'SOL';
let activeTokenSelector = null;

// Extended token list with metadata
const tokenList = {
    'SOL': {
        name: 'Solana',
        symbol: 'SOL',
        decimals: 9,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
        mint: 'So11111111111111111111111111111111111111112'
    },
    'USDT': {
        name: 'Tether USD',
        symbol: 'USDT',
        decimals: 6,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg',
        mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
    },
    'USDC': {
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
    },
    'RAY': {
        name: 'Raydium',
        symbol: 'RAY',
        decimals: 6,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png',
        mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'
    },
    'SRM': {
        name: 'Serum',
        symbol: 'SRM',
        decimals: 6,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt/logo.png',
        mint: 'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt'
    },
    'ORCA': {
        name: 'Orca',
        symbol: 'ORCA',
        decimals: 6,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE/logo.png',
        mint: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE'
    },
    'MNGO': {
        name: 'Mango',
        symbol: 'MNGO',
        decimals: 6,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac/logo.png',
        mint: 'MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac'
    },
    'STEP': {
        name: 'Step Finance',
        symbol: 'STEP',
        decimals: 9,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/StepAscQoEioFxxWGnh2sLBDFp9d8rvKz2Yp39iDpyT/logo.png',
        mint: 'StepAscQoEioFxxWGnh2sLBDFp9d8rvKz2Yp39iDpyT'
    },
    'COPE': {
        name: 'Cope',
        symbol: 'COPE',
        decimals: 6,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/8HGyAAB1yoM1ttS7pXjHMa3dukTFGQggnFFH3hJZgzQh/logo.png',
        mint: '8HGyAAB1yoM1ttS7pXjHMa3dukTFGQggnFFH3hJZgzQh'
    },
    'FIDA': {
        name: 'Bonfida',
        symbol: 'FIDA',
        decimals: 6,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EchesyfXePKdLtoiZSL8pBe8Myagyy8ZRqsACNCFGnvp/logo.png',
        mint: 'EchesyfXePKdLtoiZSL8pBe8Myagyy8ZRqsACNCFGnvp'
    },
    'SAMO': {
        name: 'Samoyedcoin',
        symbol: 'SAMO',
        decimals: 9,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU/logo.png',
        mint: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
    },
    'BONK': {
        name: 'Bonk',
        symbol: 'BONK',
        decimals: 5,
        logoURI: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
        mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
    },
    'WIF': {
        name: 'dogwifhat',
        symbol: 'WIF',
        decimals: 6,
        logoURI: 'https://bafkreibk3covs5ltyqxa272zw3ho2rz3pzrvserelt5d6vvl7jq7u3kfla.ipfs.nftstorage.link',
        mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm'
    },
    'JUP': {
        name: 'Jupiter',
        symbol: 'JUP',
        decimals: 6,
        logoURI: 'https://static.jup.ag/jup/icon.png',
        mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN'
    },
    'PYTH': {
        name: 'Pyth Network',
        symbol: 'PYTH',
        decimals: 6,
        logoURI: 'https://pyth.network/token.svg',
        mint: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3'
    }
};

// Price data with more tokens
let priceData = {
    'SOL': 142.50,
    'USDT': 1.0,
    'USDC': 1.0,
    'RAY': 1.85,
    'SRM': 0.32,
    'ORCA': 3.45,
    'MNGO': 0.045,
    'STEP': 0.12,
    'COPE': 0.08,
    'FIDA': 0.25,
    'SAMO': 0.0045,
    'BONK': 0.000025,
    'WIF': 2.15,
    'JUP': 0.85,
    'PYTH': 0.42
};

// Portfolio balances (demo) - extended
let balances = {
    'USDT': 100000,
    'SOL': 0,
    'USDC': 0,
    'RAY': 0,
    'SRM': 0,
    'ORCA': 0,
    'MNGO': 0,
    'STEP': 0,
    'COPE': 0,
    'FIDA': 0,
    'SAMO': 0,
    'BONK': 0,
    'WIF': 0,
    'JUP': 0,
    'PYTH': 0
};

let chartInstance = null;
let candlestickSeries = null;
let volumeSeries = null;
let priceUpdateInterval = null;

// Chart drawing tools state
let drawingMode = null;
let drawingTools = [];

// Utility Functions
function formatNumber(num, decimals = 2) {
    return Number(num).toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function formatUSD(num) {
    return `$${formatNumber(num, 2)}`;
}

function formatAddress(address) {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function generateRandomPrice(basePrice, volatility = 0.01) {
    const change = (Math.random() - 0.5) * 2 * volatility;
    return basePrice * (1 + change);
}

// Token Functions
function getTokenLogo(symbol) {
    const token = tokenList[symbol];
    return token ? token.logoURI : `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="%23666"><circle cx="12" cy="12" r="10"/></svg>`;
}

function updateTokenModal() {
    const tokenListContainer = document.querySelector('.token-list');
    if (!tokenListContainer) return;
    
    tokenListContainer.innerHTML = '';
    
    Object.entries(tokenList).forEach(([symbol, token]) => {
        const option = document.createElement('div');
        option.className = 'token-option';
        option.dataset.token = symbol;
        
        option.innerHTML = `
            <img src="${token.logoURI}" alt="${token.name}" class="token-icon" 
                 onerror="this.src='data:image/svg+xml,<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; width=&quot;24&quot; height=&quot;24&quot; viewBox=&quot;0 0 24 24&quot; fill=&quot;%23666&quot;><circle cx=&quot;12&quot; cy=&quot;12&quot; r=&quot;10&quot;/></svg>'">
            <div class="token-details">
                <span class="token-symbol">${token.symbol}</span>
                <span class="token-name">${token.name}</span>
            </div>
            <span class="token-balance">${formatNumber(balances[symbol] || 0, 2)}</span>
        `;
        
        option.addEventListener('click', () => selectToken(symbol));
        tokenListContainer.appendChild(option);
    });
}

// Wallet Functions
function detectWallets() {
    const wallets = [];
    
    if (window.solana && window.solana.isPhantom) {
        wallets.push({
            id: 'phantom',
            name: 'Phantom',
            icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSI+PGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiM1MTJkYTgiLz48L3N2Zz4='
        });
    }
    
    if (window.solflare && window.solflare.isSolflare) {
        wallets.push({
            id: 'solflare',
            name: 'Solflare',
            icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSI+PGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiNmZmMxMDciLz48L3N2Zz4='
        });
    }
    
    return wallets;
}

function openWalletModal() {
    const wallets = detectWallets();
    
    walletOptions.innerHTML = '';
    
    if (wallets.length === 0) {
        walletOptions.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--text-muted);">
                No wallets detected. Please install Phantom or Solflare.
            </div>
        `;
    } else {
        wallets.forEach(wallet => {
            const option = document.createElement('div');
            option.className = 'wallet-option';
            option.innerHTML = `
                <img src="${wallet.icon}" alt="${wallet.name}" class="wallet-logo">
                <span class="wallet-name">${wallet.name}</span>
            `;
            option.addEventListener('click', () => connectWallet(wallet.id));
            walletOptions.appendChild(option);
        });
    }
    
    walletModal.style.display = 'flex';
}

function closeWalletModal() {
    walletModal.style.display = 'none';
}

async function connectWallet(walletId) {
    try {
        let provider = null;
        
        if (walletId === 'phantom') {
            provider = window.solana;
        } else if (walletId === 'solflare') {
            provider = window.solflare;
        }
        
        if (!provider) {
            throw new Error('Wallet not found');
        }
        
        const response = await provider.connect();
        const publicKey = response.publicKey?.toString() || provider.publicKey?.toString();
        
        if (!publicKey) {
            throw new Error('Failed to get public key');
        }
        
        currentWallet = publicKey;
        currentProvider = provider;
        
        // Update UI
        connectWalletBtn.textContent = formatAddress(publicKey);
        connectWalletBtn.style.background = 'var(--green)';
        
        walletIndicator.textContent = '🟢';
        walletStatusText.textContent = 'Connected';
        
        // Enable trading buttons
        buyBtn.disabled = false;
        sellBtn.disabled = false;
        swapBtn.disabled = false;
        
        updateAllBalances();
        closeWalletModal();
        showTradeMessage('Wallet connected successfully!', 'success');
        
    } catch (error) {
        console.error('Wallet connection error:', error);
        showTradeMessage(`Failed to connect: ${error.message}`, 'error');
    }
}

// Trading Functions
function updateTradeEstimates() {
    const amount = parseFloat(tradeAmount.value) || 0;
    const solPrice = priceData.SOL;
    
    if (amount > 0) {
        const solAmount = amount / solPrice;
        buyEstimate.textContent = `≈ ${formatNumber(solAmount, 4)} SOL`;
        
        const usdtAmount = amount;
        sellEstimate.textContent = `≈ ${formatNumber(usdtAmount, 2)} USDT`;
    } else {
        buyEstimate.textContent = '≈ 0 SOL';
        sellEstimate.textContent = '≈ 0 USDT';
    }
}

function executeBuy() {
    if (!currentWallet) {
        showTradeMessage('Please connect your wallet first', 'error');
        return;
    }
    
    const amount = parseFloat(tradeAmount.value) || 0;
    if (amount <= 0) {
        showTradeMessage('Please enter a valid amount', 'error');
        return;
    }
    
    if (balances.USDT < amount) {
        showTradeMessage('Insufficient USDT balance', 'error');
        return;
    }
    
    const solPrice = priceData.SOL;
    const solAmount = amount / solPrice;
    
    // Execute demo trade
    balances.USDT -= amount;
    balances.SOL += solAmount;
    
    updateAllBalances();
    tradeAmount.value = '';
    updateTradeEstimates();
    
    showTradeMessage(`Successfully bought ${formatNumber(solAmount, 4)} SOL for ${formatUSD(amount)}`, 'success');
    addTradeToHistory('buy', solAmount, amount, solPrice);
}

function executeSell() {
    if (!currentWallet) {
        showTradeMessage('Please connect your wallet first', 'error');
        return;
    }
    
    const amount = parseFloat(tradeAmount.value) || 0;
    if (amount <= 0) {
        showTradeMessage('Please enter a valid amount', 'error');
        return;
    }
    
    const solPrice = priceData.SOL;
    const solAmount = amount / solPrice;
    
    if (balances.SOL < solAmount) {
        showTradeMessage('Insufficient SOL balance', 'error');
        return;
    }
    
    // Execute demo trade
    balances.SOL -= solAmount;
    balances.USDT += amount;
    
    updateAllBalances();
    tradeAmount.value = '';
    updateTradeEstimates();
    
    showTradeMessage(`Successfully sold ${formatNumber(solAmount, 4)} SOL for ${formatUSD(amount)}`, 'success');
    addTradeToHistory('sell', solAmount, amount, solPrice);
}

// Swap Functions
function updateSwapEstimate() {
    const payAmountValue = parseFloat(payAmount.value) || 0;
    
    if (payAmountValue <= 0) {
        getAmount.value = '';
        swapBtnText.textContent = 'Enter Amount';
        swapBtn.disabled = true;
        document.getElementById('swapDetails').style.display = 'none';
        return;
    }
    
    const payPrice = priceData[currentPayToken];
    const getPrice = priceData[currentGetToken];
    
    if (!payPrice || !getPrice) {
        getAmount.value = '';
        swapBtnText.textContent = 'Price Unavailable';
        swapBtn.disabled = true;
        return;
    }
    
    const payValueUSD = payAmountValue * payPrice;
    const getAmountValue = payValueUSD / getPrice;
    
    getAmount.value = formatNumber(getAmountValue, 6);
    swapBtnText.textContent = currentWallet ? 'Swap' : 'Connect Wallet';
    swapBtn.disabled = !currentWallet;
    
    // Show swap details
    document.getElementById('swapDetails').style.display = 'block';
    document.getElementById('swapRate').textContent = `1 ${currentPayToken} = ${formatNumber(payPrice / getPrice, 6)} ${currentGetToken}`;
}

function executeSwap() {
    if (!currentWallet) {
        showTradeMessage('Please connect your wallet first', 'error');
        return;
    }
    
    const payAmountValue = parseFloat(payAmount.value) || 0;
    const getAmountValue = parseFloat(getAmount.value) || 0;
    
    if (payAmountValue <= 0 || getAmountValue <= 0) {
        showTradeMessage('Please enter a valid amount', 'error');
        return;
    }
    
    if (balances[currentPayToken] < payAmountValue) {
        showTradeMessage(`Insufficient ${currentPayToken} balance`, 'error');
        return;
    }
    
    // Execute demo swap
    balances[currentPayToken] -= payAmountValue;
    balances[currentGetToken] += getAmountValue;
    
    updateAllBalances();
    payAmount.value = '';
    getAmount.value = '';
    updateSwapEstimate();
    
    showTradeMessage(`Successfully swapped ${formatNumber(payAmountValue, 4)} ${currentPayToken} for ${formatNumber(getAmountValue, 4)} ${currentGetToken}`, 'success');
    addTradeToHistory('swap', getAmountValue, payAmountValue * priceData[currentPayToken], priceData[currentGetToken]);
}

function flipSwapTokens() {
    const tempToken = currentPayToken;
    currentPayToken = currentGetToken;
    currentGetToken = tempToken;
    
    updateTokenSelectors();
    payAmount.value = '';
    getAmount.value = '';
    updateSwapEstimate();
    updateAllBalances();
}

function updateTokenSelectors() {
    // Update pay token selector
    const payTokenInfo = payTokenSelect.querySelector('.token-info');
    const payToken = tokenList[currentPayToken];
    payTokenInfo.innerHTML = `
        <img src="${payToken.logoURI}" alt="${payToken.name}" class="token-icon" 
             onerror="this.src='data:image/svg+xml,<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; width=&quot;24&quot; height=&quot;24&quot; viewBox=&quot;0 0 24 24&quot; fill=&quot;%23666&quot;><circle cx=&quot;12&quot; cy=&quot;12&quot; r=&quot;10&quot;/></svg>'">
        <span class="token-symbol">${currentPayToken}</span>
    `;
    
    // Update get token selector
    const getTokenInfo = getTokenSelect.querySelector('.token-info');
    const getToken = tokenList[currentGetToken];
    getTokenInfo.innerHTML = `
        <img src="${getToken.logoURI}" alt="${getToken.name}" class="token-icon" 
             onerror="this.src='data:image/svg+xml,<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; width=&quot;24&quot; height=&quot;24&quot; viewBox=&quot;0 0 24 24&quot; fill=&quot;%23666&quot;><circle cx=&quot;12&quot; cy=&quot;12&quot; r=&quot;10&quot;/></svg>'">
        <span class="token-symbol">${currentGetToken}</span>
    `;
}

function openTokenModal(selectorType) {
    activeTokenSelector = selectorType;
    updateTokenModal();
    tokenModal.style.display = 'flex';
}

function selectToken(token) {
    if (activeTokenSelector === 'pay') {
        currentPayToken = token;
    } else if (activeTokenSelector === 'get') {
        currentGetToken = token;
    }
    
    updateTokenSelectors();
    updateSwapEstimate();
    updateAllBalances();
    tokenModal.style.display = 'none';
}

// Balance Updates
function updateAllBalances() {
    // Update individual balance displays
    usdtBalance.textContent = formatNumber(balances.USDT, 2);
    
    // Update token-specific balances
    payTokenBalance.textContent = formatNumber(balances[currentPayToken] || 0, 4);
    getTokenBalance.textContent = formatNumber(balances[currentGetToken] || 0, 4);
    
    // Update portfolio
    portfolioUSDT.textContent = formatNumber(balances.USDT, 0);
    portfolioSOL.textContent = formatNumber(balances.SOL, 4);
    
    // Calculate total value
    let totalUSDValue = 0;
    Object.entries(balances).forEach(([token, amount]) => {
        totalUSDValue += amount * (priceData[token] || 0);
    });
    
    totalValue.textContent = formatUSD(totalUSDValue);
    
    // Calculate PnL (assuming starting value was $100,000)
    const pnl = totalUSDValue - 100000;
    const pnlPercent = (pnl / 100000) * 100;
    totalPnL.textContent = `${formatUSD(pnl)} (${pnlPercent >= 0 ? '+' : ''}${formatNumber(pnlPercent, 2)}%)`;
    totalPnL.className = `pnl ${pnl >= 0 ? 'positive' : 'negative'}`;
}

// Trade History
function addTradeToHistory(type, amount, usdValue, price) {
    const tradeItem = document.createElement('div');
    tradeItem.className = 'trade-item';
    
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    tradeItem.innerHTML = `
        <div class="trade-type ${type}">${type.toUpperCase()}</div>
        <div class="trade-amount">${formatNumber(amount, 4)} ${type === 'buy' ? 'SOL' : type === 'sell' ? 'SOL' : currentGetToken}</div>
        <div class="trade-price">${formatUSD(price)}</div>
        <div class="trade-time">${timeStr}</div>
    `;
    
    tradeItem.classList.add(`flash-${type === 'swap' ? 'buy' : type}`);
    tradesList.insertBefore(tradeItem, tradesList.firstChild);
    
    // Keep only last 20 trades
    const trades = tradesList.querySelectorAll('.trade-item');
    if (trades.length > 20) {
        trades[trades.length - 1].remove();
    }
}

// Price Updates
function updatePrices() {
    // Simulate price movement for all tokens
    Object.keys(priceData).forEach(token => {
        if (token !== 'USDT' && token !== 'USDC') {
            priceData[token] = generateRandomPrice(priceData[token], 0.005);
        }
    });
    
    // Update price display
    currentPrice.textContent = formatUSD(priceData.SOL);
    
    // Simulate price change percentage
    const changePercent = (Math.random() - 0.5) * 4; // -2% to +2%
    priceChange.textContent = `${changePercent >= 0 ? '+' : ''}${formatNumber(changePercent, 2)}%`;
    priceChange.className = `price-change ${changePercent >= 0 ? 'positive' : 'negative'}`;
    
    // Update estimates
    updateTradeEstimates();
    updateSwapEstimate();
    updateAllBalances();
    
    // Update chart with new price
    if (candlestickSeries) {
        updateChartWithNewPrice(priceData.SOL);
    }
}

// Enhanced Chart Functions
function initializeChart() {
    if (!tradingChart || typeof LightweightCharts === 'undefined') return;
    
    try {
        chartInstance = LightweightCharts.createChart(tradingChart, {
            width: tradingChart.clientWidth,
            height: tradingChart.clientHeight,
            layout: {
                background: { type: 'solid', color: 'transparent' },
                textColor: '#ffffff'
            },
            grid: {
                vertLines: { color: 'rgba(255, 255, 255, 0.1)' },
                horzLines: { color: 'rgba(255, 255, 255, 0.1)' }
            },
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                borderColor: 'rgba(255, 255, 255, 0.2)'
            },
            rightPriceScale: {
                borderColor: 'rgba(255, 255, 255, 0.2)'
            },
            crosshair: {
                mode: 1,
                vertLine: {
                    color: 'rgba(0, 212, 170, 0.5)',
                    width: 1,
                    style: 0
                },
                horzLine: {
                    color: 'rgba(0, 212, 170, 0.5)',
                    width: 1,
                    style: 0
                }
            }
        });
        
        // Add candlestick series
        candlestickSeries = chartInstance.addCandlestickSeries({
            upColor: '#00d4aa',
            downColor: '#ff6b6b',
            wickUpColor: '#00d4aa',
            wickDownColor: '#ff6b6b',
            borderVisible: false
        });
        
        // Add volume series
        volumeSeries = chartInstance.addHistogramSeries({
            color: '#26a69a',
            priceFormat: {
                type: 'volume',
            },
            priceScaleId: '',
            scaleMargins: {
                top: 0.8,
                bottom: 0,
            },
        });
        
        // Generate sample data
        const { candleData, volumeData } = generateSampleChartData();
        candlestickSeries.setData(candleData);
        volumeSeries.setData(volumeData);
        
        // Handle resize
        const resizeObserver = new ResizeObserver(entries => {
            if (chartInstance && entries[0]) {
                chartInstance.applyOptions({
                    width: entries[0].contentRect.width,
                    height: entries[0].contentRect.height
                });
            }
        });
        
        resizeObserver.observe(tradingChart);
        
        // Add drawing tools functionality
        setupDrawingTools();
        
    } catch (error) {
        console.error('Chart initialization error:', error);
    }
}

function generateSampleChartData() {
    const candleData = [];
    const volumeData = [];
    const now = Math.floor(Date.now() / 1000);
    let price = 140;
    
    for (let i = 300; i >= 0; i--) {
        const time = now - (i * 60);
        const volatility = 0.02;
        const change = (Math.random() - 0.5) * volatility;
        
        const open = price;
        const close = price * (1 + change);
        const high = Math.max(open, close) * (1 + Math.random() * 0.01);
        const low = Math.min(open, close) * (1 - Math.random() * 0.01);
        
        candleData.push({
            time: time,
            open: open,
            high: high,
            low: low,
            close: close
        });
        
        // Generate volume data
        const volume = Math.random() * 1000000 + 100000;
        volumeData.push({
            time: time,
            value: volume,
            color: close > open ? 'rgba(0, 212, 170, 0.5)' : 'rgba(255, 107, 107, 0.5)'
        });
        
        price = close;
    }
    
    return { candleData, volumeData };
}

function updateChartWithNewPrice(newPrice) {
    if (!candlestickSeries) return;
    
    const now = Math.floor(Date.now() / 1000);
    const lastCandle = {
        time: now,
        open: newPrice * (0.999 + Math.random() * 0.002),
        high: newPrice * (1.001 + Math.random() * 0.002),
        low: newPrice * (0.998 + Math.random() * 0.002),
        close: newPrice
    };
    
    candlestickSeries.update(lastCandle);
    
    if (volumeSeries) {
        const volume = Math.random() * 500000 + 50000;
        volumeSeries.update({
            time: now,
            value: volume,
            color: lastCandle.close > lastCandle.open ? 'rgba(0, 212, 170, 0.5)' : 'rgba(255, 107, 107, 0.5)'
        });
    }
}

function setupDrawingTools() {
    // Add click handlers for drawing tools
    document.querySelectorAll('.tool-btn').forEach((btn, index) => {
        btn.addEventListener('click', () => {
            const tools = ['ruler', 'trend', 'horizontal', 'vertical', 'rectangle'];
            const tool = tools[index];
            
            // Toggle drawing mode
            if (drawingMode === tool) {
                drawingMode = null;
                btn.classList.remove('active');
            } else {
                // Remove active from all tools
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                drawingMode = tool;
                btn.classList.add('active');
            }
            
            // Update cursor
            tradingChart.style.cursor = drawingMode ? 'crosshair' : 'default';
        });
    });
}

// Message Functions
function showTradeMessage(message, type) {
    tradeMessage.textContent = message;
    tradeMessage.className = `trade-message ${type}`;
    
    setTimeout(() => {
        tradeMessage.textContent = '';
        tradeMessage.className = 'trade-message';
    }, 3000);
}

// Event Listeners
function setupEventListeners() {
    // Wallet connection
    connectWalletBtn.addEventListener('click', openWalletModal);
    closeModal.addEventListener('click', closeWalletModal);
    
    // Close modals when clicking outside
    walletModal.addEventListener('click', (e) => {
        if (e.target === walletModal) closeWalletModal();
    });
    
    tokenModal.addEventListener('click', (e) => {
        if (e.target === tokenModal) {
            tokenModal.style.display = 'none';
        }
    });
    
    closeTokenModal.addEventListener('click', () => {
        tokenModal.style.display = 'none';
    });
    
    // Trading
    tradeAmount.addEventListener('input', updateTradeEstimates);
    buyBtn.addEventListener('click', executeBuy);
    sellBtn.addEventListener('click', executeSell);
    
    // Swap
    payAmount.addEventListener('input', updateSwapEstimate);
    swapBtn.addEventListener('click', executeSwap);
    flipTokens.addEventListener('click', flipSwapTokens);
    
    // Token selectors
    payTokenSelect.addEventListener('click', () => openTokenModal('pay'));
    getTokenSelect.addEventListener('click', () => openTokenModal('get'));
    
    // Quick amount buttons
    document.querySelectorAll('.quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const percentage = parseFloat(btn.dataset.pct) / 100;
            const balance = balances[currentPayToken] || 0;
            const amount = balance * percentage;
            payAmount.value = formatNumber(amount, 6);
            updateSwapEstimate();
        });
    });
    
    // Settings
    swapSettings.addEventListener('click', () => {
        const isVisible = slippageSettings.style.display !== 'none';
        slippageSettings.style.display = isVisible ? 'none' : 'block';
    });
    
    // Slippage buttons
    document.querySelectorAll('.slippage-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.slippage-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('slippageValue').textContent = `${btn.dataset.slippage}%`;
        });
    });
    
    // Timeframe buttons
    document.querySelectorAll('.tf-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
    
    // Trade filters
    document.querySelectorAll('.trades-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.trades-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}

// Initialization
function initialize() {
    console.log('Initializing D-Trade interface...');
    
    setupEventListeners();
    updateTokenSelectors();
    updateAllBalances();
    updateTradeEstimates();
    updateSwapEstimate();
    
    // Initialize chart
    setTimeout(() => {
        initializeChart();
    }, 100);
    
    // Start price updates
    priceUpdateInterval = setInterval(updatePrices, 3000);
    
    // Add some initial trades to history
    setTimeout(() => {
        addTradeToHistory('buy', 0.7, 100, 142.50);
        addTradeToHistory('sell', 0.35, 50, 142.85);
    }, 1000);
    
    console.log('D-Trade interface initialized successfully');
}

// Start the application
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

// Cleanup
window.addEventListener('beforeunload', () => {
    if (priceUpdateInterval) clearInterval(priceUpdateInterval);
    if (chartInstance) chartInstance.remove();
});
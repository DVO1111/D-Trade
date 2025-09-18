/**
 * Wallet Connect Demo — Choose Wallet, Live Prices, Chart, and Demo Trading (paper mode).
 * - No auto-connect; wallet picker modal for Phantom/Solflare.
 * - Live prices via backend /api/prices (Jupiter first, DexScreener fallback).
 * - Live SOL chart (Chart.js) updating every ~10s.
 * - Demo trading simulated via localStorage (per-wallet or guest).
 */

// Buttons & status
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const statusDiv = document.getElementById('status');

// Wallet and balances
const pubkeyEl = document.getElementById('pubkey');
const solBalanceEl = document.getElementById('solBalance');
const walletCard = document.getElementById('wallet');
const balancesCard = document.getElementById('balances');
const balanceList = document.getElementById('balanceList');

// Prices & chart
const pricesCard = document.getElementById('prices');
const solPriceEl = document.getElementById('solPrice');
const usdcPriceEl = document.getElementById('usdcPrice');
const chartCard = document.getElementById('chartCard');
const priceChartCanvas = document.getElementById('priceChart');

// Modal elements
const walletModal = document.getElementById('walletModal');
const walletOptions = document.getElementById('walletOptions');
const closeModalBtn = document.getElementById('closeModal');
const noWalletsMsg = document.getElementById('noWalletsMsg');

// Demo trading elements
const demoUsdEl = document.getElementById('demoUsd');
const demoHoldingsEl = document.getElementById('demoHoldings');
const demoValueEl = document.getElementById('demoValue');
const tradeForm = document.getElementById('tradeForm');
const tradeTokenEl = document.getElementById('tradeToken');
const tradeUsdEl = document.getElementById('tradeUsd');
const tradeMsgEl = document.getElementById('tradeMsg');
const tradeHistoryEl = document.getElementById('tradeHistory');

let currentPubkey = null;
let currentProvider = null;
let lastBalances = null;
let lastPrices = null;
let priceTimer = null;
let chart = null;
const priceHistory = []; // {t: Date, price: number}

// -------------------- Helpers --------------------
function setStatus(msg, isError = false) {
  statusDiv.textContent = msg;
  statusDiv.style.color = isError ? '#fca5a5' : '#cbd5e1';
}
function isPhantomInstalled() {
  return typeof window !== 'undefined' && window.solana && window.solana.isPhantom;
}
function detectWallets() {
  const wallets = [];
  if (typeof window !== 'undefined') {
    if (window.solana && window.solana.isPhantom) wallets.push({ id: 'phantom', name: 'Phantom' });
    if (window.solflare && window.solflare.isSolflare) wallets.push({ id: 'solflare', name: 'Solflare' });
  }
  return wallets;
}
function storageKey() {
  return `demo:${currentPubkey || 'guest'}`;
}
function loadDemoState() {
  const raw = localStorage.getItem(storageKey());
  if (!raw) {
    return { usd: 10000, holdings: { SOL: 0, USDC: 0 }, history: [] };
  }
  try {
    const st = JSON.parse(raw);
    if (!st.usd || !st.holdings || !st.history) throw new Error('bad');
    if (typeof st.holdings.SOL !== 'number') st.holdings.SOL = 0;
    if (typeof st.holdings.USDC !== 'number') st.holdings.USDC = 0;
    return st;
  } catch {
    return { usd: 10000, holdings: { SOL: 0, USDC: 0 }, history: [] };
  }
}
function saveDemoState(st) {
  localStorage.setItem(storageKey(), JSON.stringify(st));
}
function fmtUSD(n) {
  return '$' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
}
function nowISO() {
  return new Date().toISOString().replace('T', ' ').split('.')[0];
}

// -------------------- Wallet Modal --------------------
function openWalletModal() {
  const wallets = detectWallets();
  walletOptions.innerHTML = '';
  noWalletsMsg.style.display = wallets.length ? 'none' : 'block';
  wallets.forEach(w => {
    const btn = document.createElement('button');
    btn.className = 'wallet-btn';
    btn.innerHTML = `<span class="wallet-icon"></span> ${w.name}`;
    btn.addEventListener('click', () => connectWallet(w.id));
    walletOptions.appendChild(btn);
  });
  walletModal.style.display = 'flex';
}
function closeWalletModal() {
  walletModal.style.display = 'none';
}

// -------------------- Wallet Connect/Disconnect --------------------
async function connectWallet(walletId) {
  try {
    let provider = null;
    if (walletId === 'phantom') {
      if (!(window.solana && window.solana.isPhantom)) {
        setStatus('Phantom not detected. Install Phantom and reload.', true);
        return;
      }
      provider = window.solana;
    } else if (walletId === 'solflare') {
      if (!(window.solflare && window.solflare.isSolflare)) {
        setStatus('Solflare not detected. Install Solflare and reload.', true);
        return;
      }
      provider = window.solflare;
    } else {
      setStatus('Selected wallet is not supported yet.', true);
      return;
    }

    if (provider.disconnect) {
      try { await provider.disconnect(); } catch (_) {}
    }

    const resp = await provider.connect();
    const pubkey = (resp?.publicKey?.toString?.()) || (provider.publicKey?.toString?.()) || null;
    if (!pubkey) throw new Error('Failed to retrieve public key from wallet');

    currentProvider = provider;
    currentPubkey = pubkey;

    setStatus(`Connected via ${walletId} as ${pubkey}`);
    pubkeyEl.innerText = pubkey;
    walletCard.style.display = 'block';
    disconnectBtn.style.display = 'inline-block';
    connectBtn.style.display = 'none';
    closeWalletModal();

    await fetchBalances(pubkey);
    await refreshPrices(); // also shows chart
    startPricePolling();
    renderDemo(); // ensure demo state rendered per-wallet
  } catch (err) {
    console.error('Wallet connect error:', err);
    setStatus('User rejected connection or error occurred.', true);
  }
}
async function disconnectWallet() {
  currentPubkey = null;
  if (priceTimer) { clearInterval(priceTimer); priceTimer = null; }

  try {
    if (currentProvider && currentProvider.disconnect) {
      await currentProvider.disconnect();
    } else if (window.solana && window.solana.disconnect) {
      await window.solana.disconnect();
    }
  } catch (e) {
    console.warn('Disconnect warning:', e);
  }

  pubkeyEl.innerText = '';
  solBalanceEl.innerText = '—';
  walletCard.style.display = 'none';
  balancesCard.style.display = 'none';
  pricesCard.style.display = 'none';
  chartCard.style.display = 'none';
  disconnectBtn.style.display = 'none';
  connectBtn.style.display = 'inline-block';
  setStatus('Disconnected.');
  renderDemo();
}

// -------------------- Backend Calls --------------------
async function fetchBalances(pubkey) {
  try {
    const res = await fetch(`/api/balances/${pubkey}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const balances = await res.json();
    lastBalances = balances;

    const sol = balances.SOL?.balance ?? balances.SOL ?? null;
    if (typeof sol === 'number') {
      solBalanceEl.innerText = `${Number(sol).toLocaleString(undefined, {maximumFractionDigits:6})} SOL`;
    } else {
      solBalanceEl.innerText = 'N/A';
    }

    renderBalances(balances);
    setStatus('Balances loaded (live).');
  } catch (err) {
    console.error(err);
    setStatus('Error fetching balances: ' + err.message, true);
  }
}
function renderBalances(balances) {
  balanceList.innerHTML = '';
  const entries = Object.entries(balances)
    .map(([symbol, data]) => ({
      symbol,
      amount: typeof data === 'object' && data !== null ? Number(data.balance) : Number(data),
      display: (typeof data === 'object' && data?.display) ? data.display : symbol
    }))
    .filter(x => Number.isFinite(x.amount));
  entries.sort((a, b) => (b.amount - a.amount));
  entries.forEach(({symbol, amount, display}) => {
    const li = document.createElement('li');
    li.className = 'balance-item';
    li.innerHTML = `
      <div class="symbol">${symbol}</div>
      <div class="amount">${amount.toLocaleString(undefined, {maximumFractionDigits:6})}</div>
      <div class="label">${display}</div>
    `;
    balanceList.appendChild(li);
  });
  balancesCard.style.display = entries.length ? 'block' : 'none';
}

async function getPrices() {
  const res = await fetch(`/api/prices`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

// -------------------- Prices & Chart --------------------
async function refreshPrices() {
  try {
    const prices = await getPrices();
    lastPrices = prices;

    solPriceEl.innerText = (typeof prices.SOL === 'number') ? prices.SOL.toFixed(4) + ' USD' : 'N/A';
    usdcPriceEl.innerText = (typeof prices.USDC === 'number') ? prices.USDC.toFixed(4) + ' USD' : 'N/A';
    pricesCard.style.display = 'block';

    // Update chart with SOL
    if (typeof prices.SOL === 'number') {
      const pt = { t: new Date(), price: prices.SOL };
      priceHistory.push(pt);
      if (priceHistory.length > 180) priceHistory.shift(); // ~30min if 10s interval
      renderChart();
    }
    chartCard.style.display = 'block';

    // Update demo valuation after price update
    renderDemo();
  } catch (err) {
    console.error('Price fetch error:', err);
    solPriceEl.innerText = 'Error';
    usdcPriceEl.innerText = 'Error';
  }
}
function startPricePolling() {
  if (priceTimer) clearInterval(priceTimer);
  priceTimer = setInterval(refreshPrices, 10000);
}
function renderChart() {
  if (!priceChartCanvas) return;
  const labels = priceHistory.map(p => p.t.toLocaleTimeString());
  const data = priceHistory.map(p => p.price);
  if (!chart) {
    chart = new Chart(priceChartCanvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'SOL/USD',
          data,
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139,92,246,0.15)',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: '#cbd5e1' }, grid: { color: 'rgba(148,163,184,0.15)' } },
          y: { ticks: { color: '#cbd5e1' }, grid: { color: 'rgba(148,163,184,0.15)' } }
        },
        plugins: { legend: { labels: { color: '#e2e8f0' } } }
      }
    });
  } else {
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update('none');
  }
}

// -------------------- Demo Trading (paper) --------------------
function renderDemo() {
  const st = loadDemoState();
  demoUsdEl.textContent = fmtUSD(st.usd);
  const solUnits = st.holdings.SOL || 0;
  const usdcUnits = st.holdings.USDC || 0;
  demoHoldingsEl.textContent = `SOL: ${solUnits.toFixed(6)} • USDC: ${usdcUnits.toFixed(2)}`;

  const solPrice = lastPrices && typeof lastPrices.SOL === 'number' ? lastPrices.SOL : 0;
  const usdcPrice = lastPrices && typeof lastPrices.USDC === 'number' ? lastPrices.USDC : 1;
  const value = st.usd + solUnits * solPrice + usdcUnits * usdcPrice;
  demoValueEl.textContent = fmtUSD(value);

  // History
  tradeHistoryEl.innerHTML = '';
  st.history.slice().reverse().forEach(h => {
    const li = document.createElement('li');
    li.textContent = `[${h.time}] ${h.side.toUpperCase()} ${h.token} ${h.units} @ ${fmtUSD(h.price)} (${fmtUSD(h.usd)} USD)`;
    tradeHistoryEl.appendChild(li);
  });
}
tradeForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const side = tradeForm.elements['side'].value;
  const token = tradeTokenEl.value;
  const usd = Number(tradeUsdEl.value || 0);
  tradeMsgEl.textContent = '';

  if (!lastPrices || typeof lastPrices[token] !== 'number') {
    tradeMsgEl.textContent = 'Live price unavailable. Please wait for price to load.';
    return;
  }
  if (usd <= 0) {
    tradeMsgEl.textContent = 'Enter a valid USD amount.';
    return;
  }

  const st = loadDemoState();
  const price = lastPrices[token];
  const units = token === 'USDC' ? usd : usd / price; // USDC 1:1

  if (side === 'buy') {
    if (st.usd < usd) {
      tradeMsgEl.textContent = 'Insufficient demo cash.';
      return;
    }
    st.usd -= usd;
    st.holdings[token] = (st.holdings[token] || 0) + units;
  } else {
    const have = st.holdings[token] || 0;
    if (have <= 0) {
      tradeMsgEl.textContent = `No ${token} to sell.`;
      return;
    }
    if (units > have) {
      tradeMsgEl.textContent = `You only have ${have.toFixed(6)} ${token}.`;
      return;
    }
    st.holdings[token] = have - units;
    st.usd += usd;
  }

  st.history.push({
    time: nowISO(),
    side,
    token,
    usd: Number(usd.toFixed(2)),
    price: Number(price.toFixed(6)),
    units: Number(units.toFixed(6))
  });

  saveDemoState(st);
  renderDemo();
  tradeMsgEl.textContent = 'Demo trade recorded.';
});

// -------------------- DOM wiring --------------------
connectBtn.addEventListener('click', openWalletModal);
disconnectBtn.addEventListener('click', disconnectWallet);
closeModalBtn.addEventListener('click', closeWalletModal);
walletModal.addEventListener('click', (e) => { if (e.target === walletModal) closeWalletModal(); });

// On load: do NOT auto-connect; just inform which wallets are detected
window.addEventListener('load', async () => {
  const wallets = detectWallets();
  if (wallets.length > 0) {
    const names = wallets.map(w => w.name).join(', ');
    setStatus(`Detected wallets: ${names}. Click "Connect Wallet" to choose.`);
  } else {
    setStatus('No wallets detected. Install Phantom or Solflare and reload this page.', true);
  }

  // Always show demo (guest) and start price polling to power chart + demo valuation
  renderDemo();
  await refreshPrices();
  startPricePolling();
});
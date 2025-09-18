/**
 * backend/server.js
 * Express server that serves static frontend and wallet API:
 * - /api/ping
 * - /api/balances/:pubkey
 * - /api/prices  (Jupiter price API with DexScreener fallback)
 * - /api/quote
 * - /api/swap
 */
require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Helius RPC (key from ../.env)
const HELIUS_KEY = process.env.HELIUS_API_KEY || '';
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;

// TOKEN MAP: well-known mints
const TOKEN_MAP = {
  'So11111111111111111111111111111111111111112': {
    symbol: 'SOL',
    name: 'Solana',
    // SOL/USDC on Orca (DexScreener pair address, chain is solana)
    pairAddress: 'Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE'
  },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
    symbol: 'USDC',
    name: 'USD Coin',
    pairAddress: 'Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE'
  },
  // Additional common tokens (pairAddress used for fallback only; may not always resolve)
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
    symbol: 'USDT',
    name: 'Tether USD',
    pairAddress: '6UeJt7rJxZzL6wZqZQpQ7vY5X9k6v6vZ5y1Y5vQ6vQ6'
  },
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': {
    symbol: 'RAY',
    name: 'Raydium',
    pairAddress: '6UeJt7rJxZzL6wZqZQpQ7vY5X9k6v6vZ5y1Y5vQ6vQ6'
  }
};

function safeNumber(v) {
  if (v === null || typeof v === 'undefined') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function tokenInfoForMint(mint) {
  return TOKEN_MAP[mint] || { symbol: mint, name: mint, pairAddress: null };
}

// ---------------------- API Endpoints ----------------------

// Health check
app.get('/api/ping', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Balances
app.get('/api/balances/:pubkey', async (req, res) => {
  const pubkey = req.params.pubkey;
  if (!pubkey) return res.status(400).json({ error: 'pubkey required' });

  try {
    // Token accounts
    const tokenAccountsResp = await fetch(HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'getTokenAccountsByOwner',
        method: 'getTokenAccountsByOwner',
        params: [
          pubkey,
          { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
          { encoding: 'jsonParsed' }
        ]
      })
    });
    const tokenAccountsJson = await tokenAccountsResp.json();

    const balances = {};

    if (tokenAccountsJson.result?.value) {
      tokenAccountsJson.result.value.forEach(acc => {
        try {
          const info = acc.account.data.parsed.info;
          const mint = info.mint;
          const uiAmount = info.tokenAmount?.uiAmount ?? 0;
          const tinfo = tokenInfoForMint(mint);
          balances[tinfo.symbol] = { balance: uiAmount, display: tinfo.name };
        } catch (e) {}
      });
    }

    // Native SOL
    const solResp = await fetch(HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'getBalance',
        method: 'getBalance',
        params: [pubkey]
      })
    });
    const solJson = await solResp.json();
    const lamports = solJson.result?.value ?? 0;
    const solAmount = lamports / 1e9;
    const solInfo = tokenInfoForMint('So11111111111111111111111111111111111111112');
    balances[solInfo.symbol] = { balance: solAmount, display: solInfo.name };

    return res.json(balances);
  } catch (err) {
    console.error('Balance fetch error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Helper: DexScreener price fetch (solana chain)
async function getDexPriceUSD(pairAddress) {
  if (!pairAddress) return null;
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${pairAddress}`);
    const j = await r.json();
    const priceStr = j?.pairs?.[0]?.priceUsd ?? j?.pair?.priceUsd ?? null;
    return safeNumber(priceStr);
  } catch {
    return null;
  }
}

// Prices (Jupiter first, DexScreener fallback)
app.get('/api/prices', async (req, res) => {
  try {
    const mints = Object.keys(TOKEN_MAP);
    const prices = {};

    // Try Jupiter price API v6
    try {
      const jupUrl = `https://price.jup.ag/v6/price?ids=${encodeURIComponent(mints.join(','))}`;
      const jr = await fetch(jupUrl);
      const jj = await jr.json();
      for (const mint of mints) {
        const p = jj?.data?.[mint]?.price;
        if (typeof p === 'number') {
          const sym = TOKEN_MAP[mint].symbol;
          prices[sym] = p;
        }
      }
    } catch (e) {
      // Ignore, fallback below
    }

    // Fallback to DexScreener for missing symbols
    await Promise.all(
      Object.entries(TOKEN_MAP).map(async ([mint, info]) => {
        const sym = info.symbol;
        if (typeof prices[sym] === 'number') return;
        const pDex = await getDexPriceUSD(info.pairAddress);
        prices[sym] = typeof pDex === 'number' ? pDex : null;
      })
    );

    // USDC default to 1.0 if missing
    if (typeof prices.USDC !== 'number') prices.USDC = 1.0;

    return res.json(prices);
  } catch (err) {
    console.error('Price fetch error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Quote
app.get('/api/quote', async (req, res) => {
  const { inputMint, outputMint, amount } = req.query;
  if (!inputMint || !outputMint || !amount) {
    return res.status(400).json({ error: 'inputMint, outputMint and amount are required' });
  }
  try {
    const r = await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`);
    const j = await r.json();
    return res.json(j);
  } catch (err) {
    console.error('Quote error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Swap (server-prep for client signing)
app.post('/api/swap', async (req, res) => {
  const { userPubkey, inputMint, outputMint, amount } = req.body;
  if (!userPubkey || !inputMint || !outputMint || typeof amount === 'undefined') {
    return res.status(400).json({ error: 'userPubkey, inputMint, outputMint, amount required' });
  }
  try {
    const qRes = await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`);
    const qJson = await qRes.json();
    const swapRes = await fetch('https://quote-api.jup.ag/v6/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: qJson,
        userPublicKey: userPubkey,
        wrapUnwrapSOL: true,
        wrapAndUnwrapSol: true
      })
    });
    const swapJson = await swapRes.json();
    return res.json(swapJson);
  } catch (err) {
    console.error('Swap error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend + Frontend serving at http://localhost:${PORT}`);
});
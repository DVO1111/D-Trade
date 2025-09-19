/**
 * backend/server.js
 * Express server serving static frontend and wallet/demo trading API:
 * - GET  /api/ping
 * - GET  /api/balances/:pubkey
 * - GET  /api/prices            (supports ?ids=comma,separated,mints & ?source=dex|jup, default dex)
 * - GET  /api/token-meta?mint=...
 * - GET  /assets/pnl            (serves provided PnL image)
 * - GET  /assets/trade-history-ref (serves provided trade history reference image)
 * - GET  /api/quote
 * - POST /api/swap
 */
require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = global.fetch || ((...args) => import('node-fetch').then(({default: f}) => f(...args)));

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Helius RPC (key from ../.env)
const HELIUS_KEY = process.env.HELIUS_API_KEY || '';
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;

// Known token mints
const MINT_SOL = 'So11111111111111111111111111111111111111112';
const MINT_USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const TOKEN_MAP = {
  [MINT_SOL]: {
    symbol: 'SOL',
    name: 'Solana',
    pairAddress: 'Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE' // Orca SOL/USDC (fallback by pair)
  },
  [MINT_USDC]: {
    symbol: 'USDC',
    name: 'USD Coin',
    pairAddress: 'Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE'
  },
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
function uniq(arr) {
  return [...new Set((arr || []).filter(Boolean))];
}
function parseIdsParam(val) {
  if (!val || typeof val !== 'string') return [];
  return uniq(val.split(',').map(s => s.trim()).filter(Boolean));
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
          const sym = TOKEN_MAP[mint]?.symbol || mint;
          const name = TOKEN_MAP[mint]?.name || mint;
          balances[sym] = { balance: uiAmount, display: name, mint };
        } catch {}
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
    balances.SOL = { balance: solAmount, display: 'Solana', mint: MINT_SOL };

    return res.json(balances);
  } catch (err) {
    console.error('Balance fetch error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// DexScreener helpers
async function getDexPriceByPairUSD(pairAddress) {
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
async function getDexPriceByTokenUSD(tokenMint) {
  if (!tokenMint) return null;
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`);
    const j = await r.json();
    const pairs = Array.isArray(j?.pairs) ? j.pairs : [];
    if (!pairs.length) return null;
    // pick the pair with the highest liquidity usd if available
    let best = pairs[0];
    let bestLiq = Number(best?.liquidity?.usd || 0);
    for (const p of pairs) {
      const liq = Number(p?.liquidity?.usd || 0);
      if (liq > bestLiq) { best = p; bestLiq = liq; }
    }
    const priceStr = best?.priceUsd ?? null;
    return safeNumber(priceStr);
  } catch {
    return null;
  }
}

// Token meta via DexScreener best pair
async function getTokenMetaFromDex(mint) {
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
    const j = await r.json();
    const pairs = Array.isArray(j?.pairs) ? j.pairs : [];
    if (!pairs.length) return { mint, symbol: null, name: null };
    let best = pairs[0];
    let bestLiq = Number(best?.liquidity?.usd || 0);
    for (const p of pairs) {
      const liq = Number(p?.liquidity?.usd || 0);
      if (liq > bestLiq) { best = p; bestLiq = liq; }
    }
    const base = best?.baseToken || {};
    return { mint, symbol: base.symbol || null, name: base.name || null };
  } catch {
    return { mint, symbol: null, name: null };
  }
}

// Prices (supports source selection). Default source: DexScreener to align with Dexscreener UI.
// Stronger fallbacks for SOL/USDC to avoid "Error" on frontend.
app.get('/api/prices', async (req, res) => {
  try {
    const idsFromQuery = parseIdsParam(req.query.ids);
    const source = (req.query.source || 'dex').toLowerCase();
    const defaultMints = [MINT_SOL, MINT_USDC];
    const allMints = uniq([...idsFromQuery, ...defaultMints]);

    const prices = {};

    if (source === 'jup') {
      // Jupiter price API v6 first
      try {
        const jupUrl = `https://price.jup.ag/v6/price?ids=${encodeURIComponent(allMints.join(','))}`;
        const jr = await fetch(jupUrl);
        const jj = await jr.json();
        for (const id of allMints) {
          const p = jj?.data?.[id]?.price;
          if (typeof p === 'number') {
            if (id === MINT_SOL) prices['SOL'] = p;
            else if (id === MINT_USDC) prices['USDC'] = p;
            else prices[id] = p;
          }
        }
      } catch {}
      // Fallback to Dex by token for any missing
      await Promise.all(allMints.map(async id => {
        const has = (id === MINT_SOL && typeof prices.SOL === 'number') ||
                    (id === MINT_USDC && typeof prices.USDC === 'number') ||
                    (id !== MINT_SOL && id !== MINT_USDC && typeof prices[id] === 'number');
        if (has) return;
        const p2 = await getDexPriceByTokenUSD(id);
        if (typeof p2 === 'number') {
          if (id === MINT_SOL) prices.SOL = p2;
          else if (id === MINT_USDC) prices.USDC = p2;
          else prices[id] = p2;
        } else {
          if (id === MINT_SOL && typeof prices.SOL !== 'number') prices.SOL = null;
          else if (id === MINT_USDC && typeof prices.USDC !== 'number') prices.USDC = 1.0;
          else if (typeof prices[id] !== 'number') prices[id] = null;
        }
      }));
    } else {
      // DexScreener authoritative path to align with what you see on Dexscreener
      await Promise.all(allMints.map(async id => {
        let p = await getDexPriceByTokenUSD(id);
        if (typeof p !== 'number' && TOKEN_MAP[id]?.pairAddress) {
          p = await getDexPriceByPairUSD(TOKEN_MAP[id].pairAddress);
        }
        if (id === MINT_SOL) prices.SOL = (typeof p === 'number') ? p : null;
        else if (id === MINT_USDC) prices.USDC = (typeof p === 'number') ? p : 1.0;
        else prices[id] = (typeof p === 'number') ? p : null;
      }));
      // Extra safety: if SOL missing, try Jupiter as last resort
      if (typeof prices.SOL !== 'number') {
        try {
          const jr = await fetch(`https://price.jup.ag/v6/price?ids=${MINT_SOL}`);
          const jj = await jr.json();
          const p = jj?.data?.[MINT_SOL]?.price;
          prices.SOL = (typeof p === 'number') ? p : prices.SOL ?? null;
        } catch {}
      }
    }

    if (typeof prices.USDC !== 'number') prices.USDC = 1.0;

    return res.json(prices);
  } catch (err) {
    console.error('Price fetch error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Token metadata endpoint
app.get('/api/token-meta', async (req, res) => {
  const mint = (req.query.mint || '').trim();
  if (!mint) return res.status(400).json({ error: 'mint required' });
  try {
    const meta = await getTokenMetaFromDex(mint);
    return res.json(meta);
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Serve provided images safely via explicit routes (no broad static exposure)
app.get('/assets/pnl', (req, res) => {
  // /workspace/uploads/WhatsApp Image 2025-09-19 at 10.44.01_7bb920df.jpg
  const p = path.join(__dirname, '..', 'WhatsApp Image 2025-09-19 at 10.44.01_7bb920df.jpg');
  res.sendFile(p);
});
app.get('/assets/trade-history-ref', (req, res) => {
  // /workspace/uploads/image.png
  const p = path.join(__dirname, '..', 'image.png');
  res.sendFile(p);
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
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true
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
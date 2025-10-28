// Serverless endpoint to fetch live metal rates (gold/silver) securely
// Env required: VITE_METALPRICE_API_KEY (or METALS_API_KEY fallback)
// Provider: metalpriceapi.com (adjust if you use a different provider)
// Returns per-gram prices in INR for 24K gold (XAU) and silver (XAG), plus 22K derived

const API_KEY =
  (globalThis as any)?.process?.env?.VITE_METALPRICE_API_KEY ||
  (globalThis as any)?.process?.env?.METALS_API_KEY ||
  '';

// Basic in-memory cache for the serverless instance lifetime
let cache: { data: any; ts: number } | null = null;
const TTL_MS = 60 * 1000; // 60 seconds

function ounceToGram(pricePerOunce: number) {
  const OUNCE_TO_GRAM = 31.1034768;
  return pricePerOunce / OUNCE_TO_GRAM;
}

export default async function handler(req: any, res: any) {
  if (req?.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    if (!API_KEY) return res.status(500).json({ error: 'Missing VITE_METALPRICE_API_KEY' });

    const now = Date.now();
    if (cache && now - cache.ts < TTL_MS) {
      return res.status(200).json(cache.data);
    }

    // Metalprice API latest endpoint
    // Strategy: use base=USD to avoid orientation ambiguity, request INR,XAU,XAG
    const url = `https://api.metalpriceapi.com/v1/latest?api_key=${encodeURIComponent(API_KEY)}&base=USD&symbols=INR,XAU,XAG&currencies=INR,XAU,XAG`;
    const resp = await fetch(url);
    if (!resp.ok) {
      const text = await resp.text();
      return res.status(502).json({ error: 'Failed to fetch metals rate', details: text });
    }
    const json = await resp.json();

    const rates = (json?.rates || json?.data?.rates || {}) as Record<string, number>;
    const base = (json?.base || (json as any)?.data?.base || '').toString().toUpperCase();
    const inrxau = Number((rates as any)?.INRXAU || 0); // INR per XAU ounce
    const inrxag = Number((rates as any)?.INRXAG || 0); // INR per XAG ounce
    const inrPerUsd = Number((rates as any)?.INR || 0);
    const xauRaw = Number((rates as any)?.XAU || 0);
    const xagRaw = Number((rates as any)?.XAG || 0);

    let xauPerOunce = 0;
    let xagPerOunce = 0;

    if (inrxau > 0 && inrxag > 0) {
      // Best case: API provided INR per ounce directly
      xauPerOunce = inrxau;
      xagPerOunce = inrxag;
    } else if (base === 'INR') {
      // With base INR, XAU/XAG are usually ounces per INR; invert to INR per ounce
      xauPerOunce = xauRaw > 0 ? (1 / xauRaw) : 0;
      xagPerOunce = xagRaw > 0 ? (1 / xagRaw) : 0;
    } else if (base === 'USD' || (inrPerUsd > 0 && (xauRaw > 0 || xagRaw > 0))) {
      // Compute INR per ounce via base USD: USD/oz * INR/USD
      const xauUsdPerOunce = xauRaw > 10 ? xauRaw : (xauRaw > 0 ? 1 / xauRaw : 0);
      const xagUsdPerOunce = xagRaw > 10 ? xagRaw : (xagRaw > 0 ? 1 / xagRaw : 0);
      xauPerOunce = xauUsdPerOunce > 0 ? xauUsdPerOunce * inrPerUsd : 0;
      xagPerOunce = xagUsdPerOunce > 0 ? xagUsdPerOunce * inrPerUsd : 0;
    }

    if (!xauPerOunce || !xagPerOunce) {
      return res.status(502).json({ error: 'Invalid metals response', raw: json });
    }

    const xauPerGram24K = ounceToGram(xauPerOunce);
    const xagPerGram = ounceToGram(xagPerOunce);

    const data = {
      base: 'INR',
      ts: new Date().toISOString(),
      provider: 'metalpriceapi.com',
      perGram: {
        gold24k: xauPerGram24K,
        gold22k: xauPerGram24K * (22 / 24),
        silver: xagPerGram,
      },
      raw: json,
    };

    cache = { data, ts: now };
    return res.status(200).json(data);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Unexpected error' });
  }
}

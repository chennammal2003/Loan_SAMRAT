import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ''); // load all envs, not only VITE_
  const METALPRICE_KEY = env.VITE_METALPRICE_API_KEY || env.METALS_API_KEY || process.env.VITE_METALPRICE_API_KEY || process.env.METALS_API_KEY || '';

  const metalRatesDevPlugin = (): Plugin => ({
    name: 'metal-rates-dev-plugin',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/metal-rates', async (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }
        try {
          const apiKey = METALPRICE_KEY;
          if (!apiKey) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing VITE_METALPRICE_API_KEY' }));
            return;
          }
          const url = `https://api.metalpriceapi.com/v1/latest?api_key=${encodeURIComponent(apiKey)}&base=INR&symbols=XAU,XAG&currencies=XAU,XAG`;
          const upstream = await fetch(url);
          if (!upstream.ok) {
            const text = await upstream.text();
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Failed to fetch metals rate', details: text }));
            return;
          }
          const json = await upstream.json();
          const OUNCE_TO_GRAM = 31.1034768;
          const anyJson: any = json as any;
          const rates = (anyJson?.rates || anyJson?.data?.rates || {}) as Record<string, number>;
          const base = (anyJson?.base || anyJson?.data?.base || '').toString().toUpperCase();
          const inrxau = Number((rates as any)?.INRXAU || 0);
          const inrxag = Number((rates as any)?.INRXAG || 0);
          const inrPerUsd = Number((rates as any)?.INR || 0);
          const xauRaw = Number((rates as any)?.XAU || 0);
          const xagRaw = Number((rates as any)?.XAG || 0);

          let xauPerOunce = 0;
          let xagPerOunce = 0;
          if (inrxau > 0 && inrxag > 0) {
            xauPerOunce = inrxau;
            xagPerOunce = inrxag;
          } else if (base === 'INR') {
            xauPerOunce = xauRaw > 0 ? (1 / xauRaw) : 0;
            xagPerOunce = xagRaw > 0 ? (1 / xagRaw) : 0;
          } else {
            const xauUsdPerOunce = xauRaw > 10 ? xauRaw : (xauRaw > 0 ? 1 / xauRaw : 0);
            const xagUsdPerOunce = xagRaw > 10 ? xagRaw : (xagRaw > 0 ? 1 / xagRaw : 0);
            xauPerOunce = xauUsdPerOunce > 0 ? xauUsdPerOunce * inrPerUsd : 0;
            xagPerOunce = xagUsdPerOunce > 0 ? xagUsdPerOunce * inrPerUsd : 0;
          }
          if (!xauPerOunce || !xagPerOunce) {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Invalid metals response', raw: json }));
            return;
          }
          const xauPerGram24K = xauPerOunce / OUNCE_TO_GRAM;
          const xagPerGram = xagPerOunce / OUNCE_TO_GRAM;
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
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        } catch (e: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: e?.message || 'Unexpected error' }));
        }
      });
    },
  });

  return {
    plugins: [react(), metalRatesDevPlugin()],
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
  };
});

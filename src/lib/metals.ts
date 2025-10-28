export type MetalRates = {
  base: string;
  ts: string;
  provider: string;
  perGram: {
    gold24k: number;
    gold22k: number;
    silver: number;
  };
};

export async function fetchMetalRates(signal?: AbortSignal): Promise<MetalRates> {
  const res = await fetch('/api/metal-rates', { signal });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch metal rates: ${res.status} ${text}`);
  }
  return res.json();
}

import { afterEach, describe, expect, it, vi } from "vitest";
import { DexScreenerPublicSignalsProvider } from "./index";

const originalFetch = global.fetch;

describe("DexScreenerPublicSignalsProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it("prefers exact base-token matches over quote-token matches", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        pairs: [
          {
            chainId: "solana",
            dexId: "raydium",
            url: "https://example.com/trx-sol",
            pairAddress: "pair-trx-sol",
            baseToken: {
              address: "trx-mint",
              name: "TRON",
              symbol: "TRX"
            },
            quoteToken: {
              address: "sol-mint",
              name: "Solana",
              symbol: "SOL"
            },
            priceUsd: "0.31",
            liquidity: { usd: 950_000 },
            volume: { h24: 2_800_000 },
            marketCap: 2_900_000,
            fdv: 2_900_000
          },
          {
            chainId: "solana",
            dexId: "raydium",
            url: "https://example.com/sol-usdc",
            pairAddress: "pair-sol-usdc",
            baseToken: {
              address: "actual-sol-mint",
              name: "Solana",
              symbol: "SOL"
            },
            quoteToken: {
              address: "usdc-mint",
              name: "USD Coin",
              symbol: "USDC"
            },
            priceUsd: "143.2",
            liquidity: { usd: 2_470_000 },
            volume: { h24: 180_400 },
            marketCap: 68_400_000_000,
            fdv: 68_400_000_000
          }
        ]
      })
    }) as typeof fetch;

    const provider = new DexScreenerPublicSignalsProvider();
    const response = await provider.fetchSignals({
      tokenQuery: "SOL",
      riskMode: "balanced",
      timeHorizon: "mid",
      notes: "",
      walletContext: ""
    });

    expect(response.token.mint).toBe("actual-sol-mint");
    expect(response.token.symbol).toBe("SOL");
    expect(response.market.priceUsd).toBe(143.2);
  });

  it("normalizes invalid negative market cap and fdv values to null", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        pairs: [
          {
            chainId: "solana",
            dexId: "pumpfun",
            url: "https://example.com/spike",
            pairAddress: "pair-spike",
            baseToken: {
              address: "spike-mint",
              name: "Spike",
              symbol: "SPIKE"
            },
            quoteToken: {
              address: "usdc-mint",
              name: "USD Coin",
              symbol: "USDC"
            },
            priceUsd: "0.002904",
            liquidity: { usd: 138_200 },
            volume: { h24: 2_560_000 },
            marketCap: -1,
            fdv: -1
          }
        ]
      })
    }) as typeof fetch;

    const provider = new DexScreenerPublicSignalsProvider();
    const response = await provider.fetchSignals({
      tokenQuery: "SPIKE",
      riskMode: "aggressive",
      timeHorizon: "short",
      notes: "",
      walletContext: ""
    });

    expect(response.market.marketCapUsd).toBeNull();
    expect(response.market.fdvUsd).toBeNull();
  });
});

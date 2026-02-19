import { buildMarketFallback, analyzeSegmentLocal } from "./engine.js";

export async function fetchMarket(ticker) {
  try {
    const res = await fetch("/api/market", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { success, data, error } = await res.json();
    if (!success || !data) throw new Error(error || "No data");
    return { data, source: "ai" };
  } catch {
    return { data: buildMarketFallback(ticker), source: "fallback" };
  }
}

export async function analyzeSegment(segment, transcript, market, priorScore) {
  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ segment, transcript, market, priorScore }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { success, analysis, error } = await res.json();
    if (!success || !analysis) throw new Error(error || "No analysis");
    return { analysis, source: "ai" };
  } catch {
    return { analysis: analyzeSegmentLocal(segment, market, priorScore), source: "fallback" };
  }
}

export async function checkHealth() {
  try {
    const res = await fetch("/api/health");
    const data = await res.json();
    return data.ok && data.hasKey;
  } catch {
    return false;
  }
}

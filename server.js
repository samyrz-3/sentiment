import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(cors());
app.use(express.json());

// Serve the frontend
app.use(express.static(path.join(__dirname, "public")));

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ ok: true, hasKey: !!process.env.ANTHROPIC_API_KEY });
});

// ── Market context ────────────────────────────────────────────────────────────
app.post("/api/market", async (req, res) => {
  const { ticker } = req.body;
  if (!ticker) return res.status(400).json({ error: "ticker required" });

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{
        role: "user",
        content: `Return analyst consensus data for ${ticker} as a single raw JSON object, no markdown, no explanation. Structure:
{"ticker":"${ticker}","epsConsensus":2.45,"revenueConsensus":4.2,"revenueUnit":"B","priceTargetLow":185,"priceTargetAvg":224,"priceTargetHigh":290,"analystBuy":28,"analystHold":8,"analystSell":3,"shortInterest":"4.2%","streetSentiment":"cautiously optimistic","keyWatchPoints":["Guidance","Revenue","Margins","FCF"],"recentHeadlines":["Headline 1","Headline 2","Headline 3"]}`
      }]
    });

    const raw = msg.content[0].text.replace(/```json|```/gi, "").trim();
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { const m = raw.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : null; }

    if (!parsed) throw new Error("Parse failed");
    res.json({ success: true, data: parsed });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Sentiment analysis ────────────────────────────────────────────────────────
app.post("/api/analyze", async (req, res) => {
  const { segment, transcript, market, priorScore } = req.body;
  if (!segment || !market) return res.status(400).json({ error: "missing fields" });

  const prompt = `You are a buy-side analyst. Analyze this earnings call segment. Return ONLY a JSON object, no markdown.

${market.ticker} context: EPS est $${market.epsConsensus} | Rev est $${market.revenueConsensus}${market.revenueUnit} | ${market.analystBuy}B/${market.analystHold}H/${market.analystSell}S | ${market.streetSentiment} | Watch: ${(market.keyWatchPoints||[]).slice(0,3).join(", ")} | Prior score: ${priorScore||0}

${segment.speaker}: "${segment.text}"
Context: ${(transcript||"").slice(-500)}

Return this JSON with real values:
{"overallSentiment":"BULLISH","sentimentScore":45,"vsExpectations":"BEAT","confidence":80,"priceActionBias":"BUY","estimatedMove":"+2-4%","flags":[{"type":"BEAT","speaker":"${segment.speaker}","quote":"short quote","insight":"investor interpretation","impact":"HIGH","category":"Revenue"}],"metrics":{"guidanceQuality":60,"managementCredibility":75,"transparencyScore":70,"forwardMomentum":50,"riskSignals":30},"vsConsensus":{"eps":"BEAT","revenue":"BEAT","guidance":"INLINE","margins":"MISS"},"keyThemes":["theme1","theme2"],"redFlags":["risk1"],"analystTakeaway":"Two sentence summary."}

Rules: overallSentiment=BULLISH/BEARISH/NEUTRAL, priceActionBias=STRONG_BUY/BUY/HOLD/SELL/STRONG_SELL, sentimentScore=-100 to 100.`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }]
    });

    const raw = msg.content[0].text.replace(/```json|```/gi, "").trim();
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { const m = raw.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : null; }

    if (!parsed) throw new Error("Parse failed");
    res.json({ success: true, analysis: parsed });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fallback to index.html for all other routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Earnings Signal running on http://localhost:${PORT}`);
  console.log(`API key: ${process.env.ANTHROPIC_API_KEY ? "✓ set" : "✗ missing — add to .env"}`);
});

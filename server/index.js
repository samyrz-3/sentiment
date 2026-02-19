import "dotenv/config";
import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";

const app = express();
const PORT = process.env.PORT || 3001;
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true, hasKey: !!process.env.ANTHROPIC_API_KEY });
});

app.post("/api/market", async (req, res) => {
  const { ticker } = req.body;
  if (!ticker) return res.status(400).json({ error: "ticker required" });
  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{
        role: "user",
        content: `Return realistic analyst consensus data for stock ticker ${ticker} as a single JSON object, no explanation, no markdown. Use this exact structure:
{"ticker":"${ticker}","epsConsensus":2.45,"revenueConsensus":4.2,"revenueUnit":"B","priceTargetLow":185,"priceTargetAvg":224,"priceTargetHigh":290,"analystBuy":28,"analystHold":8,"analystSell":3,"shortInterest":"4.2%","streetSentiment":"cautiously optimistic","keyWatchPoints":["Guidance quality","Revenue growth","Margins","FCF"],"recentHeadlines":["Analysts flag margin risk","Street expects conservative guidance","Key metrics watched closely"]}`
      }]
    });
    const raw = msg.content[0].text.replace(/```json/gi, "").replace(/```/g, "").trim();
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { const m = raw.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : null; }
    if (!parsed) return res.status(500).json({ error: "Failed to parse market data" });
    res.json({ success: true, data: parsed });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/analyze", async (req, res) => {
  const { segment, transcript, market, priorScore } = req.body;
  if (!segment || !market) return res.status(400).json({ error: "segment and market required" });

  const prompt = `You are a buy-side analyst AI. Analyze this earnings call segment versus analyst expectations. Return ONLY a JSON object, no markdown, no explanation.

Market context for ${market.ticker}:
EPS consensus: $${market.epsConsensus} | Revenue: $${market.revenueConsensus}${market.revenueUnit}
Ratings: ${market.analystBuy} Buy / ${market.analystHold} Hold / ${market.analystSell} Sell
Sentiment: ${market.streetSentiment} | Watch: ${(market.keyWatchPoints || []).slice(0, 3).join(", ")}
Prior call score: ${priorScore || 0}

Segment — ${segment.speaker}: "${segment.text}"
Recent context: ${(transcript || "").slice(-600)}

Return only this JSON (real values from the transcript):
{"overallSentiment":"BULLISH","sentimentScore":45,"vsExpectations":"BEAT","confidence":80,"priceActionBias":"BUY","estimatedMove":"+2-4%","flags":[{"type":"BEAT","speaker":"CEO","quote":"short quote under 100 chars","insight":"what this means for investors","impact":"HIGH","category":"Revenue"}],"metrics":{"guidanceQuality":60,"managementCredibility":75,"transparencyScore":70,"forwardMomentum":50,"riskSignals":30},"vsConsensus":{"eps":"BEAT","revenue":"BEAT","guidance":"INLINE","margins":"MISS"},"keyThemes":["AI growth","Margin pressure"],"redFlags":["FCF below target"],"analystTakeaway":"Two sentence institutional summary."}

Rules: overallSentiment=BULLISH/BEARISH/NEUTRAL, vsExpectations=BEAT/MISS/INLINE, priceActionBias=STRONG_BUY/BUY/HOLD/SELL/STRONG_SELL, sentimentScore=-100 to 100.`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }]
    });
    const raw = msg.content[0].text.replace(/```json/gi, "").replace(/```/g, "").trim();
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { const m = raw.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : null; }
    if (!parsed) return res.status(500).json({ error: "Failed to parse analysis", raw });
    res.json({ success: true, analysis: parsed });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => console.log(`✓ Server on port ${PORT}`));

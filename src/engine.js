export function buildMarketFallback(ticker) {
  const t = ticker.toUpperCase();
  const presets = {
    NVDA: { epsConsensus: 5.59, revenueConsensus: 32.5, revenueUnit: "B", priceTargetLow: 100, priceTargetAvg: 164, priceTargetHigh: 220, analystBuy: 38, analystHold: 5, analystSell: 1, shortInterest: "1.8%", streetSentiment: "strongly bullish", keyWatchPoints: ["Data center revenue", "Blackwell GPU ramp", "China export controls", "Gross margin trajectory"], recentHeadlines: ["Analysts raise PT on AI demand surge", "Blackwell supply bottlenecks flagged", "AMD competition intensifying"] },
    MSFT: { epsConsensus: 3.10, revenueConsensus: 69.0, revenueUnit: "B", priceTargetLow: 380, priceTargetAvg: 472, priceTargetHigh: 550, analystBuy: 42, analystHold: 4, analystSell: 1, shortInterest: "0.6%", streetSentiment: "bullish", keyWatchPoints: ["Azure growth rate", "Copilot monetization", "Operating margins", "OpenAI returns"], recentHeadlines: ["Azure growth key swing factor", "Copilot adoption closely tracked", "Operating leverage expected"] },
    AAPL: { epsConsensus: 2.35, revenueConsensus: 124.0, revenueUnit: "B", priceTargetLow: 175, priceTargetAvg: 232, priceTargetHigh: 300, analystBuy: 28, analystHold: 14, analystSell: 4, shortInterest: "0.8%", streetSentiment: "cautiously optimistic", keyWatchPoints: ["iPhone demand", "Services growth", "India expansion", "AI adoption"], recentHeadlines: ["iPhone upgrade cycle tied to AI", "Services accelerating", "India as China hedge"] },
    AMZN: { epsConsensus: 1.36, revenueConsensus: 187.0, revenueUnit: "B", priceTargetLow: 185, priceTargetAvg: 240, priceTargetHigh: 290, analystBuy: 46, analystHold: 3, analystSell: 0, shortInterest: "0.7%", streetSentiment: "bullish", keyWatchPoints: ["AWS re-acceleration", "Advertising revenue", "Retail margins", "AI services"], recentHeadlines: ["AWS re-acceleration is bull catalyst", "Ad revenue outpacing consensus", "Retail margin expansion on track"] },
  };
  return {
    ticker: t,
    ...(presets[t] ?? { epsConsensus: 2.45, revenueConsensus: 4.2, revenueUnit: "B", priceTargetLow: 185, priceTargetAvg: 224, priceTargetHigh: 290, analystBuy: 28, analystHold: 8, analystSell: 3, shortInterest: "4.2%", streetSentiment: "cautiously optimistic", keyWatchPoints: ["Revenue growth", "Margin trajectory", "Guidance quality", "FCF"], recentHeadlines: ["Street expects in-line results", "Margin trajectory key debate", "Guidance credibility will be tested"] }),
  };
}

const LEXICON = {
  strongBullish: ["record","exceeded","beat","surpassed","accelerating","outperformed","raised guidance","strong demand","robust","exceptional","significant growth","ahead of","well above","above expectations","breakthrough","all-time high"],
  bullish: ["growth","increased","improved","positive","confident","optimistic","gaining","opportunity","strength","solid","healthy","progress","on track","performing well","pleased","excited","favorable","encouraging","delivered"],
  bearish: ["declined","decreased","miss","below","challenging","headwind","uncertain","pressure","weakness","softness","difficult","cautious","concern","risk","impacted","lower than","reduced","disappointing","slowed"],
  strongBearish: ["significant miss","significant decline","major concern","severe","well below","significantly below","major headwind","cut guidance","lowered guidance","withdrew guidance"],
  guidance: ["guidance","outlook","forecast","expecting","anticipate","project","full year","next quarter","fiscal year"],
  beat: ["beat","exceeded","above","ahead of","surpassed","record","better than expected","above consensus","outperformed"],
  miss: ["miss","below","fell short","disappointed","came in below","under","weaker than","less than expected"],
  eps: ["eps","earnings per share","net income","profit","bottom line","earnings"],
  revenue: ["revenue","sales","top line","bookings","billings","arr"],
  margin: ["margin","gross margin","operating margin","ebitda","profitability"],
  churn: ["churn","retention","attrition","customer loss"],
  ai: ["ai","artificial intelligence","machine learning","generative","agentic","copilot"],
  macro: ["macro","economy","recession","interest rate","inflation","tariff","currency"],
  capex: ["capex","capital expenditure","data center","buildout"],
  fcf: ["free cash flow","fcf","cash generation"],
};

const hasAny = (text, words) => words.some(w => text.toLowerCase().includes(w));
const countAny = (text, words) => words.filter(w => text.toLowerCase().includes(w)).length;

function detectCategory(text) {
  if (hasAny(text, LEXICON.ai)) return "AI/Tech";
  if (hasAny(text, LEXICON.fcf)) return "Cash Flow";
  if (hasAny(text, LEXICON.margin)) return "Margins";
  if (hasAny(text, LEXICON.revenue)) return "Revenue";
  if (hasAny(text, LEXICON.eps)) return "EPS";
  if (hasAny(text, LEXICON.churn)) return "Churn";
  if (hasAny(text, LEXICON.guidance)) return "Guidance";
  if (hasAny(text, LEXICON.macro)) return "Macro";
  if (hasAny(text, LEXICON.capex)) return "CapEx";
  return "Other";
}

function extractQuote(text) {
  const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
  let best = sentences[0], bestScore = -999;
  for (const s of sentences) {
    const sc = countAny(s, [...LEXICON.strongBullish, ...LEXICON.bullish, ...LEXICON.strongBearish, ...LEXICON.bearish]) * 10 + (s.length > 20 ? 5 : 0);
    if (sc > bestScore) { bestScore = sc; best = s; }
  }
  return best.trim().slice(0, 110);
}

export function analyzeSegmentLocal(seg, market, priorScore) {
  const text = seg.text;
  const tl = text.toLowerCase();
  let score = 0;
  score += countAny(text, LEXICON.strongBullish) * 18;
  score += countAny(text, LEXICON.bullish) * 7;
  score -= countAny(text, LEXICON.bearish) * 7;
  score -= countAny(text, LEXICON.strongBearish) * 18;
  score = Math.max(-100, Math.min(100, score));

  const isBeat = hasAny(text, LEXICON.beat);
  const isMiss = hasAny(text, LEXICON.miss);
  const hasGuidance = hasAny(text, LEXICON.guidance);
  const hasMargin = hasAny(text, LEXICON.margin);
  const hasRevenue = hasAny(text, LEXICON.revenue);
  const hasEPS = hasAny(text, LEXICON.eps);
  const hasAI = hasAny(text, LEXICON.ai);
  const hasChurn = hasAny(text, LEXICON.churn);
  const hasMacro = hasAny(text, LEXICON.macro);
  const hasFCF = hasAny(text, LEXICON.fcf);
  const hasHedge = hasAny(tl, ["however","but","although","despite","uncertain","cautious","headwind","risk"]);

  const flags = [];
  if (isBeat && (hasRevenue || hasEPS || hasGuidance || hasAI)) {
    const cat = hasRevenue ? "Revenue" : hasEPS ? "EPS" : hasGuidance ? "Guidance" : "AI/Tech";
    flags.push({ type: "BEAT", speaker: seg.speaker, quote: extractQuote(text), insight: `${cat} outperformance vs consensus — primary bull catalyst.`, impact: "HIGH", category: cat });
  } else if (isMiss && (hasRevenue || hasEPS || hasGuidance || hasMargin || hasFCF || hasChurn)) {
    const cat = hasGuidance ? "Guidance" : hasMargin ? "Margins" : hasFCF ? "Cash Flow" : hasChurn ? "Churn" : "Revenue";
    flags.push({ type: "MISS", speaker: seg.speaker, quote: extractQuote(text), insight: `${cat} shortfall increases earnings risk for coming quarters.`, impact: "HIGH", category: cat });
  }
  if (hasAI && !isMiss && score > 5) flags.push({ type: "POSITIVE", speaker: seg.speaker, quote: extractQuote(text), insight: "AI segment strength — key long-term re-rating driver.", impact: "MEDIUM", category: "AI/Tech" });
  if (hasMacro && hasHedge) flags.push({ type: "WARNING", speaker: seg.speaker, quote: extractQuote(text), insight: "Macro headwind flagged — watch for estimate revisions.", impact: "MEDIUM", category: "Macro" });
  if (hasChurn) flags.push({ type: isMiss ? "MISS" : "WARNING", speaker: seg.speaker, quote: extractQuote(text), insight: "Elevated churn is a leading indicator of revenue deceleration.", impact: "HIGH", category: "Churn" });
  if (hasHedge && !isBeat && flags.length === 0) flags.push({ type: "HEDGE", speaker: seg.speaker, quote: extractQuote(text), insight: "Hedged language signals management uncertainty.", impact: "LOW", category: detectCategory(text) });
  if (score > 15 && flags.length === 0) flags.push({ type: "BULLISH", speaker: seg.speaker, quote: extractQuote(text), insight: `Strong positive language on ${detectCategory(text)}.`, impact: "MEDIUM", category: detectCategory(text) });
  if (score < -15 && flags.length === 0) flags.push({ type: "BEARISH", speaker: seg.speaker, quote: extractQuote(text), insight: `Negative sentiment on ${detectCategory(text)} adds downside risk.`, impact: "MEDIUM", category: detectCategory(text) });

  const bullishCount = countAny(text, [...LEXICON.strongBullish, ...LEXICON.bullish]);
  const bearishCount = countAny(text, [...LEXICON.strongBearish, ...LEXICON.bearish]);
  const combinedScore = Math.round(priorScore * 0.35 + score * 0.65);
  const overallSentiment = combinedScore > 15 ? "BULLISH" : combinedScore < -15 ? "BEARISH" : "NEUTRAL";
  const vsExpectations = flags.some(f => f.type === "BEAT") ? "BEAT" : flags.some(f => f.type === "MISS") ? "MISS" : "INLINE";
  const priceActionBias = combinedScore > 40 ? "STRONG_BUY" : combinedScore > 15 ? "BUY" : combinedScore < -40 ? "STRONG_SELL" : combinedScore < -15 ? "SELL" : "HOLD";

  return {
    overallSentiment, sentimentScore: combinedScore,
    vsExpectations, confidence: Math.min(92, Math.max(40, 55 + Math.abs(score) / 2)),
    priceActionBias, estimatedMove: combinedScore > 40 ? "+5-8%" : combinedScore > 20 ? "+2-5%" : combinedScore < -40 ? "-5-8%" : combinedScore < -20 ? "-2-5%" : "±1-2%",
    flags,
    metrics: {
      guidanceQuality: hasGuidance ? (isBeat ? 75 : isMiss ? 25 : 50) : 50,
      managementCredibility: Math.min(95, Math.max(20, 65 + bullishCount * 4 - bearishCount * 5)),
      transparencyScore: Math.min(95, Math.max(20, 60 + (hasGuidance ? 10 : 0) + bullishCount * 2)),
      forwardMomentum: Math.max(-100, Math.min(100, score + (isBeat ? 20 : 0) - (isMiss ? 20 : 0))),
      riskSignals: Math.min(95, Math.max(5, 20 + bearishCount * 8 + (hasChurn ? 15 : 0) + (isMiss ? 20 : 0))),
    },
    vsConsensus: {
      eps: hasEPS ? (isBeat ? "BEAT" : isMiss ? "MISS" : "INLINE") : "UNKNOWN",
      revenue: hasRevenue ? (isBeat ? "BEAT" : isMiss ? "MISS" : "INLINE") : "UNKNOWN",
      guidance: hasGuidance ? (isBeat ? "BEAT" : isMiss ? "MISS" : "INLINE") : "UNKNOWN",
      margins: hasMargin ? (isMiss ? "MISS" : score > 0 ? "BEAT" : "INLINE") : "UNKNOWN",
    },
    keyThemes: [hasAI && "AI/Automation", hasRevenue && isBeat && "Revenue Beat", hasMargin && "Margin Focus", hasGuidance && (isBeat ? "Guidance Raise" : isMiss ? "Guidance Cut" : "Guidance In-Line"), hasMacro && "Macro Uncertainty"].filter(Boolean).slice(0, 4),
    redFlags: [hasChurn && "Elevated churn", hasFCF && isMiss && "FCF miss", hasMargin && isMiss && "Margin compression", hasGuidance && isMiss && "Guidance cut", hasMacro && hasHedge && "Macro headwind"].filter(Boolean).slice(0, 3),
    analystTakeaway: overallSentiment === "BULLISH"
      ? `${seg.speaker} commentary signals outperformance — constructive tone supports the bull thesis. ${flags[0] ? flags[0].insight : ""}`
      : overallSentiment === "BEARISH"
      ? `${seg.speaker} remarks introduce downside risk. Monitor closely for estimate revision risk.`
      : `${seg.speaker} tone is measured with mixed signals. No clear directional bias detected.`,
  };
}

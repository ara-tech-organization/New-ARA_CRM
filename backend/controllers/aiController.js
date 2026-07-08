// AI-powered campaign performance analysis using Google Gemini.
//
// The frontend sends a snapshot of a single client's Google or Meta
// campaign performance; we shape it into a structured analyst prompt,
// call Gemini's REST API, and return the parsed JSON insights the UI
// renders in the AI Insights panel.
//
// The Gemini API key lives in process.env.GEMINI_API_KEY — never
// hard-coded, never committed. When the key is absent we return 503
// with a clear message instead of a crash so the UI can degrade
// gracefully.

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-1.5-flash';

// Deterministic INR formatting used inside the prompt so the model
// receives well-formed numbers instead of raw JS floats like 1234.5678.
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const num = (n) => Number(n || 0).toLocaleString('en-IN');
const pct = (n) => `${Number(n || 0).toFixed(2)}%`;

// Build the analyst prompt. Keeping the instruction and the data
// visually separated makes it easier for the model to follow the
// output contract, and easier for us to tweak either side later.
const buildPrompt = ({ platform, clientName, dateRange, summary, campaigns }) => {
  const platformLabel = platform === 'meta' ? 'Meta Ads (Facebook & Instagram)' : 'Google Ads';
  const range = dateRange?.from && dateRange?.to
    ? `${dateRange.from} to ${dateRange.to}`
    : 'the reporting period';

  const s = summary || {};
  const spend = s.spend ?? s.totalCost ?? 0;
  const leads = s.leads ?? s.total_leads ?? s.totalConversions ?? 0;
  const impressions = s.impressions ?? s.totalImpressions ?? 0;
  const clicks = s.clicks ?? s.totalClicks ?? 0;
  const ctr = s.ctr ?? (impressions > 0 ? (clicks / impressions) * 100 : 0);
  const cpc = s.cpc ?? (clicks > 0 ? spend / clicks : 0);
  const cpl = s.cpl ?? s.cpa ?? (leads > 0 ? spend / leads : 0);
  const conversions = s.conversions ?? s.totalConversions ?? leads;

  const summaryBlock = [
    `- Total ad spend: ${inr(spend)}`,
    `- Total leads: ${num(leads)}`,
    `- Cost per Lead (CPL): ${inr(cpl)}`,
    `- Impressions: ${num(impressions)}`,
    `- Clicks: ${num(clicks)}`,
    `- Click-through rate (CTR): ${pct(ctr)}`,
    `- Cost per Click (CPC): ${inr(cpc)}`,
    `- Conversions: ${num(conversions)}`,
  ].join('\n');

  const campaignsBlock = Array.isArray(campaigns) && campaigns.length
    ? campaigns.slice(0, 10).map((c, i) => (
      `${i + 1}. "${c.name || c.campaign_name || 'Unnamed'}" — `
      + `Spend ${inr(c.cost ?? c.spend ?? 0)}, `
      + `Clicks ${num(c.clicks ?? 0)}, `
      + `Conversions ${num(c.conversions ?? c.leads ?? 0)}, `
      + `CPL ${inr(c.cpl ?? c.cost_per_conv ?? 0)}, `
      + `CTR ${pct(c.ctr ?? 0)}`
    )).join('\n')
    : '(no campaign-level breakdown provided)';

  return [
    `You are a senior digital marketing analyst reviewing paid ad performance for one of an ad agency's clients. The agency runs Meta Ads and Google Ads for cosmetic and dermatology clinics in India. Currency is INR. Speak in clear, actionable language a marketing team can implement this week.`,
    ``,
    `CLIENT: ${clientName || 'the client'}`,
    `PLATFORM: ${platformLabel}`,
    `DATE RANGE: ${range}`,
    ``,
    `PERFORMANCE SUMMARY:`,
    summaryBlock,
    ``,
    `CAMPAIGN BREAKDOWN (up to top 10 campaigns):`,
    campaignsBlock,
    ``,
    `Your task: analyse the performance above and return a JSON object (no markdown, no code fences, no prose outside the JSON) with EXACTLY these keys:`,
    `{`,
    `  "summary": "2 to 3 sentences describing overall performance in plain English",`,
    `  "grade": "A | B | C | D | F — a letter grade for the overall performance",`,
    `  "strengths": ["three specific things that are working, each a single sentence"],`,
    `  "improvements": ["three specific weaknesses or inefficiencies, each a single sentence"],`,
    `  "strategies": ["five actionable strategies to increase leads and lower CPL, each a single sentence starting with a verb"],`,
    `  "urgent": ["zero to three critical red-flag items requiring immediate attention, each a single sentence; empty array if none"],`,
    `  "kpis_to_watch": ["three metrics the team should track this week, each a single sentence"]`,
    `}`,
    ``,
    `Rules:`,
    `- Base every statement on the numbers above. Do NOT invent metrics.`,
    `- If any strategy needs a spend or bid change, say roughly how much (e.g. "raise the budget by ~30%").`,
    `- If leads are zero or CPL is unusually high, put a red-flag item in "urgent".`,
    `- Return ONLY the JSON. No markdown fences. No commentary before or after.`,
  ].join('\n');
};

// Robust JSON extraction — handles three failure modes:
//   1. Gemini wraps output in a ```json``` fence despite instructions.
//   2. Gemini adds prose either side of the JSON block.
//   3. The response gets truncated by maxOutputTokens mid-array or
//      mid-string; we repair by closing whatever's still open so at
//      least the fields that DID come through are usable.
const extractJson = (text) => {
  if (!text || typeof text !== 'string') return null;
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace === -1) return null;
  let slice = cleaned.slice(firstBrace);
  // Fast path — the whole thing already parses.
  try { return JSON.parse(slice); } catch { /* fall through to repair */ }
  // Repair path — trim any trailing junk and rebalance braces/brackets/quotes.
  const lastBrace = slice.lastIndexOf('}');
  if (lastBrace !== -1 && lastBrace > 0) {
    try { return JSON.parse(slice.slice(0, lastBrace + 1)); } catch { /* keep repairing */ }
  }
  const repaired = repairTruncatedJson(slice);
  if (repaired) {
    try { return JSON.parse(repaired); } catch { return null; }
  }
  return null;
};

// Walk the string tracking depth of {}, [], and open strings. When we
// hit the end of the input mid-way through something, emit the closers
// needed to make the JSON parseable. Handles the common truncation
// pattern where Gemini cuts off inside a string in the middle of a
// strengths / strategies array.
const repairTruncatedJson = (input) => {
  let inString = false;
  let escape = false;
  const stack = [];
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' && stack[stack.length - 1] === '{') stack.pop();
    else if (ch === ']' && stack[stack.length - 1] === '[') stack.pop();
  }
  let out = input;
  // Trim a dangling comma/colon so the JSON stays syntactically valid.
  out = out.replace(/[,\s]*$/, '');
  // If we stopped mid-string, close the string.
  if (inString) out += '"';
  // Close any open arrays and objects, in reverse order.
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    out += stack[i] === '{' ? '}' : ']';
  }
  return out;
};

// Validate + normalise the model's response so the frontend can trust
// every field to be the expected type.
const normaliseInsights = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const arrOf = (v) => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : []);
  return {
    summary: raw.summary ? String(raw.summary) : '',
    grade: raw.grade ? String(raw.grade).trim().slice(0, 2).toUpperCase() : '',
    strengths: arrOf(raw.strengths).slice(0, 6),
    improvements: arrOf(raw.improvements).slice(0, 6),
    strategies: arrOf(raw.strategies).slice(0, 8),
    urgent: arrOf(raw.urgent).slice(0, 6),
    kpis_to_watch: arrOf(raw.kpis_to_watch).slice(0, 6),
  };
};

export const analyzeCampaign = async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'REPLACE_WITH_YOUR_NEW_KEY') {
    return res.status(503).json({
      success: false,
      message: 'AI service not configured — set GEMINI_API_KEY in the backend environment.',
    });
  }

  const { platform, clientName, dateRange, summary, campaigns } = req.body || {};
  if (!platform || !summary) {
    return res.status(400).json({
      success: false,
      message: 'platform and summary are required in the request body.',
    });
  }
  if (platform !== 'google' && platform !== 'meta') {
    return res.status(400).json({
      success: false,
      message: 'platform must be either "google" or "meta".',
    });
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const prompt = buildPrompt({ platform, clientName, dateRange, summary, campaigns });

  const geminiUrl = `${GEMINI_ENDPOINT}/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      // Low temperature keeps the analyst voice measured; a small
      // amount of variability still helps the model pick different
      // phrasings across repeat runs.
      temperature: 0.4,
      topP: 0.9,
      // 1500 tokens was hitting the cap on Gemini 2.5-flash, which
      // burns some budget on internal reasoning before writing. 4096
      // is enough headroom for the full seven-section JSON with no
      // truncation, and still bounded so a runaway response can't
      // blow the budget.
      maxOutputTokens: 4096,
      // Nudge the model toward structured JSON.
      responseMimeType: 'application/json',
    },
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const upstream = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!upstream.ok) {
      const errBody = await upstream.text().catch(() => '');
      console.error('Gemini error:', upstream.status, errBody.slice(0, 500));
      return res.status(502).json({
        success: false,
        message: `Gemini API returned ${upstream.status}. Check the backend log for details.`,
      });
    }

    const data = await upstream.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = normaliseInsights(extractJson(rawText));

    if (!parsed) {
      return res.status(502).json({
        success: false,
        message: 'AI response could not be parsed. Please try again.',
        raw: rawText.slice(0, 500),
      });
    }

    res.json({
      success: true,
      platform,
      model,
      generatedAt: new Date().toISOString(),
      insights: parsed,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      return res.status(504).json({
        success: false,
        message: 'AI request timed out. Please try again.',
      });
    }
    console.error('analyzeCampaign error:', err);
    res.status(500).json({
      success: false,
      message: err?.message || 'Unexpected error during AI analysis.',
    });
  }
};

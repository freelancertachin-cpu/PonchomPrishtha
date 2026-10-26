const MODEL = process.env.OPENAI_MODEL || 'gpt-5-mini';
const WINDOW_MS = 60_000;
const LIMIT = 12;
const hits = new Map(); // Best-effort per-instance throttle; add platform-level rate limiting for public/high-traffic use.

function replyError(res, status, error) { return res.status(status).json({ error }); }
function limited(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const row = hits.get(ip);
  if (!row || now - row.start >= WINDOW_MS) { hits.set(ip, { start: now, count: 1 }); return false; }
  row.count += 1;
  return row.count > LIMIT;
}
function parseJson(text) {
  const clean = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(clean);
}
function extractOutput(data) {
  if (typeof data?.output_text === 'string') return data.output_text;
  return (data?.output || []).flatMap(item => item.content || []).filter(part => part.type === 'output_text').map(part => part.text || '').join('\n').trim();
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return replyError(res, 405, 'শুধু POST অনুরোধ গ্রহণ করা হয়।');
  if (!process.env.OPENAI_API_KEY) return replyError(res, 500, 'Vercel-এ OPENAI_API_KEY সেট করা হয়নি।');
  if (limited(req)) return replyError(res, 429, 'অনেক দ্রুত অনুরোধ করা হয়েছে। এক মিনিট পরে আবার চেষ্টা করো।');

  try {
    const body = req.body || {};
    const text = typeof body.text === 'string' ? body.text.trim().slice(0, 2000) : '';
    const mood = typeof body.mood === 'string' ? body.mood.slice(0, 80) : 'আনন্দ';
    const moodIndex = Number.isInteger(Number(body.moodIndex)) ? Math.max(0, Math.min(15, Number(body.moodIndex))) : 0;
    const lang = ['bn', 'bs', 'en'].includes(body.lang) ? body.lang : 'bn';
    const length = ['short', 'any', 'long'].includes(body.length) ? body.length : 'any';
    const emoji = body.emoji !== false;
    const langName = ({ bn: 'স্বাভাবিক, সাবলীল বাংলা', bs: 'Banglish (Bengali written in Latin letters)', en: 'natural English' })[lang];
    const lengthName = ({ short: 'একটি ছোট বাক্য', any: 'মাঝারি, ১–২ বাক্য', long: 'দীর্ঘ, ২–৪ বাক্য' })[length];
    const prompt = `তুমি পঞ্চম পৃষ্ঠা নামের সামাজিক-মাধ্যম ক্যাপশন লেখার সহকারী। নিচের শর্তে ঠিক ৩টি আলাদা, স্বাভাবিক ও ব্যবহারযোগ্য ক্যাপশন তৈরি করো। ভাষা: ${langName}. মুড: ${mood}. ব্যবহারকারীর প্রসঙ্গ: ${text || 'নির্বাচিত মুড অনুযায়ী একটি উপযুক্ত ক্যাপশন লেখো।'}. দৈর্ঘ্য: ${lengthName}. ${emoji ? 'প্রাসঙ্গিক হলে পরিমিত ইমোজি ব্যবহার করো।' : 'ইমোজি ব্যবহার করবে না।'} ব্যবহারকারী দেয়নি এমন ঘটনা বা তথ্য বানিয়ে লিখবে না। শুধু এই JSON ফেরত দাও: {"captions":["...","...","..."]}. Markdown বা ব্যাখ্যা দেবে না।`;
    const upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: MODEL, input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }], text: { format: { type: 'json_object' } }, max_output_tokens: 700 })
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error('OpenAI API returned status', upstream.status, data?.error?.code || 'unknown');
      return replyError(res, 502, 'OpenAI API অনুরোধ ব্যর্থ হয়েছে। API Key, মডেল ও API billing/limit পরীক্ষা করো।');
    }
    const parsed = parseJson(extractOutput(data));
    const captions = Array.isArray(parsed.captions) ? parsed.captions.filter(v => typeof v === 'string' && v.trim()).slice(0, 3) : [];
    if (!captions.length) throw new Error('No captions in model response');
    return res.status(200).json({ out: captions.map(t => ({ t: t.trim().slice(0, 1500), m: moodIndex, l: lang })), left: 0, provider: 'openai' });
  } catch (err) {
    console.error('OpenAI caption function error:', err?.message || err);
    return replyError(res, 500, 'AI ক্যাপশন তৈরি করা যায়নি। আবার চেষ্টা করো।');
  }
};

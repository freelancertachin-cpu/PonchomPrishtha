const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const WINDOW_MS = 60_000;
const LIMIT = 8;
const hits = new Map();
function replyError(res, status, error) { return res.status(status).json({ error }); }
function limited(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') || req.socket?.remoteAddress || 'unknown';
  const now = Date.now(); const row = hits.get(ip);
  if (!row || now - row.start >= WINDOW_MS) { hits.set(ip, { start: now, count: 1 }); return false; }
  row.count += 1; return row.count > LIMIT;
}
function extractText(data) { return (data?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('\n').trim(); }
function parseJson(text) { return JSON.parse(String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()); }

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return replyError(res, 405, 'শুধু POST অনুরোধ গ্রহণ করা হয়।');
  if (!process.env.GEMINI_API_KEY) return replyError(res, 500, 'Vercel-এ GEMINI_API_KEY সেট করা হয়নি।');
  if (limited(req)) return replyError(res, 429, 'অনেক দ্রুত অনুরোধ করা হয়েছে। এক মিনিট পরে আবার চেষ্টা করো।');
  try {
    const { category = '', lang = 'bn', perPhoto = false, images = [] } = req.body || {};
    if (!Array.isArray(images) || images.length < 1 || images.length > 6) return replyError(res, 400, '১ থেকে ৬টি ছবি দিতে হবে।');
    const langName = ({ bn: 'স্বাভাবিক, সাবলীল বাংলা', bs: 'Banglish (Bengali written in Latin letters)', en: 'natural English' })[lang] || 'স্বাভাবিক, সাবলীল বাংলা';
    const parts = [{ text: `Analyze these user-uploaded photos and create natural social-media captions. Return ONLY valid JSON with this exact shape: {"detected_vibe":"short phrase","main_post_caption":"caption for all photos","hashtags":["#tag"],"individual_captions":[{"photo_index":1,"caption":"caption"}]}. Output language: ${langName}. Selected category: ${String(category || 'automatically determine from photos').slice(0,80)}. Be specific only about visible content. Do not identify people, infer sensitive traits, or invent facts. Return 4-8 relevant hashtags. ${perPhoto ? 'Return one distinct caption per photo, with photo_index starting at 1 and matching image order.' : 'Set individual_captions to an empty array.'} No markdown or explanations.` }];
    let totalChars = 0;
    for (const item of images) {
      if (typeof item !== 'string') return replyError(res, 400, 'ছবির ডেটা সঠিক নয়।');
      const match = item.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
      if (!match) return replyError(res, 400, 'শুধু JPEG, PNG বা WebP ছবি সমর্থিত।');
      totalChars += match[2].length;
      if (totalChars > 3_300_000) return replyError(res, 413, 'ছবিগুলোর মোট আকার বেশি। ছোট আকারের ছবি দিয়ে আবার চেষ্টা করো।');
      parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
    }
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0.7 } })
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error('Gemini API returned status', upstream.status, data?.error?.status || 'unknown');
      return replyError(res, 502, 'Gemini ছবি বিশ্লেষণ করতে পারেনি। API Key, মডেল ও ব্যবহারের সীমা পরীক্ষা করো।');
    }
    const parsed = parseJson(extractText(data));
    const result = {
      detected_vibe: String(parsed.detected_vibe || 'ছবির মুহূর্ত').slice(0, 100),
      main_post_caption: String(parsed.main_post_caption || '').slice(0, 2000),
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.filter(x => typeof x === 'string').slice(0, 8).map(x => x.slice(0, 80)) : [],
      individual_captions: perPhoto && Array.isArray(parsed.individual_captions) ? parsed.individual_captions.filter(x => x && typeof x.caption === 'string').slice(0, images.length).map(x => ({ photo_index: Math.max(1, Math.min(images.length, Number(x.photo_index) || 1)), caption: x.caption.slice(0, 1500) })) : []
    };
    if (!result.main_post_caption) throw new Error('Empty photo caption');
    return res.status(200).json(result);
  } catch (err) {
    console.error('Gemini photo function error:', err?.message || err);
    return replyError(res, 500, 'ছবি থেকে ক্যাপশন তৈরি করা যায়নি। আবার চেষ্টা করো।');
  }
};

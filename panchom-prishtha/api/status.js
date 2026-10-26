module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'শুধু GET অনুরোধ গ্রহণ করা হয়।' });
  return res.status(200).json({
    app: 'পঞ্চম পৃষ্ঠা',
    openai: Boolean(process.env.OPENAI_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    message: 'এখানে শুধু Key সেট আছে কি না দেখা যায়; API call সফল কি না বোঝায় না।'
  });
};

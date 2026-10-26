পঞ্চম পৃষ্ঠা — দুইটি AI API-সহ Vercel প্যাকেজ
================================================

এই প্যাকেজে কী আছে
- index.html: আপনার পঞ্চম পৃষ্ঠা ওয়েব অ্যাপ
- api/caption-openai.js: টেক্সট/মুড থেকে ৩টি AI ক্যাপশন (OpenAI Responses API)
- api/photos-gemini.js: ১–৬টি ছবি দেখে ক্যাপশন/হ্যাশট্যাগ (Gemini API)
- api/status.js: দুইটি API Key Vercel-এ সেট আছে কি না দেখার নিরাপদ স্ট্যাটাস endpoint
- vercel.json: Vercel Function configuration

কোন ফিচারে কোন API
- লেখা/মুড/ভাষা থেকে ক্যাপশন: OpenAI → /api/caption-openai
- ছবি দেখে মেইন ক্যাপশন, হ্যাশট্যাগ ও ঐচ্ছিক প্রতিটি ছবির ক্যাপশন: Gemini → /api/photos-gemini
- Key-গুলো browser/HTML-এ রাখা হয়নি; Vercel server-side environment variable থেকে পড়া হয়।

Vercel-এ চালানোর ধাপ
1. ZIP extract করুন। ভেতরের panchom-prishtha ফোল্ডারের সব ফাইল GitHub repository-র ROOT-এ upload করুন; root-এ index.html, package.json, vercel.json এবং api/ ফোল্ডার থাকতে হবে।
2. Vercel Dashboard → Add New → Project → আপনার GitHub repository Import করুন। Framework preset না চিনলে Other নির্বাচন করুন; Build Command/Output Directory ফাঁকা রাখুন।
3. Project → Settings → Environment Variables-এ দুইটি variable আলাদা করে যোগ করুন:
   OPENAI_API_KEY = আপনার OpenAI API key
   GEMINI_API_KEY = আপনার Gemini API key
4. (ঐচ্ছিক) Model override দরকার না হলে OPENAI_MODEL / GEMINI_MODEL যোগ করবেন না; ডিফল্ট মডেল কোডে সেট করা আছে।
5. Save করার পর Deploy চাপুন। আগে থেকেই project deploy করা থাকলে Environment Variables যোগ/পরিবর্তনের পর Redeploy করুন।
6. Deploy শেষ হলে আপনার https://....vercel.app সাইট খুলুন।
7. https://আপনার-সাইট.vercel.app/api/status খুলে openai ও gemini—দুটিই true দেখুন। এটি শুধু Key উপস্থিতি পরীক্ষা করে, API credit বা live call সফল হওয়া নিশ্চিত করে না।
8. সাইটে আগে টেক্সট ক্যাপশন, তারপর ছবি ক্যাপশন পরীক্ষা করুন। সমস্যা হলে Vercel → Logs/Functions দেখুন।

API Key কোথা থেকে পাবেন
- OpenAI: https://platform.openai.com/api-keys
- Gemini: https://aistudio.google.com/apikey

গুরুত্বপূর্ণ সীমাবদ্ধতা ও নিরাপত্তা
- ChatGPT subscription আর OpenAI API billing আলাদা হতে পারে; OpenAI API-তে billing/credit প্রয়োজন হতে পারে। Gemini-তেও quota/availability প্রযোজ্য।
- API Key কখনো HTML, GitHub public repository বা চ্যাটে লিখবেন না। কেবল Vercel Environment Variables-এ রাখুন।
- ছবি-ফিচার ব্যবহারের আগে অ্যাপের সম্মতি checkbox টিক দিতে হবে। সম্মতির পর ছবির compressed copy Google Gemini API-তে পাঠানো হয়। ব্যক্তিগত/সংবেদনশীল ছবি দেবেন না।
- Vercel Functions-এর request body সীমা 4.5 MB; ছবি browser-এ ছোট করা হয় এবং server-এ মোট ছবির ডেটার সীমা আছে।
- Endpoint-এ প্রতি IP-তে best-effort in-memory rate limit আছে, কিন্তু এটি সম্পূর্ণ abuse protection নয়; public/বেশি traffic হলে Vercel Firewall/Rate Limiting এবং authentication যোগ করুন।
- API ব্যবহার/খরচ আপনার provider account-এর ওপর নির্ভর করে। API call সফল কি না পরীক্ষা না করে আমরা live success দাবি করতে পারি না।
- এই ZIP deploy-ready source package; এটি নিজে থেকে আপনার Vercel/GitHub account-এ deploy করতে পারে না। Deploy এবং দুইটি Key যোগ করার পরেই live হবে।

const ALLOWED_ORIGINS = ["https://www.proilkom.my.id", "https://proilkom.my.id"];

const SYSTEM_PROMPT = `Anda adalah ProILKOM AI, asisten akademik pendamping mahasiswa Ilmu Komunikasi. 
Tugas Anda: menjelaskan teori komunikasi, menyusun kerangka tugas, memberikan contoh, menganalisis kasus, dan mendukung berpikir kritis.
Aturan Wajib:
1. Gunakan bahasa Indonesia yang jelas, alami, sopan, terstruktur, dan mudah dipahami.
2. JANGAN PERNAH mengarang referensi, kutipan, DOI, atau sumber akademik. Jika tidak yakin, katakan secara jujur bahwa Anda tidak memiliki akses ke sumber tersebut.
3. Berikan jawaban yang langsung pada inti permasalahan, ringkas, dan efisien.
4. Gunakan poin-poin atau paragraf pendek agar mudah dibaca.`;

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin");
    const corsHeaders = {
      "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // 1. Handle CORS Preflight (OPTIONS)
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // 2. Handle GET Request (Hanya untuk menampilkan status bahwa Worker aktif)
    if (request.method === "GET") {
      return new Response("✅ ProILKOM AI Backend is running and ready to serve!", {
        headers: { ...corsHeaders, "Content-Type": "text/plain" }
      });
    }

    // 3. Validasi Metode HTTP (Hanya terima POST untuk AI)
    if (request.method !== "POST") {
      return new Response("Method Not Allowed. Please use POST.", { status: 405, headers: corsHeaders });
    }

    // 4. Validasi Origin (Keamanan dasar CORS)
    if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
      return new Response("Forbidden: Invalid Origin", { status: 403, headers: corsHeaders });
    }

    // 5. Parse dan Validasi Body Request
    let data;
    try {
      data = await request.json();
    } catch (e) {
      return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
    }

    if (!data.messages || !Array.isArray(data.messages) || data.messages.length === 0) {
      return new Response("Missing or invalid 'messages' array", { status: 40

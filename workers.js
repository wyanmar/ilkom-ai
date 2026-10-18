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
    // 1. Handle CORS Preflight (OPTIONS)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": request.headers.get("Origin") || ALLOWED_ORIGINS[0],
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // 2. Validasi Metode HTTP
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // 3. Validasi Origin (Keamanan dasar CORS)
    const origin = request.headers.get("Origin");
    if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
      return new Response("Forbidden: Invalid Origin", { status: 403 });
    }

    // 4. Parse dan Validasi Body Request
    let data;
    try {
      data = await request.json();
    } catch (e) {
      return new Response("Invalid JSON", { status: 400 });
    }

    if (!data.messages || !Array.isArray(data.messages) || data.messages.length === 0) {
      return new Response("Missing or invalid 'messages' array", { status: 400 });
    }

    // Batasi riwayat percakapan hanya 10 pesan terakhir agar respon CEPAT dan hemat token
    const recentMessages = data.messages.slice(-10);
    const formattedMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...recentMessages
    ];

    try {
      // 5. Panggil Cloudflare Workers AI (Model ringan dan cepat)
      const response = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fp8", {
        messages: formattedMessages,
        max_tokens: 500, // Membatasi panjang jawaban agar loading cepat
        temperature: 0.7,
      });

      // 6. Kembalikan Respon dalam Format JSON
      return new Response(JSON.stringify({ 
        answer: response.response || "Maaf, terjadi kesalahan pada saat memproses jawaban." 
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": origin,
        },
      });

    } catch (error) {
      console.error("Workers AI Error:", error);
      return new Response(JSON.stringify({ 
        answer: "Maaf, sistem sedang mengalami gangguan teknis. Silakan coba lagi dalam beberapa saat." 
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": origin,
        },
      });
    }
  }
};

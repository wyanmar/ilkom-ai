var ALLOWED_ORIGINS = new Set([
  "https://www.proilkom.my.id",
  "https://proilkom.my.id",
  "https://proilkom.blogspot.com" // Tambahan jaga-jaga jika masih pakai domain blogspot
]);

var SYSTEM_PROMPT = `Anda adalah ProILKOM AI, asisten AI pendamping akademik mahasiswa Ilmu Komunikasi. Jawablah dalam bahasa Indonesia yang jelas, alami, sopan, terstruktur, dan mudah dipahami. Bantu pengguna belajar dan berpikir kritis. Jangan mengarang referensi.`;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");

    // 1. Handle Preflight (OPTIONS) untuk CORS
    if (request.method === "OPTIONS") {
      if (!origin || !ALLOWED_ORIGINS.has(origin)) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400"
        }
      });
    }

    // 2. Validasi Request
    if (!origin || !ALLOWED_ORIGINS.has(origin)) {
      return new Response(JSON.stringify({ error: "Origin tidak diizinkan." }), { status: 403, headers: { "Content-Type": "application/json" } });
    }
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Gunakan metode POST." }), { status: 405, headers: { "Content-Type": "application/json" } });
    }

    try {
      const body = await request.json();
      const messages = body.messages || [];
      const streamRequested = body.stream === true;

      if (messages.length === 0) {
        return new Response(JSON.stringify({ error: "Pesan belum diisi." }), { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": origin } });
      }

      // Batasi history ke 6 pesan terakhir agar ringan dan cepat
      const input = messages.slice(-6).map(m => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content.trim().substring(0, 4000)
      }));

      // 3. Panggil Cloudflare AI dengan MODEL YANG BENAR
      const aiResponse = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...input
        ],
        max_tokens: 800,
        stream: streamRequested // Aktifkan streaming
      });

      // 4. Kembalikan Respons
      if (streamRequested) {
        return new Response(aiResponse, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
          }
        });
      }

      // Fallback non-streaming
      return new Response(JSON.stringify({ answer: aiResponse.response }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": origin
        }
      });

    } catch (error) {
      console.error("Worker Error:", error);
      return new Response(JSON.stringify({ error: "Gagal memproses: " + error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": origin }
      });
    }
  }
};


const ALLOWED_ORIGINS = new Set([
  "https://www.proilkom.my.id",
  "https://proilkom.my.id"
]);

const SYSTEM_PROMPT = `
Anda adalah ProILKOM AI, asisten AI umum sekaligus
pendamping akademik mahasiswa Ilmu Komunikasi.

Jawablah dalam bahasa Indonesia yang jelas, alami,
sopan, terstruktur, dan mudah dipahami.

Anda dapat menjawab pertanyaan umum, menjelaskan teori
komunikasi, menyusun kerangka tugas, memberi contoh,
menganalisis kasus, dan membantu proses belajar.

Untuk pertanyaan akademik:
- Jelaskan konsep dan berikan contoh relevan.
- Bedakan fakta, pendapat, dan interpretasi.
- Jangan mengarang referensi, kutipan, DOI, atau ayat.
- Jika tidak yakin, nyatakan keterbatasan.
- Jangan mengklaim membaca dokumen yang belum diberikan.
- Bantu pengguna belajar dan berpikir kritis.
`;

function json(data, status, origin) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin"
  };

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
  }

  return new Response(JSON.stringify(data), {
    status,
    headers
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");

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
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin"
        }
      });
    }

    if (!origin || !ALLOWED_ORIGINS.has(origin)) {
      return json({ error: "Origin tidak diizinkan." }, 403);
    }

    if (request.method !== "POST") {
      return json({ error: "Gunakan metode POST." }, 405, origin);
    }

    const contentType = request.headers.get("Content-Type") || "";

    if (!contentType.toLowerCase().includes("application/json")) {
      return json({ error: "Content-Type harus JSON." }, 415, origin);
    }

    const length = Number(request.headers.get("Content-Length") || 0);

    if (length > 20000) {
      return json({ error: "Pesan terlalu besar." }, 413, origin);
    }

    try {
      const body = await request.json();
      const messages = body.messages;

      if (!Array.isArray(messages) || messages.length === 0) {
        return json({ error: "Pesan belum diisi." }, 400, origin);
      }

      const input = messages.slice(-12).map((m) => {
        if (
          !m ||
          !["user", "assistant"].includes(m.role) ||
          typeof m.content !== "string" ||
          !m.content.trim() ||
          m.content.length > 6000
        ) {
          throw new Error("Format pesan tidak valid.");
        }

        return {
          role: m.role,
          content: m.content.trim()
        };
      });

      if (!input.some((m) => m.role === "user")) {
        return json({ error: "Pertanyaan belum ditemukan." }, 400, origin);
      }

      if (!env.AI || typeof env.AI.run !== "function") {
        console.error("Workers AI binding AI tidak tersedia.");

        return json({
          error: "Workers AI belum dikonfigurasi pada Worker."
        }, 500, origin);
      }

      let result;

      try {
        result = await env.AI.run(
          "@cf/meta/llama-3.1-8b-instruct-fp8",
          {
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              ...input
            ],
            max_tokens: 1000
          }
        );
      } catch (error) {
        console.error("Workers AI error:", error.message);

        return json({
          error: "Layanan AI gagal memproses permintaan. Periksa konfigurasi dan kuota Workers AI."
        }, 502, origin);
      }

      const answer = result?.response?.trim();

      if (!answer) {
        console.error("Workers AI tidak menghasilkan teks.");

        return json({
          error: "AI belum menghasilkan jawaban. Silakan coba lagi."
        }, 502, origin);
      }

      return json({ answer }, 200, origin);

    } catch (error) {
      console.error("Request error:", error.message);

      return json({
        error: "Format permintaan tidak valid."
      }, 400, origin);
    }
  }
};

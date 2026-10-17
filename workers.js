
const ALLOWED_ORIGINS = new Set([
  "https://www.proilkom.my.id",
  "https://proilkom.my.id"
]);

const SYSTEM_PROMPT = `
Anda adalah ProILKOM AI, asisten AI umum sekaligus
pendamping akademik mahasiswa Ilmu Komunikasi.

Jawablah dalam bahasa Indonesia yang jelas, alami,
sopan, terstruktur, dan mudah dipahami.

Anda dapat menjawab pertanyaan umum, membantu menjelaskan
teori komunikasi, menyusun kerangka tugas, memberi contoh,
menganalisis kasus, dan membantu proses belajar.

Untuk pertanyaan akademik:
- Jelaskan konsep dan berikan contoh yang relevan.
- Bedakan fakta, pendapat, dan interpretasi.
- Jangan mengarang referensi, kutipan, DOI, atau ayat.
- Jika tidak yakin, nyatakan keterbatasan tersebut.
- Jangan mengklaim telah membaca artikel atau dokumen
  yang belum diberikan kepada Anda.

Bantu pengguna belajar dan berpikir kritis, bukan sekadar
memberikan jawaban untuk disalin.
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

    if (!origin || !ALLOWED_ORIGINS.has(origin)) {
      return json({ error: "Origin tidak diizinkan." }, 403);
    }

    if (request.method === "OPTIONS") {
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

      // Batasi riwayat dan validasi input dari browser.
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

      if (!env.OPENAI_API_KEY) {
        return json({ error: "API belum dikonfigurasi." }, 500, origin);
      }

      const aiResponse = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gpt-4.1-mini",
            instructions: SYSTEM_PROMPT,
            input,
            max_output_tokens: 1000,
            store: false
          })
        }
      );

      if (!aiResponse.ok) {
        console.error("OpenAI status:", aiResponse.status);

        return json({
          error: aiResponse.status === 429
            ? "Layanan sedang sibuk atau batas penggunaan tercapai."
            : "AI belum dapat menjawab. Silakan coba lagi."
        }, 502, origin);
      }

      const result = await aiResponse.json();

      const answer = (result.output || [])
        .filter((item) => item.type === "message")
        .flatMap((item) => item.content || [])
        .filter((item) => item.type === "output_text")
        .map((item) => item.text)
        .join("\n")
        .trim();

      if (!answer) {
        return json({
          error: "AI belum menghasilkan jawaban teks."
        }, 502, origin);
      }

      return json({ answer }, 200, origin);

    } catch (error) {
      console.error("Request error:", error.message);

      return json({
        error: "Permintaan gagal diproses. Periksa pesan dan coba lagi."
      }, 400, origin);
    }
  }
};

const ALLOWED_ORIGINS = ["https://www.proilkom.my.id", "https://proilkom.my.id"];

const SYSTEM_PROMPT = `Anda adalah ProILKOM AI, asisten akademik pendamping mahasiswa Ilmu Komunikasi.
Tugas Anda: menjelaskan teori komunikasi, menyusun kerangka tugas, memberikan contoh, menganalisis kasus, dan mendukung berpikir kritis.
Aturan Wajib:
1. Gunakan bahasa Indonesia yang jelas, alami, sopan, terstruktur, dan mudah dipahami.
2. JANGAN PERNAH mengarang referensi, kutipan, DOI, atau sumber akademik. Jika tidak yakin, katakan secara jujur bahwa Anda tidak memiliki akses ke sumber tersebut.
3. Jawaban langsung pada inti permasalahan, ringkas, dan efisien.
4. Gunakan poin-poin atau paragraf pendek agar mudah dibaca.`;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const requestOrigin = url.origin;

    const isAllowed = !origin || origin === requestOrigin || ALLOWED_ORIGINS.includes(origin);

    const corsHeaders = {
      "Access-Control-Allow-Origin": origin || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === "GET") {
      return new Response("ProILKOM AI backend aktif.", {
        headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders },
      });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    if (!isAllowed) {
      return new Response(JSON.stringify({ answer: "Akses ditolak: Origin tidak diizinkan." }), {
        status: 403,
        headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders },
      });
    }

    let data;
    try {
      data = await request.json();
    } catch (e) {
      return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
    }

    if (!data.messages || !Array.isArray(data.messages) || data.messages.length === 0) {
      return new Response("Missing or invalid messages array", { status: 400, headers: corsHeaders });
    }

    const recentMessages = data.messages.slice(-6);
    const formattedMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...recentMessages,
    ];

    try {
      if (!env.AI) {
        throw new Error("Binding AI tidak ditemukan.");
      }

      const response = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fp8", {
        messages: formattedMessages,
        max_tokens: 400,
        temperature: 0.5,
      });

      return new Response(JSON.stringify({
        answer: response.response || "(jawaban kosong)",
      }), {
        headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders },
      });

    } catch (error) {
      console.error("Workers AI Error:", error);
      return new Response(JSON.stringify({ 
        answer: "Maaf, sistem sedang mengalami gangguan teknis." 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders },
      });
    }
  }
};

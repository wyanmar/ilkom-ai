export default {
  async fetch(request, env) {
    // Izinkan semua origin sementara untuk memastikan tidak ada blokir CORS
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };

    // 1. Handle OPTIONS (CORS Preflight)
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // 2. Handle GET (Untuk testing langsung di browser)
    if (request.method === "GET") {
      return new Response(JSON.stringify({ 
        status: "OK", 
        message: "Worker berjalan! Silakan gunakan metode POST dengan JSON body untuk chat.",
        ai_binding_status: env.AI ? "BERHASIL TERPASANG ✅" : "GAGAL / TIDAK DITEMUKAN ❌ (Cek wrangler.jsonc atau Dashboard)"
      }), { status: 200, headers: corsHeaders });
    }

    // 3. Handle POST (Request dari Blog Anda)
    if (request.method === "POST") {
      try {
        // Cek apakah binding AI ada
        if (!env || !env.AI) {
          return new Response(JSON.stringify({ error: "CRITICAL: Binding 'AI' tidak ditemukan. Periksa konfigurasi Worker." }), { status: 500, headers: corsHeaders });
        }

        // Baca JSON dengan aman (catch error jika format salah)
        const body = await request.json().catch(() => null);
        if (!body || !body.messages || !Array.isArray(body.messages)) {
          return new Response(JSON.stringify({ error: "Format JSON tidak valid atau 'messages' tidak ditemukan." }), { status: 400, headers: corsHeaders });
        }

        const streamRequested = body.stream === true;
        
        // Bersihkan dan batasi pesan
        const messages = body.messages.slice(-6).map(m => ({
          role: m.role === "user" ? "user" : "assistant",
          content: String(m.content).substring(0, 4000)
        }));

        // Panggil Cloudflare AI
        const aiResponse = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
          messages: [
            { role: "system", content: "Anda adalah ProILKOM AI, asisten akademik Ilmu Komunikasi yang sopan, jelas, dan terstruktur." },
            ...messages
          ],
          max_tokens: 800,
          stream: streamRequested
        });

        // Kembalikan hasil
        if (streamRequested) {
          return new Response(aiResponse, {
            headers: {
              ...corsHeaders,
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              "Connection": "keep-alive"
            }
          });
        }

        return new Response(JSON.stringify({ answer: aiResponse.response }), {
          status: 200,
          headers: corsHeaders
        });

      } catch (error) {
        // Jika masih ada error, kita akan tahu persis penyebabnya di log
        console.error("WORKER CRASH DETAIL:", error.message, error.stack);
        return new Response(JSON.stringify({ 
          error: "Server Error: " + error.message 
        }), { 
          status: 500, 
          headers: corsHeaders 
        });
      }
    }

    // 4. Metode lain tidak diizinkan
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }
};

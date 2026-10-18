export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    
    // Izinkan semua origin untuk sementara demi debugging (akan kita ketatkan nanti setelah berhasil)
    const corsHeaders = {
      "Access-Control-Allow-Origin": origin || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      // 1. Validasi Binding AI
      if (!env || !env.AI) {
        console.error("CRITICAL: env.AI is undefined. Check wrangler.jsonc or Dashboard Bindings.");
        return new Response(JSON.stringify({ error: "Konfigurasi AI Binding belum benar." }), { status: 500, headers: corsHeaders });
      }

      const body = await request.json();
      const messages = body.messages || [];
      const streamRequested = body.stream === true;

      if (messages.length === 0) {
        return new Response(JSON.stringify({ error: "Pesan kosong." }), { status: 400, headers: corsHeaders });
      }

      // 2. Panggil AI
      console.log("Memanggil AI dengan model: @cf/meta/llama-3.1-8b-instruct");
      
      const aiResponse = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          { role: "system", content: "Anda adalah ProILKOM AI, asisten akademik Ilmu Komunikasi yang sopan dan jelas." },
          ...messages.slice(-6) // Ambil 6 pesan terakhir
        ],
        max_tokens: 800,
        stream: streamRequested
      });

      // 3. Kembalikan Response
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
      // Ini akan muncul di Tab "Logs" di Dashboard Cloudflare
      console.error("WORKER CRASH DETAIL:", error.message, error.stack);
      
      return new Response(JSON.stringify({ 
        error: "Server Error: " + error.message 
      }), { 
        status: 500, 
        headers: corsHeaders 
      });
    }
  }
};

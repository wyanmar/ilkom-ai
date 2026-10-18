export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method === "GET") {
      return new Response(JSON.stringify({ 
        status: "OK", 
        ai_binding: env.AI ? "TERPASANG ✅" : "GAGAL ❌"
      }), { status: 200, headers: corsHeaders });
    }

    if (request.method === "POST") {
      try {
        if (!env || !env.AI) {
          return new Response(JSON.stringify({ error: "Binding AI tidak ditemukan." }), { status: 500, headers: corsHeaders });
        }

        // Coba baca JSON, jika gagal tangkap errornya
        let body;
        try {
          body = await request.json();
        } catch (e) {
          console.error("Gagal parse JSON dari request:", e);
          return new Response(JSON.stringify({ error: "Request bukan format JSON yang valid." }), { status: 400, headers: corsHeaders });
        }

        // LOG DATA YANG DITERIMA (Akan muncul di Tab 'Logs' di Dashboard Cloudflare)
        console.log("DATA DARI BLOGGER:", JSON.stringify(body));

        if (!body || !body.messages || !Array.isArray(body.messages)) {
          return new Response(JSON.stringify({ error: "Field 'messages' tidak ditemukan atau bukan array." }), { status: 400, headers: corsHeaders });
        }

        const streamRequested = body.stream === true;
        
        const messages = body.messages.slice(-6).map(m => ({
          role: m.role === "user" ? "user" : "assistant",
          content: String(m.content || "").substring(0, 4000)
        }));

        console.log("Memanggil AI...");
        const aiResponse = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
          messages: [
            { role: "system", content: "Anda adalah ProILKOM AI, asisten akademik Ilmu Komunikasi." },
            ...messages
          ],
          max_tokens: 800,
          stream: streamRequested
        });

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
        console.error("CRASH TOTAL:", error.message, error.stack);
        return new Response(JSON.stringify({ error: "Server Error: " + error.message }), { 
          status: 500, 
          headers: corsHeaders 
        });
      }
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }
};

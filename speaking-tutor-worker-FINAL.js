// Speaking Tutor A2+ Worker
// Identico come struttura al batteries-tutor worker

export default {
  async fetch(request, env) {
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };

    if (request.method === "OPTIONS") return new Response(null, { headers });
    if (request.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { headers });

    let body;
    try { body = await request.json(); }
    catch(e) { return new Response(JSON.stringify({ action: "error", message: "Invalid JSON" }), { headers }); }

    const action = body.action;

    // ── START ──────────────────────────────────────────────
    if (action === "start") {
      const unit = body.unit || 1;
      
      const themes = [
        "everyday life: your daily routine, school, and free time activities",
        "food: your eating habits, healthy food, and ordering at a restaurant",  
        "appearance and personality, and making video calls",
        "arts and entertainment: music, films, books, and giving opinions"
      ];
      
      const greetings = [
        `Hi! Let's talk about ${themes[unit-1]}. What would you like to start with?`,
        `Hello! Ready to practice? Today we'll chat about ${themes[unit-1]}. Where should we begin?`,
        `Hey! Great to see you. Let's have a conversation about ${themes[unit-1]}. What interests you?`
      ];
      
      return new Response(JSON.stringify({
        action: "question",
        reply: greetings[Math.floor(Math.random() * greetings.length)],
        ok: true,
        unit: unit
      }), { headers });
    }

    // ── ANSWER ──────────────────────────────────────────────
    if (action === "answer") {
      const studentText = body.text || '';
      const unit = body.unit || 1;
      const history = body.history || [];

      // Build prompt
      const themes = {
        1: "everyday life, daily routines, school, free time",
        2: "food, eating habits, ordering at restaurants",
        3: "describing appearance and personality, video calls",
        4: "arts, music, films, books, opinions"
      };

      let conversationSoFar = '';
      const recent = history.slice(-4);
      for (const turn of recent) {
        if (turn.role === 'student') {
          conversationSoFar += `Student: ${turn.text}\n`;
        } else if (turn.role === 'tutor') {
          conversationSoFar += `You said: ${turn.text}\n`;
        }
      }

      const prompt = `You are a friendly English tutor for Italian A2+ students. Topic: ${themes[unit]}.

${conversationSoFar}
Student just said: "${studentText}"

Continue the conversation naturally. Reply with ONE short sentence in simple English (max 12 words). Be warm and encouraging. Ask a follow-up question or react naturally.

Reply with ONLY your sentence. No quotes, no extra text.`;

      try {
        const response = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
          messages: [{ role: "user", content: prompt }],
          max_tokens: 50
        });
        
        let reply = (response.response || "").trim();
        reply = reply.replace(/^["']|["']$/g, '');
        reply = reply.replace(/^(You:|Tutor:|Response:)\s*/i, '');
        
        if (!reply) reply = "That's interesting! Tell me more about it.";
        
        const ok = studentText.trim().length > 3;
        
        return new Response(JSON.stringify({
          action: "continue",
          reply: reply,
          ok: ok
        }), { headers });

      } catch(e) {
        return new Response(JSON.stringify({
          action: "continue",
          reply: "Interesting! What else can you tell me?",
          ok: true
        }), { headers });
      }
    }

    // ── HINT ──────────────────────────────────────────────
    if (action === "hint") {
      const hints = [
        "Try to say what you think! Simple words are fine.",
        "You can start with: I think... or I like... or I usually...",
        "Don't worry about mistakes. Just try!",
        "Take your time. Say it in simple English."
      ];
      
      return new Response(JSON.stringify({
        action: "hint",
        reply: hints[Math.floor(Math.random() * hints.length)],
        ok: true
      }), { headers });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { 
      status: 400, 
      headers 
    });
  }
};

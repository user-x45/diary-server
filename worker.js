export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = env.ALLOWED_ORIGIN || "*";
    const corsHeaders = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,X-Password",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });

    const checkAuth = (request) => {
      const password = request.headers.get("X-Password") || "";
      return password === env.SITE_PASSWORD;
    };

    if (url.pathname === "/api/posts" && request.method === "GET") {
      if (!checkAuth(request)) return json({ error: "Unauthorized" }, 401);
      const list = await env.POSTS_KV.list({ prefix: "post:" });
      const posts = [];
      for (const key of list.keys) {
        const value = await env.POSTS_KV.get(key.name);
        if (value) posts.push(JSON.parse(value));
      }
      posts.sort((a, b) => b.createdAt - a.createdAt);
      return json(posts);
    }

    if (url.pathname === "/api/posts" && request.method === "POST") {
      if (!checkAuth(request)) return json({ error: "Unauthorized" }, 401);
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid JSON" }, 400);
      }
      const content = (body.content || "").trim();
      if (!content) return json({ error: "Content required" }, 400);
      const createdAt = Date.now();
      const id = crypto.randomUUID();
      const post = { id, content, createdAt };
      await env.POSTS_KV.put(`post:${createdAt}:${id}`, JSON.stringify(post));
      return json(post, 201);
    }

    const deleteMatch = url.pathname.match(/^\/api\/posts\/([^/]+)$/);
    if (deleteMatch && request.method === "DELETE") {
      if (!checkAuth(request)) return json({ error: "Unauthorized" }, 401);
      const id = deleteMatch[1];
      const list = await env.POSTS_KV.list({ prefix: "post:" });
      const target = list.keys.find((k) => k.name.endsWith(id));
      if (target) await env.POSTS_KV.delete(target.name);
      return json({ ok: true });
    }

    return json({ error: "Not found" }, 404);
  },
};

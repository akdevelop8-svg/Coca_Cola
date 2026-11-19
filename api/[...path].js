import { Readable } from "node:stream";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const edgeUrl = process.env.SUPABASE_EDGE_FUNCTION_URL;
  const apiKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!edgeUrl || !apiKey) {
    res.status(503);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({ error: "API configuration is incomplete." }));
    return;
  }

  const incomingUrl = req.url || "/api";
  const suffix = incomingUrl.replace(/^\/api(?=\/|\?|$)/, "") || "/";
  const target = edgeUrl.replace(/\/$/, "") + suffix;
  const headers = new Headers({
    apikey: apiKey,
    "x-client-info": "coca-cola-platform-vercel-gateway",
  });

  const auth = req.headers?.authorization;
  if (typeof auth === "string" && auth) headers.set("authorization", auth);

  const contentType = req.headers?.["content-type"];
  if (typeof contentType === "string") headers.set("content-type", contentType);

  const accept = req.headers?.accept;
  if (typeof accept === "string") headers.set("accept", accept);

  const method = (req.method || "GET").toUpperCase();

  try {
    const init = { method, headers, redirect: "manual" };
    if (!["GET", "HEAD"].includes(method)) {
      init.body = Readable.toWeb(req);
      init.duplex = "half";
    }

    const upstream = await fetch(target, init);
    const bytes = Buffer.from(await upstream.arrayBuffer());
    res.status(upstream.status);
    res.setHeader(
      "Content-Type",
      upstream.headers.get("content-type") || "application/json; charset=utf-8",
    );
    res.setHeader("Cache-Control", "no-store");

    const location = upstream.headers.get("location");
    if (location) res.setHeader("Location", location);
    res.end(bytes);
  } catch (error) {
    console.error("Supabase API gateway error:", error);
    res.status(502);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({ error: "The API service is temporarily unavailable." }));
  }
}

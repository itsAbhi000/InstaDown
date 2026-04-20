// api/download.js — Vercel Serverless Function
// Proxies Instagram CDN media bytes to the browser
// Needed because Instagram CDN blocks direct browser downloads (CORS/hotlink)

const axios = require("axios");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const mediaUrl = (req.query.url  || "").trim();
  const filename = (req.query.name || "media").trim();

  if (!mediaUrl) return res.status(400).send("Missing ?url= param");

  try {
    const upstream = await axios({
      url          : mediaUrl,
      method       : "GET",
      responseType : "stream",
      timeout      : 30000,
      headers      : {
        "User-Agent" : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer"    : "https://www.instagram.com/",
        "Accept"     : "*/*"
      }
    });

    const ct = upstream.headers["content-type"] || "application/octet-stream";
    const cl = upstream.headers["content-length"];

    res.setHeader("Content-Type", ct);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    if (cl) res.setHeader("Content-Length", cl);

    upstream.data.pipe(res);
    upstream.data.on("error", () => res.end());
  } catch (err) {
    res.status(502).send("Proxy error: " + err.message);
  }
};

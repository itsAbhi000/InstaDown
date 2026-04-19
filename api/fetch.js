// api/fetch.js — Vercel Serverless Function
// Fetches media info from Instagram APIs

const axios = require("axios");

const TAG          = "DownloadedByTG@phychokillers";
const API_PRIMARY  = "https://insta.bdbots.org/dl";
const API_FALLBACK = "https://psycho.instadown.workers.dev/";

function cleanUrl(url) {
  return url.split("?")[0].replace(/\/$/, "");
}

function cleanName(name = "insta") {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}

function normalisePrimary(data) {
  const block    = data.data || {};
  const mediaRaw = block.media || [];
  return {
    username : cleanName(block.username || "insta"),
    caption  : block.caption || "",
    media    : mediaRaw.map((m, i) => ({
      index    : i + 1,
      type     : m.type === "video" ? "video" : "photo",
      url      : m.url,
      thumb    : m.thumb || m.url,
      filename : m.type === "video"
                   ? `video_${i + 1}_${TAG}.mp4`
                   : `image_${i + 1}_${TAG}.jpg`
    }))
  };
}

function normaliseFallback(result) {
  const meta  = result[0] || {};
  const items = result.filter(r => r.image_url);
  return {
    username : cleanName(meta.username || "insta"),
    caption  : meta.caption || "",
    media    : items.map((m, i) => {
      const isVideo = m.is_video === true;
      return {
        index    : i + 1,
        type     : isVideo ? "video" : "photo",
        url      : isVideo ? (m.video_url || m.image_url) : m.image_url,
        thumb    : m.video_img || m.image_url,
        filename : isVideo
                     ? `video_${i + 1}_${TAG}.mp4`
                     : `image_${i + 1}_${TAG}.jpg`
      };
    })
  };
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const raw = (req.query.url || "").trim();
  if (!raw || !raw.includes("instagram.com")) {
    return res.status(400).json({ ok: false, error: "Invalid Instagram URL" });
  }

  const link = cleanUrl(raw);

  // ── Try primary API ──────────────────────────────────────
  try {
    const r = await axios.get(`${API_PRIMARY}?url=${encodeURIComponent(link)}`, {
      timeout : 15000,
      headers : { "User-Agent": "Mozilla/5.0" }
    });
    if (r.data?.status === "success" && r.data?.data) {
      const parsed = normalisePrimary(r.data);
      if (parsed.media.length) {
        return res.json({ ok: true, source: "bdbots", ...parsed });
      }
    }
  } catch (_) {}

  // ── Fallback API ─────────────────────────────────────────
  try {
    const r = await axios.get(`${API_FALLBACK}?url=${encodeURIComponent(link)}`, {
      timeout : 15000,
      headers : { "User-Agent": "Mozilla/5.0" }
    });
    if (r.data?.status === "success" && Array.isArray(r.data?.result) && r.data.result.length) {
      const parsed = normaliseFallback(r.data.result);
      if (parsed.media.length) {
        return res.json({ ok: true, source: "psycho", ...parsed });
      }
    }
  } catch (e) {
    return res.status(502).json({ ok: false, error: "Both APIs failed: " + e.message });
  }

  return res.status(404).json({ ok: false, error: "No media found. Make sure the post is public." });
};

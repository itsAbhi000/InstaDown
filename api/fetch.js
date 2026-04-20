// api/fetch.js — Vercel Serverless Function
// Fetches media info from Instagram APIs

const axios = require("axios");

const TAG          = "DownloadedByTG@phychokillers";
const API_PRIMARY  = "https://insta.bdbots.org/dl";
const API_FALLBACK = "https://psycho.instadown.workers.dev/";

// Generates timestamp like VID_20260420_144040_001
function makeTimestamp(index) {
  const now = new Date();
  const YYYY = now.getFullYear();
  const MM   = String(now.getMonth() + 1).padStart(2, "0");
  const DD   = String(now.getDate()).padStart(2, "0");
  const hh   = String(now.getHours()).padStart(2, "0");
  const mm   = String(now.getMinutes()).padStart(2, "0");
  const ss   = String(now.getSeconds()).padStart(2, "0");
  const idx  = String(index).padStart(3, "0");
  return `${YYYY}${MM}${DD}_${hh}${mm}${ss}_${idx}`;
}

function makeFilename(type, index) {
  const ts = makeTimestamp(index);
  if (type === "video") return `video_${index}VID_${ts}_${TAG}.mp4`;
  return `image_${index}IMG_${ts}_${TAG}.jpg`;
}

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
      filename : makeFilename(m.type === "video" ? "video" : "photo", i + 1)
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
        filename : makeFilename(isVideo ? "video" : "photo", i + 1)
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

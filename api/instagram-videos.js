'use strict';
const { json } = require('./lib/core');
let memoryCache = { until: 0, payload: null };
function normalizeMedia(item = {}) {
  const mediaType = String(item.media_type || '').toUpperCase();
  const productType = String(item.media_product_type || '').toUpperCase();
  const children = Array.isArray(item.children?.data) ? item.children.data : [];
  const child = children.find(entry => String(entry.media_type || '').toUpperCase() === 'VIDEO') || {};
  const kind = mediaType === 'VIDEO' || productType === 'REELS' || child.media_type === 'VIDEO' ? 'video' : 'image';
  const mediaUrl = item.media_url || child.media_url || '';
  const thumbnailUrl = item.thumbnail_url || child.thumbnail_url || '';
  return { id: item.id, caption: item.caption || '', media_type: mediaType, media_product_type: productType, media_url: mediaUrl, thumbnail_url: thumbnailUrl, permalink: item.permalink || child.permalink || '', timestamp: item.timestamp || '', kind };
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' }, { Allow: 'GET' });
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;
  const version = process.env.INSTAGRAM_GRAPH_VERSION || 'v23.0';
  if (!token || !userId) return json(res, 503, { configured: false, source: 'https://www.instagram.com/buildwritesh/', videos: [], error: 'Instagram integration is not configured.' });
  try {
    if (memoryCache.payload && memoryCache.until > Date.now()) return json(res, 200, memoryCache.payload, { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' });
    const fields = 'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,children{media_type,media_url,thumbnail_url,permalink}';
    const params = new URLSearchParams({ fields, limit: '24' });
    const url = `https://graph.facebook.com/${encodeURIComponent(version)}/${encodeURIComponent(userId)}/media?${params}`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Instagram API returned ${response.status}`);
    const data = await response.json();
    const videos = (data.data || []).map(normalizeMedia).filter(item => item.id && item.kind === 'video' && (item.media_url || item.thumbnail_url) && item.permalink);
    const payload = { configured: true, source: 'https://www.instagram.com/buildwritesh/', updatedAt: new Date().toISOString(), videos };
    memoryCache = { until: Date.now() + 5 * 60 * 1000, payload };
    return json(res, 200, payload, { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' });
  } catch {
    if (memoryCache.payload) return json(res, 200, { ...memoryCache.payload, stale: true }, { 'Cache-Control': 'public, s-maxage=60' });
    return json(res, 502, { configured: true, videos: [], error: 'Instagram videos are temporarily unavailable.' });
  }
};

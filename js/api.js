/**
 * api.js — Data fetching layer for git-play
 * Loads index.json and album JSON files from music-vault
 * Caches all data in localStorage to avoid repeat fetches
 */

const API = (() => {

  // ── Config ──
  // These are URLs pointing at your music-vault GitHub Pages / raw content
  const CONFIG = {
    // Base URL for your music-vault GitHub Pages site (served via GitHub Pages)
    // index.json must be at this URL
    vaultBase: 'https://Bharadwaja1557.github.io/music-vault',

    // Cache TTL in milliseconds (6 hours)
    cacheTTL: 6 * 60 * 60 * 1000,

    // GitHub release base URL template
    // {user}/{repo}/releases/download/{tag}/{filename}
    releaseBase: 'https://github.com/Bharadwaja1557/music-vault/releases/download',
  };

  // ── Cache helpers ──
  function cacheGet(key) {
    try {
      const raw = localStorage.getItem(`gp_${key}`);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > CONFIG.cacheTTL) {
        localStorage.removeItem(`gp_${key}`);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }

  function cacheSet(key, data) {
    try {
      localStorage.setItem(`gp_${key}`, JSON.stringify({ ts: Date.now(), data }));
    } catch {
      // Storage full — silently skip caching
    }
  }

  function cacheClear() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('gp_'));
    keys.forEach(k => localStorage.removeItem(k));
  }

  // ── Fetch helpers ──
  async function fetchJSON(url) {
    const res = await fetch(url, { cache: 'default' });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    return res.json();
  }

  // ── Public API ──

  /**
   * Load the album index.
   * Returns array of album summary objects.
   */
  async function loadIndex() {
    const cached = cacheGet('index');
    if (cached) return cached;

    const url = `${CONFIG.vaultBase}/index.json`;
    const data = await fetchJSON(url);
    cacheSet('index', data);
    return data;
  }

  /**
   * Load a single album's full data.
   * @param {string} albumId — matches "id" in index.json
   */
  async function loadAlbum(albumId) {
    const cacheKey = `album_${albumId}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    const url = `${CONFIG.vaultBase}/albums/${albumId}.json`;
    const data = await fetchJSON(url);
    cacheSet(cacheKey, data);
    return data;
  }

  /**
   * Build a streaming URL for a release asset.
   * @param {string} releaseTag
   * @param {string} filename
   */
  function getAudioUrl(releaseTag, filename) {
    return `${CONFIG.releaseBase}/${releaseTag}/${filename}`;
  }

  /**
   * Normalize a GitHub release filename into a readable track title.
   * GitHub replaces spaces with dots, so we reverse that.
   *
   * Algorithm:
   *   1. Strip extension
   *   2. Replace ".-." with " - "    (separator between parts)
   *   3. Replace remaining dots with space
   *   4. Strip leading track number (e.g. "01 ", "05 ")
   *   5. Trim
   *
   * Examples:
   *   "01.-.Title.Track.m4a"            → "Title Track"
   *   "05.-.Run.Down.The.City.-.Monica.m4a" → "Run Down The City - Monica"
   */
  function normalizeFilename(filename) {
    // 1. Strip extension
    let name = filename.replace(/\.[^.]+$/, '');

    // 2. Replace ".-." (dot-hyphen-dot) with placeholder, then restore as " - "
    name = name.replace(/\.-\./g, '___SEP___');

    // 3. Replace remaining dots with spaces
    name = name.replace(/\./g, ' ');

    // 4. Restore separator
    name = name.replace(/___SEP___/g, ' - ');

    // 5. Strip leading track number: "01 - " or "01 "
    name = name.replace(/^\d{1,3}\s*-\s*/, '').replace(/^\d{1,3}\s+/, '');

    return name.trim();
  }

  return {
    loadIndex,
    loadAlbum,
    getAudioUrl,
    normalizeFilename,
    cacheClear,
    config: CONFIG,
  };

})();

/**
 * api.js — Data fetching layer for git-play
 */

const API = (() => {

  const CONFIG = {
    vaultBase:   'https://gajala-sonic-solutions.github.io/music-vault',
    cacheTTL:    6 * 60 * 60 * 1000,
    releaseBase: 'https://github.com/gajala-sonic-solutions/music-vault/releases/download',
  };

  // ── Cache ──
  function cacheGet(key) {
    try {
      const raw = localStorage.getItem(`gp_${key}`);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > CONFIG.cacheTTL) { localStorage.removeItem(`gp_${key}`); return null; }
      return data;
    } catch { return null; }
  }

  function cacheSet(key, data) {
    try { localStorage.setItem(`gp_${key}`, JSON.stringify({ ts: Date.now(), data })); } catch {}
  }

  function cacheClear() {
    Object.keys(localStorage).filter(k => k.startsWith('gp_')).forEach(k => localStorage.removeItem(k));
  }

  // ── Fetch ──
  async function fetchJSON(url) {
    const res = await fetch(url, { cache: 'default' });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    return res.json();
  }

  async function loadIndex() {
    const cached = cacheGet('index');
    if (cached) return cached;
    const data = await fetchJSON(`${CONFIG.vaultBase}/index.json`);
    cacheSet('index', data);
    return data;
  }

  async function loadAlbum(albumId) {
    const cached = cacheGet(`album_${albumId}`);
    if (cached) return cached;
    const data = await fetchJSON(`${CONFIG.vaultBase}/albums/${albumId}.json`);
    cacheSet(`album_${albumId}`, data);
    return data;
  }

  function getAudioUrl(releaseTag, filename) {
    return `${CONFIG.releaseBase}/${releaseTag}/${filename}`;
  }

  /**
   * Parse a track filename into { title, singers }.
   *
   * ── NEW format (v2) ──────────────────────────────────────────
   *   Naming:  "01 -- Song Name -- Singer 1 & Singer 2.m4a"
   *   GitHub:  "01.--.Song.Name.--.Singer.1.&.Singer.2.m4a"
   *   Result:  { title: "Song Name", singers: ["Singer 1", "Singer 2"] }
   *
   *   Key decisions:
   *   • "--" (double hyphen) as field separator → survives as ".__." in filenames
   *     and cannot appear inside a song title naturally
   *   • "&" as singer separator → survives GitHub upload unchanged,
   *     easy to read, unambiguous
   *   • Song title CAN contain " - " (single hyphen) freely, e.g.
   *     "Run Down The City - Monica" is just the title, no confusion
   *
   * ── OLD format (v1, still parsed for backwards compat) ─────────
   *   "01.-.Song.Name.-.Singer.m4a"
   *   Treated as: if exactly 3 parts → last part = singer
   *               if 2 parts → no singer
   *
   * ── Returns ─────────────────────────────────────────────────────
   *   { title: string, singers: string[] }
   *   singers is always an array (empty if none)
   */
  function parseSongFilename(filename) {
    // Strip extension
    const name = filename.replace(/\.[^.]+$/, '');

    // ── Try v2 format first: split on ".--." ──
    if (name.includes('.--.')){
      const parts = name.split(/\.--\./).map(p => p.replace(/\./g, ' ').trim());
      const hasNum = /^\d{1,3}$/.test(parts[0]);
      const titleIdx  = hasNum ? 1 : 0;
      const singersRaw = hasNum ? parts.slice(2) : parts.slice(1);

      const title   = parts[titleIdx] || '';
      const singers = singersRaw.length > 0
        ? singersRaw.join(' ').split(/\s*&\s*/).map(s => s.trim()).filter(Boolean)
        : [];

      return { title, singers };
    }

    // ── Fall back to v1 format: split on ".-." ──
    const parts = name.split(/\.-\./).map(p => p.replace(/\./g, ' ').trim());

    if (parts.length <= 1) {
      // No separator — just strip leading track number
      return { title: parts[0].replace(/^\d{1,3}\s*-?\s*/, '').trim(), singers: [] };
    }

    const hasNum = /^\d{1,3}$/.test(parts[0]);

    if (parts.length === 2) {
      // "01 - Title" → no singers
      return {
        title:   hasNum ? parts[1] : parts[0],
        singers: hasNum ? [] : [parts[1]],
      };
    }

    // 3+ parts in v1: "01 - Title - Singer" → last segment = singer
    // But we join the middle segments to handle "01 - Part1 - Part2 - Singer"
    // by trusting generate.js to have pre-split title/singers correctly in JSON
    if (hasNum) {
      return {
        title:   parts.slice(1, -1).join(' - '),
        singers: [parts[parts.length - 1]],
      };
    }

    return {
      title:   parts[0],
      singers: parts.slice(1),
    };
  }

  /** Legacy helper — returns just the title string */
  function normalizeFilename(filename) {
    return parseSongFilename(filename).title;
  }

  return {
    loadIndex, loadAlbum, getAudioUrl,
    parseSongFilename, normalizeFilename,
    cacheClear, config: CONFIG,
  };

})();

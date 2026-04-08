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
   * NEW format (recommended):
   *   "01 - Song Name - Singer1, Singer2.m4a"
   *   → GitHub stores as: "01.-.Song.Name.-.Singer1,.Singer2.m4a"
   *   → { title: "Song Name", singers: "Singer1, Singer2" }
   *
   * OLD format (still supported):
   *   "01.-.Song.Name.m4a"  or  "05.-.Run.Down.The.City.-.Monica.m4a"
   *   → { title: "Song Name", singers: "" }
   *   → { title: "Run Down The City - Monica", singers: "" }
   *
   * Detection: if the track JSON already has a `singers` field, use that
   * directly and only parse the title from the filename.
   */
  function parseSongFilename(filename) {
    // 1. Strip extension
    let name = filename.replace(/\.[^.]+$/, '');

    // 2. Split on ".-." separator → parts
    //    "01.-.Song.Name.-.Singer" → ["01", "Song.Name", "Singer"]
    const parts = name.split(/\.-\./).map(p => p.replace(/\./g, ' ').trim());

    // parts[0] is always the track number
    if (parts.length === 1) {
      // No separator at all — just a plain name
      const title = parts[0].replace(/^\d{1,3}\s*/, '').trim();
      return { title, singers: '' };
    }

    if (parts.length === 2) {
      // Old format: "01 - Song Name"  (one separator)
      // Could also be "Song Name - Singer" if no track number
      const hasLeadingNum = /^\d{1,3}$/.test(parts[0]);
      if (hasLeadingNum) {
        return { title: parts[1], singers: '' };
      } else {
        // Treat as "Title - Singer" (no track number prefix)
        return { title: parts[0], singers: parts[1] };
      }
    }

    // 3+ parts: "01 - Song Name - Singers"  (new format)
    // parts[0] = track number, parts[1] = title, parts[2...] = singers
    const hasLeadingNum = /^\d{1,3}$/.test(parts[0]);
    if (hasLeadingNum) {
      const title   = parts[1];
      const singers = parts.slice(2).join(' - ');
      return { title, singers };
    } else {
      // No leading number: parts[0] = title, parts[1...] = singers
      return { title: parts[0], singers: parts.slice(1).join(' - ') };
    }
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

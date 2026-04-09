/**
 * app.js — Main orchestrator for git-play
 */

const App = (() => {

  const RECENTS_KEY = 'gp_recents';
  let indexData = null;
  let allLoadedAlbums = {}; // albumId → full albumData

  // ── Boot ──
  async function boot() {
    UI.init();
    Player.init();
    await loadIndex();
    bindHomeActions();
    bindRebuildButton();
    bindFlacButton();
  }

  // ── Rebuild (clear cache + reload) ──
  function bindFlacButton() {
    const btn = document.getElementById('btn-flac');
    if (!btn) return;

    // Set initial state from player
    const updateFlacBtn = () => {
      const on = Player.getFlacMode();
      btn.classList.toggle('flac-on', on);
      btn.title = on ? 'FLAC mode ON — tap to switch to M4A' : 'M4A mode — tap to switch to FLAC';
    };
    updateFlacBtn();

    btn.addEventListener('click', () => {
      const nowOn = Player.toggleFlacMode();
      btn.classList.toggle('flac-on', nowOn);
      btn.title = nowOn ? 'FLAC mode ON — tap to switch to M4A' : 'M4A mode — tap to switch to FLAC';
      // Quick visual feedback
      btn.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 200 });
    });
  }

  function bindRebuildButton() {
    const btn = document.getElementById('btn-rebuild');
    if (!btn) return;
    btn.addEventListener('click', () => {
      // Spin the icon while confirming
      btn.classList.add('spinning');
      const confirmed = confirm('Clear all cached data and reload?\nThe app will re-fetch everything fresh from the vault.');
      if (!confirmed) {
        btn.classList.remove('spinning');
        return;
      }
      // Wipe all gp_ keys from localStorage
      Object.keys(localStorage)
        .filter(k => k.startsWith('gp_'))
        .forEach(k => localStorage.removeItem(k));
      // Hard reload (bypass browser cache)
      location.reload(true);
    });
  }

  // ── Load index ──
  async function loadIndex() {
    UI.showHomeLoading();
    try {
      indexData = await API.loadIndex();
      const albums = indexData.albums || [];

      UI.renderAlbumGrid(albums);
      UI.renderRecents(getRecents(), albums);
      Library.renderLibraryScreen(albums);
      Search.setAlbums(albums);
    } catch (err) {
      console.error('Failed to load index:', err);
      UI.showHomeError(`Could not load music library. ${err.message}`);
    }
  }

  // ── Open Album ──
  async function openAlbum(albumSummary) {
    UI.showAlbumLoading();
    document.getElementById('album-title-text').textContent  = albumSummary.title;
    document.getElementById('album-artist-text').textContent = albumSummary.artist;
    document.getElementById('album-year-text').textContent   = albumSummary.year || '';
    const coverEl = document.getElementById('album-cover');
    if (albumSummary.cover) coverEl.src = albumSummary.cover;
    document.getElementById('album-loading').classList.remove('hidden');
    UI.showScreen('album', { albumTitle: albumSummary.title });

    try {
      const albumData = await API.loadAlbum(albumSummary.id);
      albumData.coverUrl = albumSummary.cover;
      allLoadedAlbums[albumSummary.id] = albumData;
      Search.refreshTrackIndex(); // update search index with new data
      UI.renderAlbumPage(albumSummary, albumData);
    } catch (err) {
      document.getElementById('album-loading').classList.add('hidden');
      document.getElementById('track-list').innerHTML =
        `<li style="padding:20px;color:var(--text-3);">Could not load tracks: ${escHtml(err.message)}</li>`;
    }
  }

  // ── Open album and play a specific track (from search results) ──
  async function openAlbumAndPlayTrack(albumSummary, trackFile) {
    try {
      const albumData = await API.loadAlbum(albumSummary.id);
      albumData.coverUrl = albumSummary.cover;
      allLoadedAlbums[albumSummary.id] = albumData;

      const trackIndex = albumData.tracks.findIndex(t => t.file === trackFile);
      Player.loadAlbumQueue(albumData, Math.max(0, trackIndex));
    } catch (err) {
      console.error('Failed to load album for track play:', err);
    }
  }

  // ── Home action buttons ──
  function bindHomeActions() {
    document.getElementById('btn-shuffle-all').addEventListener('click', shuffleAll);
    document.getElementById('btn-play-random-album').addEventListener('click', randomAlbum);
    document.getElementById('btn-play-recent').addEventListener('click', resumeLast);
  }

  async function shuffleAll() {
    const albums = indexData?.albums || [];
    if (albums.length === 0) return;

    // Load all albums and build a mega flat queue
    const allTracks = [];
    for (const summary of albums) {
      try {
        const data = await API.loadAlbum(summary.id);
        data.coverUrl = summary.cover;
        allLoadedAlbums[summary.id] = data;
        data.tracks.forEach(t => {
          allTracks.push({
            title:      API.normalizeFilename(t.file),
            file:       t.file,
            trackNum:   t.track,
            albumTitle: data.album,
            artist:     data.artist,
            cover:      data.coverUrl,
            releaseTag: data.releaseTag,
            audioUrl:   API.getAudioUrl(data.releaseTag, t.file),
          });
        });
      } catch { /* skip failed albums */ }
    }

    if (allTracks.length === 0) return;

    // Fisher-Yates shuffle
    for (let i = allTracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allTracks[i], allTracks[j]] = [allTracks[j], allTracks[i]];
    }

    // Build fake album object
    const fakeAlbum = {
      album:      'Shuffle All',
      artist:     'All Artists',
      releaseTag: '__shuffle__',
      coverUrl:   null,
      tracks:     allTracks.map((t, i) => ({ ...t, track: i + 1 })),
    };

    Player.loadAlbumQueue(fakeAlbum, 0, { prebuilt: true });
    Search.refreshTrackIndex();
  }

  async function randomAlbum() {
    const albums = indexData?.albums || [];
    if (albums.length === 0) return;
    const pick = albums[Math.floor(Math.random() * albums.length)];
    try {
      const data = await API.loadAlbum(pick.id);
      data.coverUrl = pick.cover;
      allLoadedAlbums[pick.id] = data;
      Player.loadAlbumQueue(data, 0);
    } catch (err) {
      console.error('Random album failed:', err);
    }
  }

  async function resumeLast() {
    const recents = getRecents();
    if (recents.length === 0) return;
    const last = recents[0];
    const albums = indexData?.albums || [];
    const summary = albums.find(a => a.id === last.albumId);
    if (!summary) return;

    try {
      const data = await API.loadAlbum(summary.id);
      data.coverUrl = summary.cover;
      const trackIndex = data.tracks.findIndex(t => t.file === last.trackFile);
      Player.loadAlbumQueue(data, Math.max(0, trackIndex));
    } catch (err) {
      console.error('Resume failed:', err);
    }
  }

  // ── Recents (stored in localStorage) ──
  function getRecents() {
    try {
      return JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]');
    } catch { return []; }
  }

  function addRecent(albumId, trackFile) {
    const recents = getRecents().filter(r => r.albumId !== albumId);
    recents.unshift({ albumId, trackFile });
    localStorage.setItem(RECENTS_KEY, JSON.stringify(recents.slice(0, 20)));
    // Refresh recents row if on home
    const albums = indexData?.albums || [];
    UI.renderRecents(getRecents(), albums);
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  document.addEventListener('DOMContentLoaded', boot);

  return {
    loadIndex,
    openAlbum,
    openAlbumAndPlayTrack,
    addRecent,
    getIndexData: () => indexData,
  };

})();

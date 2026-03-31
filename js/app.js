/**
 * app.js — Main app orchestrator for git-play
 * Boots the app, coordinates API ↔ UI ↔ Player
 */

const App = (() => {

  let indexData = null; // full index.json data

  // ── Boot ──
  async function boot() {
    UI.init();
    Player.init();
    await loadIndex();
  }

  // ── Load index.json ──
  async function loadIndex() {
    UI.showHomeLoading();

    try {
      indexData = await API.loadIndex();
      const albums = indexData.albums || [];

      UI.renderAlbumGrid(albums);
      UI.renderLibrary(albums);
    } catch (err) {
      console.error('Failed to load index:', err);
      UI.showHomeError(
        `Could not load music library.\n${err.message}`
      );
    }
  }

  // ── Open Album ──
  async function openAlbum(albumSummary) {
    // Immediately show the album screen with loading state
    UI.showAlbumLoading();

    // Pre-fill hero with what we already know
    document.getElementById('album-title-text').textContent  = albumSummary.title;
    document.getElementById('album-artist-text').textContent = albumSummary.artist;
    document.getElementById('album-year-text').textContent   = albumSummary.year || '';
    const coverEl = document.getElementById('album-cover');
    if (albumSummary.cover) {
      coverEl.src = albumSummary.cover;
    }
    document.getElementById('album-loading').classList.remove('hidden');
    UI.showScreen('album', { albumTitle: albumSummary.title });

    try {
      const albumData = await API.loadAlbum(albumSummary.id);
      albumData.coverUrl = albumSummary.cover;
      UI.renderAlbumPage(albumSummary, albumData);
    } catch (err) {
      console.error('Failed to load album:', err);
      document.getElementById('album-loading').classList.add('hidden');
      document.getElementById('track-list').innerHTML =
        `<li style="padding:20px;color:var(--text-3);">Could not load tracks: ${err.message}</li>`;
    }
  }

  // ── Start ──
  document.addEventListener('DOMContentLoaded', boot);

  return {
    loadIndex,
    openAlbum,
  };

})();

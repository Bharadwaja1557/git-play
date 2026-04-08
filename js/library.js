/**
 * library.js — Liked songs and library management
 * Persists to localStorage. Foundation for playlists/folders later.
 */

const Library = (() => {

  const LIKED_KEY = 'gp_liked_songs';

  // ── Storage ──
  function getLiked() {
    try {
      return JSON.parse(localStorage.getItem(LIKED_KEY) || '[]');
    } catch { return []; }
  }

  function saveLiked(liked) {
    localStorage.setItem(LIKED_KEY, JSON.stringify(liked));
  }

  function getLikedId(track) {
    // Unique ID = releaseTag + filename
    return `${track.releaseTag}::${track.file}`;
  }

  // ── Public: like / unlike ──
  function isLiked(track) {
    if (!track) return false;
    const id = getLikedId(track);
    return getLiked().some(t => t.id === id);
  }

  function toggleLike(track) {
    const id    = getLikedId(track);
    const liked = getLiked();
    const idx   = liked.findIndex(t => t.id === id);

    if (idx >= 0) {
      liked.splice(idx, 1);
    } else {
      liked.unshift({
        id,
        title:      track.title,
        file:       track.file,
        releaseTag: track.releaseTag,
        artist:     track.artist,
        albumTitle: track.albumTitle,
        cover:      track.cover,
        audioUrl:   track.audioUrl,
        likedAt:    Date.now(),
      });
    }

    saveLiked(liked);
    updateLikedUI();
    return idx < 0; // true = now liked
  }

  function toggleLikeCurrentTrack() {
    const state = Player.getState();
    if (state.currentIndex < 0) return;
    const track = state.queue[state.currentIndex];
    const nowLiked = toggleLike(track);
    // Update heart button in full player
    document.getElementById('player-like').classList.toggle('liked', nowLiked);
  }

  // ── UI updates ──
  function updateLikedUI() {
    const liked = getLiked();
    const count = liked.length;

    // Update shortcut count
    const el = document.getElementById('liked-count');
    if (el) el.textContent = `${count} song${count !== 1 ? 's' : ''}`;

    // Update liked screen meta
    const metaCount = document.getElementById('liked-meta-count');
    if (metaCount) metaCount.textContent = `${count} song${count !== 1 ? 's' : ''}`;
  }

  function updateLikeButton() {
    const state = Player.getState();
    const btn = document.getElementById('player-like');
    if (!btn || state.currentIndex < 0) return;
    const track = state.queue[state.currentIndex];
    btn.classList.toggle('liked', isLiked(track));
  }

  // ── Open liked songs screen ──
  function openLiked() {
    renderLikedScreen();
    UI.showScreen('liked');
  }

  function renderLikedScreen() {
    const liked = getLiked();
    const list  = document.getElementById('liked-track-list');
    const empty = document.getElementById('liked-empty');
    const meta  = document.getElementById('liked-meta-count');

    list.innerHTML = '';
    meta.textContent = `${liked.length} song${liked.length !== 1 ? 's' : ''}`;

    if (liked.length === 0) {
      empty.classList.remove('hidden');
      document.getElementById('btn-play-liked').style.display = 'none';
      return;
    }

    empty.classList.add('hidden');
    document.getElementById('btn-play-liked').style.display = '';

    liked.forEach((track, index) => {
      const item = document.createElement('li');
      item.className = 'liked-track-item';

      item.innerHTML = `
        <div class="track-num">
          <span class="track-num-val">${index + 1}</span>
        </div>
        <div class="liked-track-info">
          <div class="liked-track-title">${escHtml(track.title)}</div>
          <div class="liked-track-sub">${escHtml(track.artist)} · ${escHtml(track.albumTitle)}</div>
        </div>
        <button class="liked-track-remove" aria-label="Remove from liked" title="Remove">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
          </svg>
        </button>
      `;

      // Click track row → play from liked queue
      item.addEventListener('click', e => {
        if (e.target.closest('.liked-track-remove')) return;
        playLikedFrom(index);
      });

      // Remove button
      item.querySelector('.liked-track-remove').addEventListener('click', e => {
        e.stopPropagation();
        const saved = getLiked();
        saved.splice(index, 1);
        saveLiked(saved);
        updateLikedUI();
        renderLikedScreen(); // re-render
      });

      list.appendChild(item);
    });

    // Play all liked
    document.getElementById('btn-play-liked').onclick = () => playLikedFrom(0);
  }

  function playLikedFrom(startIndex) {
    const liked = getLiked();
    if (liked.length === 0) return;

    // Build a fake albumData-style object so Player.loadAlbumQueue works
    const fakeAlbum = {
      album:      'Liked Songs',
      artist:     'Various',
      releaseTag: '__liked__',
      coverUrl:   null,
      tracks:     liked.map((t, i) => ({
        track:      i + 1,
        file:       t.file,
        // Pre-resolved fields (player will use these directly)
        _title:     t.title,
        _artist:    t.artist,
        _albumTitle: t.albumTitle,
        _cover:     t.cover,
        _audioUrl:  t.audioUrl,
        _releaseTag: t.releaseTag,
      })),
    };

    // Override API.getAudioUrl for liked tracks which have pre-built URLs
    Player.loadAlbumQueue(fakeAlbum, startIndex, { isLiked: true });
  }

  // ── Render library screen ──
  function renderLibraryScreen(albums) {
    renderStats(albums);
    renderLibraryAlbums(albums);
    updateLikedUI();
  }

  function renderStats(albums) {
    const liked  = getLiked();
    const tracks = albums.reduce((acc, a) => acc, 0); // will be summed from loaded data
    const statsEl = document.getElementById('library-stats');
    if (!statsEl) return;

    statsEl.innerHTML = `
      <div class="stat-card">
        <div class="stat-number">${albums.length}</div>
        <div class="stat-label">Albums</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${liked.length}</div>
        <div class="stat-label">Liked</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${new Set(albums.map(a => a.artist)).size}</div>
        <div class="stat-label">Artists</div>
      </div>
    `;
  }

  function renderLibraryAlbums(albums) {
    const list = document.getElementById('library-albums-list');
    if (!list) return;
    list.innerHTML = '';

    albums.forEach(album => {
      const item = document.createElement('div');
      item.className = 'library-item';

      const coverHTML = album.cover
        ? `<img class="library-item-cover" src="${album.cover}" alt="" loading="lazy" />`
        : `<div class="library-item-cover-placeholder">♪</div>`;

      item.innerHTML = `
        ${coverHTML}
        <div class="library-item-info">
          <div class="library-item-title">${escHtml(album.title)}</div>
          <div class="library-item-sub">${escHtml(album.artist)} · ${album.year || ''}</div>
        </div>
        <svg class="library-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      `;

      item.addEventListener('click', () => App.openAlbum(album));
      list.appendChild(item);
    });
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return {
    isLiked,
    toggleLike,
    toggleLikeCurrentTrack,
    updateLikeButton,
    updateLikedUI,
    openLiked,
    renderLikedScreen,
    renderLibraryScreen,
  };

})();

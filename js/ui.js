/**
 * ui.js — UI rendering and screen management for git-play
 * Handles navigation, album cards, track lists, library view
 */

const UI = (() => {

  // ── Screen Management ──
  const screens = {
    home:    document.getElementById('screen-home'),
    library: document.getElementById('screen-library'),
    album:   document.getElementById('screen-album'),
  };

  const bottomNav    = document.getElementById('bottom-nav');
  const btnBack      = document.getElementById('btn-back');
  const topbarTitle  = document.getElementById('topbar-title');

  let currentScreen = 'home';
  let albumsData = []; // cache of index data for library

  // ── Navigation ──
  function showScreen(name, opts = {}) {
    const prev = screens[currentScreen];
    const next = screens[name];

    if (!next) return;

    // Deactivate all
    Object.values(screens).forEach(s => s.classList.remove('active'));

    // Activate target
    next.classList.add('active');
    currentScreen = name;

    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.screen === name);
    });

    // Back button & topbar
    if (name === 'album') {
      btnBack.classList.remove('hidden');
      topbarTitle.querySelector('.logo-text') &&
        (topbarTitle.querySelector('.logo-text').style.display = 'none');
      topbarTitle.innerHTML = `<span class="topbar-album-name">${opts.albumTitle || ''}</span>`;
    } else {
      btnBack.classList.add('hidden');
      topbarTitle.innerHTML = `<span class="logo-text">git<span class="accent">play</span></span>`;
    }

    // Scroll to top
    next.scrollTop = 0;
  }

  function goBack() {
    showScreen('home');
  }

  // ── Render Album Grid ──
  function renderAlbumGrid(albums) {
    const grid = document.getElementById('album-grid');
    const loading = document.getElementById('home-loading');

    loading.classList.add('hidden');
    grid.innerHTML = '';

    if (!albums || albums.length === 0) {
      grid.innerHTML = '<p style="color:var(--text-3);padding:20px;grid-column:1/-1;text-align:center;">No albums found.</p>';
      return;
    }

    albums.forEach(album => {
      const card = createAlbumCard(album);
      grid.appendChild(card);
    });
  }

  function createAlbumCard(album) {
    const card = document.createElement('div');
    card.className = 'album-card';
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `${album.title} by ${album.artist}`);
    card.tabIndex = 0;

    const coverHTML = album.cover
      ? `<img class="album-card-cover" src="${album.cover}" alt="${album.title}" loading="lazy" />`
      : `<div class="album-card-cover-placeholder">♪</div>`;

    card.innerHTML = `
      ${coverHTML}
      <div class="album-card-info">
        <div class="album-card-title">${escHtml(album.title)}</div>
        <div class="album-card-artist">${escHtml(album.artist)}</div>
        <div class="album-card-year">${album.year || ''}</div>
      </div>
    `;

    card.addEventListener('click', () => App.openAlbum(album));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') App.openAlbum(album);
    });

    return card;
  }

  // ── Render Album Page ──
  function renderAlbumPage(albumSummary, albumData) {
    // Merge cover from summary into albumData
    albumData.coverUrl = albumSummary.cover;

    document.getElementById('album-title-text').textContent  = albumData.album;
    document.getElementById('album-artist-text').textContent = albumData.artist;
    document.getElementById('album-year-text').textContent   = albumData.year || '';

    const coverEl = document.getElementById('album-cover');
    if (albumSummary.cover) {
      coverEl.src = albumSummary.cover;
      coverEl.alt = albumData.album;
    }

    renderTrackList(albumData);
    showScreen('album', { albumTitle: albumData.album });

    // Play-all button
    document.getElementById('btn-play-all').onclick = () => {
      Player.loadAlbumQueue(albumData, 0);
    };
  }

  function renderTrackList(albumData) {
    const list = document.getElementById('track-list');
    const loading = document.getElementById('album-loading');
    loading.classList.add('hidden');
    list.innerHTML = '';

    const state = Player.getState();

    albumData.tracks.forEach((track, index) => {
      const title = API.normalizeFilename(track.file);
      const isPlaying = (
        state.currentAlbum &&
        state.currentAlbum.releaseTag === albumData.releaseTag &&
        state.currentIndex === index
      );

      const item = document.createElement('li');
      item.className = `track-item${isPlaying ? ' playing' : ''}`;
      item.dataset.index = index;

      item.innerHTML = `
        <div class="track-num">
          <span class="track-num-val">${track.track}</span>
          <div class="track-playing-bars" aria-hidden="true">
            <div class="bar"></div>
            <div class="bar"></div>
            <div class="bar"></div>
          </div>
        </div>
        <div class="track-info">
          <div class="track-title">${escHtml(title)}</div>
        </div>
        <svg class="track-play-icon" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
      `;

      item.addEventListener('click', () => {
        Player.loadAlbumQueue(albumData, index);
        // Refresh track highlights
        setTimeout(() => refreshTrackHighlights(), 50);
      });

      list.appendChild(item);
    });
  }

  function refreshTrackHighlights() {
    const state = Player.getState();
    document.querySelectorAll('.track-item').forEach((el, i) => {
      el.classList.toggle('playing', i === state.currentIndex);
    });
  }

  // ── Render Library ──
  function renderLibrary(albums) {
    albumsData = albums;
    const list = document.getElementById('library-list');
    list.innerHTML = '';
    renderLibraryItems(albums, list);
  }

  function renderLibraryItems(albums, container) {
    container.innerHTML = '';
    if (!albums || albums.length === 0) {
      container.innerHTML = '<p style="color:var(--text-3);padding:20px;text-align:center;">Nothing found.</p>';
      return;
    }

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
      `;

      item.addEventListener('click', () => App.openAlbum(album));
      container.appendChild(item);
    });
  }

  function filterLibrary(query) {
    const q = query.toLowerCase().trim();
    const list = document.getElementById('library-list');
    if (!q) {
      renderLibraryItems(albumsData, list);
      return;
    }
    const filtered = albumsData.filter(a =>
      a.title.toLowerCase().includes(q) ||
      a.artist.toLowerCase().includes(q)
    );
    renderLibraryItems(filtered, list);
  }

  // ── Loading States ──
  function showHomeLoading() {
    document.getElementById('home-loading').classList.remove('hidden');
    document.getElementById('home-error').classList.add('hidden');
    document.getElementById('album-grid').innerHTML = '';
  }

  function showHomeError(msg) {
    const loading = document.getElementById('home-loading');
    const error   = document.getElementById('home-error');
    const errMsg  = document.getElementById('home-error-msg');
    loading.classList.add('hidden');
    error.classList.remove('hidden');
    errMsg.textContent = msg || 'Could not load library.';
  }

  function showAlbumLoading() {
    document.getElementById('album-loading').classList.remove('hidden');
    document.getElementById('track-list').innerHTML = '';
  }

  // ── Utils ──
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Init ──
  function init() {
    // Nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.screen;
        if (name) showScreen(name);
      });
    });

    // Back button
    btnBack.addEventListener('click', goBack);

    // Search input
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', () => filterLibrary(searchInput.value));
  }

  return {
    init,
    showScreen,
    goBack,
    renderAlbumGrid,
    renderAlbumPage,
    renderLibrary,
    showHomeLoading,
    showHomeError,
    showAlbumLoading,
    refreshTrackHighlights,
  };

})();

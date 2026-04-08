/**
 * ui.js — UI rendering and screen management for git-play
 */

const UI = (() => {

  const screens = {
    home:    document.getElementById('screen-home'),
    search:  document.getElementById('screen-search'),
    library: document.getElementById('screen-library'),
    album:   document.getElementById('screen-album'),
    liked:   document.getElementById('screen-liked'),
  };

  const btnBack     = document.getElementById('btn-back');
  const topbarTitle = document.getElementById('topbar-title');

  // Screens that hide the bottom nav buttons (slide-in screens)
  const SLIDE_SCREENS = new Set(['album', 'liked']);
  // Which main tab to go back to from a slide screen
  let prevMainScreen = 'home';
  let currentScreen  = 'home';

  // ── Navigation ──
  function showScreen(name, opts = {}) {
    if (!screens[name]) return;

    if (!SLIDE_SCREENS.has(name)) {
      prevMainScreen = name;
    }

    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
    currentScreen = name;

    // Nav highlight — only highlight main tabs
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.screen === name);
    });

    // Back button visible only on slide screens
    if (SLIDE_SCREENS.has(name)) {
      btnBack.classList.remove('hidden');
      topbarTitle.innerHTML = `<span class="topbar-album-name">${escHtml(opts.albumTitle || '')}</span>`;
    } else {
      btnBack.classList.add('hidden');
      topbarTitle.innerHTML = `<span class="logo-text">git<span class="accent">play</span></span>`;
    }

    screens[name].scrollTop = 0;
  }

  function goBack() {
    showScreen(prevMainScreen);
  }

  // ── Greeting ──
  function setGreeting() {
    const h = new Date().getHours();
    const text =
      h < 12 ? 'Good morning' :
      h < 17 ? 'Good afternoon' :
               'Good evening';
    const el = document.getElementById('greeting-text');
    if (el) el.textContent = text;
  }

  // ── Album Grid (Home) ──
  function renderAlbumGrid(albums) {
    const grid    = document.getElementById('album-grid');
    const loading = document.getElementById('home-loading');
    const count   = document.getElementById('album-count');

    loading.classList.add('hidden');
    grid.innerHTML = '';
    if (count) count.textContent = `${albums.length} album${albums.length !== 1 ? 's' : ''}`;

    if (!albums || albums.length === 0) {
      grid.innerHTML = '<p style="color:var(--text-3);padding:20px;grid-column:1/-1;text-align:center;">No albums found.</p>';
      return;
    }

    albums.forEach(album => grid.appendChild(createAlbumCard(album)));
  }

  function createAlbumCard(album) {
    const card = document.createElement('div');
    card.className = 'album-card';
    card.setAttribute('role', 'button');
    card.tabIndex = 0;

    const coverHTML = album.cover
      ? `<img class="album-card-cover" src="${album.cover}" alt="${escHtml(album.title)}" loading="lazy" />`
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

  // ── Recently Played ──
  function renderRecents(recents, albums) {
    const list    = document.getElementById('recents-list');
    const section = document.getElementById('section-recents');
    if (!list) return;

    // recents = array of {albumId, trackFile} from localStorage
    // Filter to only valid albums that are still in index
    const albumMap = Object.fromEntries(albums.map(a => [a.id, a]));
    const valid = recents
      .map(r => albumMap[r.albumId])
      .filter(Boolean)
      // dedupe by id
      .filter((a, i, arr) => arr.findIndex(x => x.id === a.id) === i)
      .slice(0, 8);

    if (valid.length === 0) {
      list.innerHTML = '<p class="empty-hint" style="padding:4px 0;">Nothing yet — start playing something!</p>';
      return;
    }

    list.innerHTML = '';
    valid.forEach(album => {
      const card = document.createElement('div');
      card.className = 'recent-card';

      const coverHTML = album.cover
        ? `<img class="recent-card-cover" src="${album.cover}" alt="" loading="lazy" />`
        : `<div class="recent-card-cover-placeholder">♪</div>`;

      card.innerHTML = `
        ${coverHTML}
        <div class="recent-card-title">${escHtml(album.title)}</div>
        <div class="recent-card-artist">${escHtml(album.artist)}</div>
      `;

      card.addEventListener('click', () => App.openAlbum(album));
      list.appendChild(card);
    });
  }

  // ── Album Page ──
  function renderAlbumPage(albumSummary, albumData) {
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

    document.getElementById('btn-play-all').onclick = () => {
      Player.loadAlbumQueue(albumData, 0);
    };
  }

  function renderTrackList(albumData) {
    const list    = document.getElementById('track-list');
    const loading = document.getElementById('album-loading');
    loading.classList.add('hidden');
    list.innerHTML = '';

    const state = Player.getState();

    albumData.tracks.forEach((track, index) => {
      const title     = API.normalizeFilename(track.file);
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
            <div class="bar"></div><div class="bar"></div><div class="bar"></div>
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
        setTimeout(refreshTrackHighlights, 50);
      });

      list.appendChild(item);
    });
  }

  function refreshTrackHighlights() {
    const state = Player.getState();
    document.querySelectorAll('#track-list .track-item').forEach((el, i) => {
      el.classList.toggle('playing', i === state.currentIndex);
    });
  }

  // ── Loading / Error States ──
  function showHomeLoading() {
    document.getElementById('home-loading').classList.remove('hidden');
    document.getElementById('home-error').classList.add('hidden');
    document.getElementById('album-grid').innerHTML = '';
  }

  function showHomeError(msg) {
    document.getElementById('home-loading').classList.add('hidden');
    document.getElementById('home-error').classList.remove('hidden');
    document.getElementById('home-error-msg').textContent = msg || 'Could not load library.';
  }

  function showAlbumLoading() {
    document.getElementById('album-loading').classList.remove('hidden');
    document.getElementById('track-list').innerHTML = '';
  }

  // ── Utils ──
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Init ──
  function init() {
    setGreeting();

    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.screen;
        if (name) showScreen(name);
      });
    });

    btnBack.addEventListener('click', goBack);
    Search.init();
  }

  return {
    init,
    showScreen,
    goBack,
    renderAlbumGrid,
    renderAlbumPage,
    renderRecents,
    showHomeLoading,
    showHomeError,
    showAlbumLoading,
    refreshTrackHighlights,
  };

})();

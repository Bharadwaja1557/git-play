/**
 * search.js — Full-text search across tracks, albums, artists, years
 */

const Search = (() => {

  let allAlbums    = [];   // index.json summaries
  let allTracks    = [];   // flat list of all tracks (populated lazily)
  let activeFilter = 'all';
  let browseMode   = null; // null | 'artist' | 'year' | 'album'

  // ── Init ──
  function init() {
    const input     = document.getElementById('search-input');
    const clearBtn  = document.getElementById('search-clear');
    const chips     = document.querySelectorAll('.chip');

    input.addEventListener('input', () => {
      const q = input.value.trim();
      clearBtn.classList.toggle('hidden', q.length === 0);
      hideBrowse();
      if (q.length === 0) {
        showBrowseState();
      } else {
        runSearch(q);
      }
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.classList.add('hidden');
      showBrowseState();
    });

    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeFilter = chip.dataset.filter;
        const q = input.value.trim();
        if (q.length > 0) runSearch(q);
      });
    });
  }

  function setAlbums(albums) {
    allAlbums = albums;
    buildTrackIndex(albums);
  }

  // ── Build flat track index from loaded album data ──
  // Called lazily; tracks are resolved from cached album JSONs
  function buildTrackIndex(albums) {
    allTracks = [];
    // Try to pull from localStorage cache for each album
    albums.forEach(albumSummary => {
      try {
        const cacheKey = `gp_album_${albumSummary.id}`;
        const raw = localStorage.getItem(cacheKey);
        if (!raw) return;
        const { data } = JSON.parse(raw);
        if (!data || !data.tracks) return;
        data.tracks.forEach(t => {
          allTracks.push({
            title:      API.normalizeFilename(t.file),
            file:       t.file,
            releaseTag: data.releaseTag,
            artist:     data.artist,
            albumTitle: data.album,
            albumId:    albumSummary.id,
            albumSummary,
            year:       data.year,
          });
        });
      } catch { /* skip */ }
    });
  }

  // ── Search ──
  function runSearch(q) {
    const query = q.toLowerCase().trim();
    showResultsState();

    // Year search: if query is exactly 4 digits treat as year filter
    const isYear = /^\d{4}$/.test(query);

    let matchedTracks = [];
    let matchedAlbums = [];

    if (activeFilter === 'all' || activeFilter === 'track') {
      matchedTracks = allTracks.filter(t => {
        if (isYear || activeFilter === 'year') return String(t.year) === query;
        return (
          t.title.toLowerCase().includes(query) ||
          t.artist.toLowerCase().includes(query) ||
          t.albumTitle.toLowerCase().includes(query)
        );
      });
    }

    if (activeFilter === 'all' || activeFilter === 'album') {
      matchedAlbums = allAlbums.filter(a => {
        if (isYear || activeFilter === 'year') return String(a.year) === query;
        return (
          a.title.toLowerCase().includes(query) ||
          a.artist.toLowerCase().includes(query)
        );
      });
    }

    if (activeFilter === 'year') {
      // Year mode: show both tracks and albums from that year
      matchedAlbums = allAlbums.filter(a => String(a.year) === query);
      matchedTracks = allTracks.filter(t => String(t.year) === query);
    }

    if (activeFilter === 'artist') {
      matchedTracks = allTracks.filter(t => t.artist.toLowerCase().includes(query));
      matchedAlbums = allAlbums.filter(a => a.artist.toLowerCase().includes(query));
    }

    renderResults(matchedTracks, matchedAlbums);
  }

  function renderResults(tracks, albums) {
    const tracksSection = document.getElementById('results-tracks-section');
    const albumsSection = document.getElementById('results-albums-section');
    const emptyMsg      = document.getElementById('results-empty');
    const tracksList    = document.getElementById('results-tracks');
    const albumsList    = document.getElementById('results-albums');

    tracksList.innerHTML = '';
    albumsList.innerHTML = '';

    const hasResults = tracks.length > 0 || albums.length > 0;
    emptyMsg.classList.toggle('hidden', hasResults);

    // Render tracks
    tracksSection.classList.toggle('hidden', tracks.length === 0);
    tracks.slice(0, 30).forEach((track, i) => {
      const item = document.createElement('li');
      item.className = 'track-item';
      item.innerHTML = `
        <div class="track-num">
          <span class="track-num-val">${i + 1}</span>
        </div>
        <div class="track-info">
          <div class="track-title">${escHtml(track.title)}</div>
          <div style="font-size:0.76rem;color:var(--text-2);margin-top:2px;">${escHtml(track.artist)} · ${escHtml(track.albumTitle)}</div>
        </div>
        <svg class="track-play-icon" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
      `;
      item.addEventListener('click', () => {
        // Load the album and start playing from this track
        App.openAlbumAndPlayTrack(track.albumSummary, track.file);
      });
      tracksList.appendChild(item);
    });

    // Render albums
    albumsSection.classList.toggle('hidden', albums.length === 0);
    albums.forEach(album => {
      const item = document.createElement('div');
      item.className = 'result-album-item';

      const coverHTML = album.cover
        ? `<img class="result-album-cover" src="${album.cover}" alt="" loading="lazy" />`
        : `<div class="result-album-cover-placeholder">♪</div>`;

      item.innerHTML = `
        ${coverHTML}
        <div class="result-album-info">
          <div class="result-album-title">${escHtml(album.title)}</div>
          <div class="result-album-sub">${escHtml(album.artist)} · ${album.year || ''}</div>
        </div>
      `;

      item.addEventListener('click', () => App.openAlbum(album));
      albumsList.appendChild(item);
    });
  }

  // ── Browse modes ──
  function browseByArtist() {
    const grouped = {};
    allAlbums.forEach(a => {
      if (!grouped[a.artist]) grouped[a.artist] = [];
      grouped[a.artist].push(a);
    });
    showBrowseResults('Artists', grouped, (a) => App.openAlbum(a));
    browseMode = 'artist';
  }

  function browseByYear() {
    const grouped = {};
    allAlbums.forEach(a => {
      const y = String(a.year || 'Unknown');
      if (!grouped[y]) grouped[y] = [];
      grouped[y].push(a);
    });
    // Sort years descending
    const sorted = {};
    Object.keys(grouped).sort((a, b) => b - a).forEach(k => sorted[k] = grouped[k]);
    showBrowseResults('Years', sorted, (a) => App.openAlbum(a));
    browseMode = 'year';
  }

  function browseByAlbum() {
    const grouped = {};
    allAlbums.forEach(a => {
      const letter = (a.title[0] || '#').toUpperCase();
      const key = /[A-Z]/.test(letter) ? letter : '#';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(a);
    });
    showBrowseResults('Albums A–Z', grouped, (a) => App.openAlbum(a));
    browseMode = 'album';
  }

  function showBrowseResults(label, grouped, onClickItem) {
    document.getElementById('search-browse').classList.add('hidden');
    document.getElementById('search-results').classList.add('hidden');
    document.getElementById('browse-results').classList.remove('hidden');
    document.getElementById('browse-results-label').textContent = label;

    const container = document.getElementById('browse-results-list');
    container.innerHTML = '';

    Object.entries(grouped).forEach(([groupKey, albums]) => {
      const group = document.createElement('div');
      group.className = 'browse-group';
      group.innerHTML = `<div class="browse-group-label">${escHtml(groupKey)}</div>`;

      albums.forEach(album => {
        const item = document.createElement('div');
        item.className = 'result-album-item';

        const coverHTML = album.cover
          ? `<img class="result-album-cover" src="${album.cover}" alt="" loading="lazy" />`
          : `<div class="result-album-cover-placeholder">♪</div>`;

        item.innerHTML = `
          ${coverHTML}
          <div class="result-album-info">
            <div class="result-album-title">${escHtml(album.title)}</div>
            <div class="result-album-sub">${escHtml(album.artist)} · ${album.year || ''}</div>
          </div>
        `;

        item.addEventListener('click', () => onClickItem(album));
        group.appendChild(item);
      });

      container.appendChild(group);
    });
  }

  function clearBrowse() {
    browseMode = null;
    hideBrowse();
    showBrowseState();
  }

  // ── State helpers ──
  function showBrowseState() {
    document.getElementById('search-browse').classList.remove('hidden');
    document.getElementById('search-results').classList.add('hidden');
    document.getElementById('browse-results').classList.add('hidden');
  }

  function showResultsState() {
    document.getElementById('search-browse').classList.add('hidden');
    document.getElementById('search-results').classList.remove('hidden');
    document.getElementById('browse-results').classList.add('hidden');
  }

  function hideBrowse() {
    document.getElementById('browse-results').classList.add('hidden');
  }

  // Rebuild track index when new album data is loaded
  function refreshTrackIndex() {
    buildTrackIndex(allAlbums);
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return {
    init,
    setAlbums,
    refreshTrackIndex,
    browseByArtist,
    browseByYear,
    browseByAlbum,
    clearBrowse,
  };

})();

/**
 * player.js — Audio player engine for git-play
 * Manages playback state, seek, queue, and UI sync
 */

const Player = (() => {

  // ── State ──
  const state = {
    queue: [],          // Array of track objects
    currentIndex: -1,
    isPlaying: false,
    shuffle: false,
    repeat: false,      // false | 'one' | 'all'
    currentAlbum: null, // The full album object currently in queue
    expanded: false,
  };

  // ── Elements ──
  const audio    = document.getElementById('audio-el');
  const miniPlayer = document.getElementById('mini-player');
  const fullPlayer = document.getElementById('full-player');

  // Mini player elements
  const miniCover  = document.getElementById('mini-cover');
  const miniTitle  = document.getElementById('mini-title');
  const miniArtist = document.getElementById('mini-artist');
  const miniPlayIcon  = document.getElementById('mini-play-icon');
  const miniProgressFill = document.getElementById('mini-progress-fill');

  // Full player elements
  const playerCover        = document.getElementById('player-cover');
  const playerTrackTitle   = document.getElementById('player-track-title');
  const playerTrackArtist  = document.getElementById('player-track-artist');
  const playerAlbumName    = document.getElementById('player-album-name');
  const seekBarFill        = document.getElementById('seek-bar-fill');
  const seekThumb          = document.getElementById('seek-thumb');
  const seekCurrent        = document.getElementById('seek-current');
  const seekDuration       = document.getElementById('seek-duration');
  const ctrlPlayIcon       = document.getElementById('ctrl-play-icon');
  const queueNextTitle     = document.getElementById('queue-next-title');
  const volumeSlider       = document.getElementById('volume-slider');

  // Buttons
  const miniPlay   = document.getElementById('mini-play');
  const miniPrev   = document.getElementById('mini-prev');
  const miniNext   = document.getElementById('mini-next');
  const ctrlPlay   = document.getElementById('ctrl-play');
  const ctrlPrev   = document.getElementById('ctrl-prev');
  const ctrlNext   = document.getElementById('ctrl-next');
  const ctrlShuffle = document.getElementById('ctrl-shuffle');
  const ctrlRepeat  = document.getElementById('ctrl-repeat');

  // ── SVG icons ──
  const PLAY_ICON  = '<polygon points="5 3 19 12 5 21 5 3"/>';
  const PAUSE_ICON = '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>';

  // ── Init ──
  function init() {
    audio.volume = 1;

    // Audio events
    audio.addEventListener('play',      onPlay);
    audio.addEventListener('pause',     onPause);
    audio.addEventListener('ended',     onEnded);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onMetadata);
    audio.addEventListener('error',     onError);

    // Controls
    miniPlay.addEventListener('click', togglePlay);
    miniPrev.addEventListener('click', prevTrack);
    miniNext.addEventListener('click', nextTrack);
    ctrlPlay.addEventListener('click', togglePlay);
    ctrlPrev.addEventListener('click', prevTrack);
    ctrlNext.addEventListener('click', nextTrack);
    ctrlShuffle.addEventListener('click', toggleShuffle);
    ctrlRepeat.addEventListener('click', toggleRepeat);
    volumeSlider.addEventListener('input', onVolumeChange);

    // Seek bar
    initSeekBar();
  }

  // ── Seek bar (touch + mouse) ──
  function initSeekBar() {
    const track = document.getElementById('seek-bar-track');
    let dragging = false;

    function seek(e) {
      const rect = track.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      if (audio.duration) {
        audio.currentTime = pct * audio.duration;
        updateSeekUI(pct);
      }
    }

    track.addEventListener('mousedown', e => { dragging = true; seek(e); });
    track.addEventListener('touchstart', e => { dragging = true; seek(e); }, { passive: true });

    window.addEventListener('mousemove', e => { if (dragging) seek(e); });
    window.addEventListener('touchmove', e => { if (dragging) seek(e); }, { passive: true });

    window.addEventListener('mouseup', () => { dragging = false; });
    window.addEventListener('touchend', () => { dragging = false; });
  }

  // ── Queue loading ──
  function loadAlbumQueue(albumData, startIndex = 0) {
    state.currentAlbum = albumData;

    state.queue = albumData.tracks.map(t => ({
      title:      API.normalizeFilename(t.file),
      file:       t.file,
      trackNum:   t.track,
      albumTitle: albumData.album,
      artist:     albumData.artist,
      cover:      albumData.coverUrl, // set by UI layer
      releaseTag: albumData.releaseTag,
      audioUrl:   API.getAudioUrl(albumData.releaseTag, t.file),
    }));

    playAt(startIndex);
  }

  function playAt(index) {
    if (index < 0 || index >= state.queue.length) return;
    state.currentIndex = index;
    const track = state.queue[index];

    audio.src = track.audioUrl;
    audio.preload = 'metadata';
    audio.load();
    audio.play().catch(err => console.warn('Autoplay blocked:', err));

    showMiniPlayer();
    updateUI();
    updateTrackHighlight();
    updateQueuePreview();
  }

  // ── Playback controls ──
  function togglePlay() {
    if (audio.paused) {
      audio.play().catch(console.warn);
    } else {
      audio.pause();
    }
  }

  function nextTrack() {
    if (state.shuffle) {
      const idx = Math.floor(Math.random() * state.queue.length);
      playAt(idx);
      return;
    }
    if (state.currentIndex < state.queue.length - 1) {
      playAt(state.currentIndex + 1);
    } else if (state.repeat === 'all') {
      playAt(0);
    }
  }

  function prevTrack() {
    // If >3s in, restart; else go previous
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    if (state.currentIndex > 0) {
      playAt(state.currentIndex - 1);
    } else {
      audio.currentTime = 0;
    }
  }

  function toggleShuffle() {
    state.shuffle = !state.shuffle;
    ctrlShuffle.classList.toggle('active', state.shuffle);
  }

  function toggleRepeat() {
    if (!state.repeat) {
      state.repeat = 'all';
      ctrlRepeat.classList.add('active');
    } else if (state.repeat === 'all') {
      state.repeat = 'one';
      // Show "1" overlay — simple approach: change opacity
      ctrlRepeat.style.color = 'var(--accent)';
    } else {
      state.repeat = false;
      ctrlRepeat.classList.remove('active');
      ctrlRepeat.style.color = '';
    }
  }

  function onVolumeChange() {
    audio.volume = parseFloat(volumeSlider.value);
  }

  // ── Audio event handlers ──
  function onPlay() {
    state.isPlaying = true;
    setPlayIcons(true);
    playerCover.classList.add('playing');
  }

  function onPause() {
    state.isPlaying = false;
    setPlayIcons(false);
    playerCover.classList.remove('playing');
  }

  function onEnded() {
    if (state.repeat === 'one') {
      audio.currentTime = 0;
      audio.play();
      return;
    }
    nextTrack();
  }

  function onTimeUpdate() {
    if (!audio.duration) return;
    const pct = audio.currentTime / audio.duration;
    updateSeekUI(pct);
    miniProgressFill.style.width = `${pct * 100}%`;
    seekCurrent.textContent = formatTime(audio.currentTime);
  }

  function onMetadata() {
    seekDuration.textContent = formatTime(audio.duration);
  }

  function onError() {
    console.error('Audio error:', audio.error);
  }

  // ── UI updates ──
  function setPlayIcons(playing) {
    const icon = playing ? PAUSE_ICON : PLAY_ICON;
    miniPlayIcon.innerHTML = icon;
    ctrlPlayIcon.innerHTML = icon;
  }

  function updateSeekUI(pct) {
    const p = pct * 100;
    seekBarFill.style.width = `${p}%`;
    seekThumb.style.left = `${p}%`;
    seekCurrent.textContent = formatTime(audio.currentTime);
  }

  function updateUI() {
    if (state.currentIndex < 0) return;
    const track = state.queue[state.currentIndex];

    // Mini player
    miniTitle.textContent  = track.title;
    miniArtist.textContent = track.artist;
    if (track.cover) miniCover.src = track.cover;

    // Full player
    playerTrackTitle.textContent  = track.title;
    playerTrackArtist.textContent = track.artist;
    playerAlbumName.textContent   = track.albumTitle;
    if (track.cover) playerCover.src = track.cover;
  }

  function updateTrackHighlight() {
    // Highlight active track in the track list
    document.querySelectorAll('.track-item').forEach((el, i) => {
      el.classList.toggle('playing', i === state.currentIndex);
    });
  }

  function updateQueuePreview() {
    const next = state.queue[state.currentIndex + 1];
    queueNextTitle.textContent = next ? next.title : '—';
  }

  function showMiniPlayer() {
    miniPlayer.classList.remove('hidden');
  }

  // ── Expand / Collapse ──
  function expandPlayer() {
    state.expanded = true;
    fullPlayer.classList.remove('hidden');
    // Force reflow then animate
    requestAnimationFrame(() => {
      fullPlayer.classList.add('visible');
    });
  }

  function collapsePlayer() {
    state.expanded = false;
    fullPlayer.classList.remove('visible');
    setTimeout(() => {
      // only hide if not re-expanded
      if (!state.expanded) fullPlayer.classList.add('hidden');
    }, 420);
  }

  // ── Utils ──
  function formatTime(sec) {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  // ── Expose ──
  return {
    init,
    loadAlbumQueue,
    playAt,
    togglePlay,
    nextTrack,
    prevTrack,
    expandPlayer,
    collapsePlayer,
    getState: () => state,
  };

})();

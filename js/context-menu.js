/**
 * context-menu.js — Bottom sheet context menu for track options
 */

const ContextMenu = (() => {

  let overlay = null;
  let sheet   = null;

  function _build() {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.id = 'ctx-overlay';
    overlay.addEventListener('click', hide);

    sheet = document.createElement('div');
    sheet.id = 'ctx-sheet';

    document.getElementById('app').appendChild(overlay);
    document.getElementById('app').appendChild(sheet);
  }

  function show({ track, albumData, parsed, isStashed, onStashToggle }) {
    _build();

    const { title, singers } = parsed;
    const stashLabel = isStashed ? 'Unstash this song' : 'Stash this song';
    const stashIcon  = isStashed
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3l18 18M10.5 10.677A2 2 0 0013.5 13.5M5 12V6a1 1 0 011-1h6M19 12v6a1 1 0 01-1 1H8"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>`;

    const isLiked = Library.isLiked({ releaseTag: albumData.releaseTag, file: track.file });
    const likeLabel = isLiked ? 'Unlike this song' : 'Like this song';
    const likeIcon = `<svg viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:${isLiked ? '#c8316e' : 'inherit'}"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`;

    sheet.innerHTML = `
      <div class="ctx-handle-bar"></div>
      <div class="ctx-track-info">
        <div class="ctx-track-title">${_esc(title)}</div>
        ${singers ? `<div class="ctx-track-sub">${_esc(singers)}</div>` : `<div class="ctx-track-sub">${_esc(albumData.album)}</div>`}
      </div>
      <div class="ctx-divider"></div>
      <button class="ctx-item" id="ctx-like">
        <span class="ctx-item-icon">${likeIcon}</span>
        <span>${likeLabel}</span>
      </button>
      <button class="ctx-item" id="ctx-stash">
        <span class="ctx-item-icon">${stashIcon}</span>
        <span>${stashLabel}</span>
      </button>
      <div class="ctx-divider"></div>
      <button class="ctx-item ctx-item-disabled" disabled>
        <span class="ctx-item-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </span>
        <span>Add to playlist <span class="ctx-badge">soon</span></span>
      </button>
      <button class="ctx-item ctx-item-disabled" disabled>
        <span class="ctx-item-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </span>
        <span>View album <span class="ctx-badge">soon</span></span>
      </button>
      ${singers ? `
      <button class="ctx-item ctx-item-disabled" disabled>
        <span class="ctx-item-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </span>
        <span>View singer <span class="ctx-badge">soon</span></span>
      </button>` : ''}
    `;

    // Like action
    sheet.querySelector('#ctx-like').addEventListener('click', () => {
      const trackObj = {
        releaseTag: albumData.releaseTag,
        file:       track.file,
        title,
        artist:     albumData.artist,
        albumTitle: albumData.album,
        cover:      albumData.coverUrl,
        singers,
        audioUrl:   API.getAudioUrl(albumData.releaseTag, track.file),
      };
      Library.toggleLike(trackObj);
      hide();
      // Re-render track list to update heart state
      setTimeout(onStashToggle, 80);
    });

    // Stash action
    sheet.querySelector('#ctx-stash').addEventListener('click', () => {
      Stash.toggle(albumData.releaseTag, track.file);
      hide();
      setTimeout(onStashToggle, 80);
    });

    // Show
    overlay.classList.add('visible');
    sheet.classList.add('visible');
  }

  function hide() {
    if (!overlay) return;
    overlay.classList.remove('visible');
    sheet.classList.remove('visible');
  }

  function _esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return { show, hide };

})();

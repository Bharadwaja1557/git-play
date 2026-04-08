# git-play

A mobile-first music player that streams personal music files stored in GitHub Releases. Works entirely in the browser — no backend server required.

## Live Demo
Once deployed: `https://Bharadwaja1557.github.io/git-play`

---

## Project Structure

```
git-play/
├── index.html          ← App shell
├── css/
│   └── style.css       ← All styles (mobile-first)
├── js/
│   ├── api.js          ← Data fetching + filename normalization
│   ├── player.js       ← Audio engine
│   ├── ui.js           ← Rendering + navigation
│   └── app.js          ← Main orchestrator
└── README.md
```

---

## How It Works

```
git-play (player)
     │
     ▼
music-vault/index.json          ← Album list
     │
     ▼
music-vault/albums/{id}.json    ← Track list
     │
     ▼
GitHub Releases assets          ← Actual audio files streamed directly
```

All album metadata is cached in `localStorage` (6-hour TTL) to minimize network requests.

---

## Deployment

### Step 1 — Set up music-vault repository

1. Create a new GitHub repository named `music-vault` (can be public or private — **releases must be public**)
2. Add your `index.json` and `albums/` folder
3. **Enable GitHub Pages:**
   - Go to **Settings → Pages**
   - Source: Deploy from `main` branch, root `/`
   - Save. Your vault will be at: `https://Bharadwaja1557.github.io/music-vault/`

### Step 2 — Upload music to GitHub Releases

1. Go to `music-vault` → **Releases → Draft a new release**
2. Set the **tag** to match your album id (e.g. `dhurandhar`)
3. Upload audio files + `cover.jpg`
4. Publish the release

> ⚠️ GitHub Releases must be **public** for the audio files to stream without authentication.

### Step 3 — Deploy git-play

1. Create a new GitHub repository named `git-play`
2. Push all files from this folder
3. **Enable GitHub Pages:**
   - Go to **Settings → Pages**
   - Source: Deploy from `main` branch, root `/`
   - Save

Your player will be live at: `https://Bharadwaja1557.github.io/git-play`

---

## Connecting to music-vault

The connection is configured in `js/api.js`:

```js
const CONFIG = {
  vaultBase: 'https://Bharadwaja1557.github.io/music-vault',
  releaseBase: 'https://github.com/Bharadwaja1557/music-vault/releases/download',
};
```

If you rename the repositories or use a different GitHub username, update these two URLs.

---

## Adding Albums

### 1. Create the GitHub Release
- Tag = your album ID slug (e.g. `my-album`)
- Upload: `01.-.Track.Name.m4a`, `cover.jpg`, etc.

### 2. Create `albums/my-album.json` in music-vault:
```json
{
  "artist": "Artist Name",
  "album": "My Album",
  "year": 2025,
  "releaseTag": "my-album",
  "tracks": [
    { "track": 1, "file": "01.-.First.Track.m4a" },
    { "track": 2, "file": "02.-.Second.Track.m4a" }
  ]
}
```

### 3. Add to `index.json` in music-vault:
```json
{
  "albums": [
    {
      "id": "my-album",
      "artist": "Artist Name",
      "title": "My Album",
      "year": 2025,
      "cover": "https://github.com/Bharadwaja1557/music-vault/releases/download/my-album/cover.jpg"
    }
  ]
}
```

---

## Filename Normalization

GitHub replaces spaces with dots when uploading release assets. git-play reverses this automatically:

| File on GitHub | Displayed as |
|---|---|
| `01.-.Title.Track.m4a` | Title Track |
| `05.-.Run.Down.The.City.-.Monica.m4a` | Run Down The City - Monica |
| `12.-.Slow.Burn.m4a` | Slow Burn |

---

## Features
- 📱 Mobile-first UI with bottom mini-player (Spotify-style)
- 🎵 Full-screen player with seek, volume, shuffle, repeat
- 🔍 Search across all albums and artists
- 💾 Album metadata cached in localStorage (6h TTL)
- 🎨 Dark luxury aesthetic with warm gold accents
- ⚡ Pure vanilla HTML/CSS/JS — no frameworks, no build step

## Tech Stack
- Vanilla HTML5
- Vanilla CSS (CSS Variables, Grid, Flexbox, animations)
- Vanilla JavaScript (ES6+, modules-via-IIFE)
- HTML5 Audio API
- GitHub Pages (hosting)
- GitHub Releases (audio CDN)

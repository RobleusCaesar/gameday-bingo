# Gameday Bingo 🏈

Live watch-party bingo you can install on your phone. One person hosts and gets a
5-character code. Friends join, and everyone gets their **own card** drawn from the
same pool of squares. Tap squares as things happen during the game, and a live
leaderboard keeps score.

**Play:** https://robleuscaesar.github.io/gameday-bingo/

- No accounts and no database. Everything is saved on your device (`localStorage`, keys start with `gdb:`).
- Works offline for solo play. It's an installable PWA with "Add to Home Screen".
- Multiplayer runs over Supabase Realtime, used only as a relay (Broadcast + Presence). Nothing is stored server-side.
- Vanilla HTML/CSS/JS ES modules. No build step. Libraries load from jsDelivr.

## How to play

1. **Start a Game** → pick a square pack, type the opponent, choose ways to win and the board mix → **Create**.
2. Share the code, QR, or **Share invite** link. The link carries the whole pack, so it works even if you're offline.
3. Tap a square when it happens. Tap again to unmark. Long-press to read the full text.
4. Scoring:

   | What | Points |
   |---|---|
   | Common / Uncommon / Rare square | 1 / 2 / 3 |
   | Each completed line | +10 |
   | Four Corners | +10 |
   | X | +20 |
   | Blackout | +50 |

5. The leaderboard ranks by bingos, then points. The host (or anyone after 4 hours) can **End game** to freeze scores and show the podium.

## Setup (one time)

### 1. Supabase (for live multiplayer)

1. Create a free project at [supabase.com](https://supabase.com).
2. Go to **Project Settings → API** and copy the **Project URL** and the **anon / publishable** key.
3. Paste both into [`config.js`](config.js):
   ```js
   export const SUPABASE_URL = 'https://xxxx.supabase.co';
   export const SUPABASE_ANON_KEY = 'eyJ…';   // or sb_publishable_…
   ```
4. Under **Realtime → Settings**, make sure public channels are allowed. This is the default; don't turn on "Private channels only". No tables, policies, or SQL are needed.

The anon key is safe to publish. It can only use Realtime channels, and this app stores nothing.
Never put a `service_role` key in this repo. Free Supabase projects pause after a week of no use;
open the dashboard to wake one up.

Leave `config.js` blank and the app still works in solo mode, and invite links still work.

### 2. Board logo (optional)

Every board has a 4:1 banner at the top. To show your logo there, upload a **1200 × 300 px PNG**
(transparent background) to [`assets/`](assets/) and set `BOARD_LOGO` in `config.js`
(for example `'assets/logo.png'`). See [`assets/README.md`](assets/README.md).
Keep it free of team logos and NFL marks, since the repo is public.

### 3. GitHub Pages

In **Settings → Pages**, set **Source: GitHub Actions**. After that, every push to `main` runs
[the workflow](.github/workflows/pages.yml): unit tests, a service-worker version stamp, and a Pages deploy that retries up to 3 times.

## Develop

```bash
npx serve .              # or: python3 -m http.server 8080
npm test                 # node --test (board generation, scoring, links, SW file list)
```

Open http://localhost:3000 (serve) or http://localhost:8080 (python). Service workers need `localhost` or HTTPS.

## How it works

| File | What it does |
|---|---|
| `js/board.js` | Seeded board generation: `hash(code + playerId)` → mulberry32; rarity quotas (Chill 14/8/2, Balanced 11/9/4, Chaos 8/9/7) with backfill; at most 2 Rares per line |
| `js/rules.js` | Lines, Four Corners, X, Blackout, points, near-misses |
| `js/game.js` | A game on this device: config snapshot, board, marks, feed, players; Presence/Broadcast handling |
| `js/sync.js` | Supabase Realtime channel `game:{CODE}`: Presence summary + `mark`/`unmark`/`bingo`/`request_config`/`config`/`end` |
| `js/share.js` | Invite links `#/join/CODE~<lz-string payload>` and input sanitizing |
| `js/boardview.js` | The card: text auto-fit (never under 11px), tap / long-press, stamp animations |
| `js/fx.js`, `js/audio.js`, `js/haptics.js` | Juice: dauber blots, ink splats, BINGO slam, confetti, synthesized sounds, haptics |
| `js/sharecard.js` | PNG share card + Wordle-style emoji grid |
| `sw.js` | App-shell cache for offline play; caches jsDelivr + Google Fonts at runtime |

Boards are unique per player. With the 91-square default pack, two boards share about 27% of their squares on average.

## Privacy

No analytics, no tracking, no accounts. In a live game, other players in that game see your name, emoji, score, and which squares you marked.

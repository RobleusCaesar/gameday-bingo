# Board logo slot

Drop your logo here and it appears in the banner at the top of every player's board.

- **Size:** 1200 × 300 px (a 4:1 rectangle). Anything close to 4:1 works; it's scaled to fit, never cropped.
- **Format:** PNG with a transparent background (SVG or WebP also work). Keep it under ~200 KB.
- **Safe area:** the board is about 360 px wide on a phone, so the logo shows at roughly 360 × 90. Keep text big and bold.

Then set the path in `config.js`:

```js
export const BOARD_LOGO = 'assets/logo.png';
```

Leave `BOARD_LOGO` blank to show the "Gameday Bingo · vs {opponent}" wordmark instead.
No team logos or NFL marks, please: the repo is public.

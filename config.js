// Gameday Bingo — site configuration.
//
// Multiplayer uses Supabase Realtime as a relay only (Broadcast + Presence, no tables).
// Leave these blank and the app runs in solo/offline mode; share links still work.
// Use the project URL and the anon / publishable key. Never put a service_role key here.
export const SUPABASE_URL = 'https://cgnhatyqfddelopfjqzh.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_IQNfoXo7LuC6RYcMo2GD7Q_l05FXrKu';

// Board logo. It sits in a 4:1 banner at the top of every player's board.
// Upload a 1200×300 PNG (transparent background works best) to the assets/ folder,
// then put its path here, e.g. 'assets/logo.png'. Leave blank to show the wordmark.
export const BOARD_LOGO = 'assets/logo.webp';

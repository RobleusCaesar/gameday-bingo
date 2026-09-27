// Theme presets + reduced-motion flag, applied to <html>.
import { settings, reducedMotion } from './settings.js';

export const THEMES = [
  { id: 'night', name: 'Mile High Night', colors: ['#0B1B33', '#FB4F14', '#F4EFE6', '#FFC845'] },
  { id: 'day', name: 'Day Game', colors: ['#EFE8DB', '#FB4F14', '#FFFDF8', '#F2B300'] },
  { id: 'neutral', name: 'Neutral', colors: ['#1D2320', '#3FAE72', '#EEF0E9', '#E9C46A'] },
  { id: 'custom', name: 'Custom', colors: null },
];

const META_BG = { night: '#0B1B33', day: '#EFE8DB', neutral: '#1D2320', custom: '#0B1B33' };

/** Pick black or white text for a background color. */
export function onColor(hex) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex || '');
  if (!m) return '#FFFFFF';
  const lin = (v) => {
    const c = parseInt(v, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin(m[1]) + 0.7152 * lin(m[2]) + 0.0722 * lin(m[3]);
  // Contrast vs white = 1.05/(L+.05); vs black = (L+.05)/.05. Prefer white when it clears 3:1 (large bold text).
  return 1.05 / (L + 0.05) >= 3.2 ? '#FFFFFF' : '#111111';
}

export function applyTheme() {
  const s = settings();
  const root = document.documentElement;
  root.dataset.theme = s.theme;
  root.dataset.motion = reducedMotion() ? 'reduced' : 'full';
  for (const prop of ['--primary', '--gold', '--on-primary', '--primary-text']) root.style.removeProperty(prop);
  if (s.theme === 'custom') {
    root.style.setProperty('--primary', s.custom.primary);
    root.style.setProperty('--gold', s.custom.accent);
    root.style.setProperty('--on-primary', onColor(s.custom.primary));
    root.style.setProperty('--primary-text', s.custom.primary);
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = META_BG[s.theme] || META_BG.night;
}

export function watchMotionPreference() {
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', applyTheme);
}

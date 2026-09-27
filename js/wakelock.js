// Keep the screen on during a game (navigator.wakeLock), re-acquired when the tab returns.
let sentinel = null;
let wanted = false;

async function acquire() {
  if (!wanted || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => { sentinel = null; });
  } catch { sentinel = null; }
}

function onVisible() {
  if (document.visibilityState === 'visible' && wanted && !sentinel) acquire();
}

export const wakeLockSupported = 'wakeLock' in navigator;

export function holdScreen(on) {
  wanted = on;
  if (on) {
    document.addEventListener('visibilitychange', onVisible);
    if (!sentinel) acquire();
  } else {
    document.removeEventListener('visibilitychange', onVisible);
    sentinel?.release().catch(() => {});
    sentinel = null;
  }
}

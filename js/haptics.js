// Haptics: navigator.vibrate on Android; on iOS, toggling a native
// <input type="checkbox" switch> from a user gesture produces a tick.
import { settings } from './settings.js';

let iosLabel = null;
const canVibrate = typeof navigator.vibrate === 'function';

function iosTick() {
  if (!iosLabel) {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    input.setAttribute('aria-hidden', 'true');
    iosLabel = document.createElement('label');
    iosLabel.setAttribute('aria-hidden', 'true');
    iosLabel.style.cssText = 'position:fixed;left:-100px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
    iosLabel.append(input);
    document.body.append(iosLabel);
  }
  // Only produces a haptic where the switch attribute is supported (iOS 18+).
  if ('switch' in HTMLInputElement.prototype || /iP(hone|ad|od)/.test(navigator.userAgent)) iosLabel.click();
}

function buzz(pattern, ticks) {
  if (!settings().haptics) return;
  if (canVibrate) {
    try { navigator.vibrate(pattern); } catch { /* ignore */ }
    return;
  }
  ticks.forEach((ms) => (ms ? setTimeout(iosTick, ms) : iosTick()));
}

export const tap = () => buzz(12, [0]);
export const double = () => buzz([14, 70, 14], [0, 90]);
export const long = () => buzz([40, 50, 40, 50, 80, 60, 220], [0, 90, 180, 300]);
export const soft = () => buzz(6, [0]);

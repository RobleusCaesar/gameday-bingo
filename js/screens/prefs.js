import { h, sheet, confirmSheet, say } from '../ui.js';
import { go, pageHead } from '../nav.js';
import { profile, settings, updateSettings, resetSettingsCache } from '../settings.js';
import { THEMES } from '../theme.js';
import { buildProfileForm } from './onboard.js';
import { wakeLockSupported } from '../wakelock.js';
import { closeCurrent } from '../game.js';
import * as store from '../store.js';
import * as sfx from '../audio.js';
import * as haptics from '../haptics.js';

function switchRow(label, sub, checked, onChange) {
  const sw = h('button', {
    type: 'button', class: 'switch', role: 'switch', 'aria-checked': String(checked), 'aria-label': label,
    onclick: () => { checked = !checked; sw.setAttribute('aria-checked', String(checked)); onChange(checked); },
  });
  return h('div', { class: 'set-row' }, h('div', { class: 'l' }, h('b', null, label), sub ? h('small', null, sub) : null), sw);
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function render(app) {
  const me = profile();
  const s = settings();

  const profileRow = h('button', {
    class: 'card row', style: { width: '100%', textAlign: 'left', color: 'var(--text)' },
    onclick: () => sheet((close) => h('div', null, h('h2', null, 'Your profile'),
      buildProfileForm({ submitLabel: 'Save', onDone: () => { close(); go('/settings', { replace: true }); } })), { label: 'Edit profile' }),
  },
  h('span', { style: { fontSize: '40px' }, 'aria-hidden': 'true' }, me.emoji),
  h('span', { class: 'grow' }, h('b', { style: { display: 'block', fontSize: '18px' } }, me.name), h('small', { class: 'hint' }, 'Tap to change name or avatar')),
  h('span', { 'aria-hidden': 'true' }, '✏️'));

  // Sound
  const vol = h('input', {
    type: 'range', min: 0, max: 1, step: 0.05, value: s.volume, 'aria-label': 'Volume', id: 'vol',
    onchange: () => { updateSettings({ volume: Number(vol.value) }); sfx.thwack(); },
  });

  // Motion
  const motionSeg = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Reduced motion' });
  const drawMotion = () => motionSeg.replaceChildren(...[['auto', 'Auto'], ['reduced', 'On'], ['full', 'Off']].map(([k, label]) => h('button', {
    type: 'button', role: 'radio', 'aria-checked': String(settings().motion === k),
    onclick: () => { updateSettings({ motion: k }); drawMotion(); },
  }, label)));
  drawMotion();

  // Themes
  const themeGrid = h('div', { class: 'theme-grid', role: 'radiogroup', 'aria-label': 'Theme' });
  const custom = h('div', { class: 'color-row' });
  const drawThemes = () => {
    const cur = settings();
    themeGrid.replaceChildren(...THEMES.map((t) => h('button', {
      type: 'button', class: 'theme-swatch', role: 'radio', 'aria-checked': String(cur.theme === t.id),
      onclick: () => { updateSettings({ theme: t.id }); drawThemes(); },
    },
    h('span', { class: 'sw', 'aria-hidden': 'true' }, ...(t.colors || [cur.custom.primary, cur.custom.accent, '#0B1B33', '#F4EFE6']).map((c) => h('i', { style: { background: c } }))),
    t.name)));
    custom.hidden = cur.theme !== 'custom';
  };
  const colorInput = (label, key) => {
    const input = h('input', { type: 'color', value: settings().custom[key], 'aria-label': label });
    input.addEventListener('input', () => {
      updateSettings({ custom: { ...settings().custom, [key]: input.value } });
      drawThemes();
    });
    return h('label', null, input, label);
  };
  custom.append(colorInput('Primary', 'primary'), colorInput('Accent', 'accent'));
  drawThemes();

  // Backup
  const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, 'aria-label': 'Backup file' });
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    file.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!(await confirmSheet({ title: 'Import backup?', body: 'Games, packs and settings in the file will replace the ones with the same name on this device.', ok: 'Import' }))) return;
      closeCurrent();
      const n = store.importAll(data);
      resetSettingsCache();
      updateSettings({});
      say(`Imported ${n} items`, '📦');
      go('/', { replace: true });
    } catch (err) {
      say(err.message || 'That file couldn’t be read.', '⚠️');
    }
  });

  app.append(h('main', { class: 'screen screen-enter' },
    pageHead('Settings', '/'),
    profileRow,

    h('h2', { class: 'section-title' }, 'Sound & feel'),
    switchRow('Sound', 'Stamps, horns and crowd noise', s.sound, (v) => { updateSettings({ sound: v }); if (v) sfx.thwack(); }),
    h('div', { class: 'set-row' }, h('label', { class: 'l', for: 'vol', style: { flex: '1' } }, h('b', null, 'Volume'), vol)),
    switchRow('Haptics', 'Buzz on marks and bingos', s.haptics, (v) => { updateSettings({ haptics: v }); if (v) haptics.tap(); }),
    wakeLockSupported ? switchRow('Keep screen awake', 'During a live game', s.wakeLock, (v) => updateSettings({ wakeLock: v })) : null,
    h('div', { class: 'field', style: { marginTop: '14px' } }, h('span', { class: 'label' }, 'Reduced motion'), motionSeg,
      h('p', { class: 'hint' }, 'On swaps shakes, confetti and slams for simple fades. Auto follows your phone’s setting.')),

    h('h2', { class: 'section-title' }, 'Theme'),
    themeGrid,
    custom,

    h('h2', { class: 'section-title' }, 'Your data'),
    h('p', { class: 'hint', style: { marginBottom: '12px' } }, 'Everything lives on this device: no account, no server. Back it up to move phones.'),
    h('div', { class: 'stack' },
      h('button', {
        class: 'btn btn-ghost btn-block',
        onclick: () => {
          download(`gameday-bingo-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(store.exportAll(), null, 1));
          say('Backup saved', '💾');
        },
      }, '💾 Export backup'),
      h('button', { class: 'btn btn-ghost btn-block', onclick: () => file.click() }, '📦 Import backup'),
      file,
      h('button', {
        class: 'btn btn-danger btn-block',
        onclick: async () => {
          if (!(await confirmSheet({ title: 'Clear all data?', body: 'Deletes your games, packs, profile and settings from this device. Export a backup first if you want them.', ok: 'Clear everything', danger: true }))) return;
          closeCurrent();
          store.clearAll();
          resetSettingsCache();
          location.hash = '#/';
          location.reload();
        },
      }, '🧹 Clear data'),
    ),
    h('p', { class: 'hint center', style: { marginTop: '28px' } }, 'Gameday Bingo · no logos, no tracking, just bingo.'),
  ));
}

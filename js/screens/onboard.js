import { h } from '../ui.js';
import { go, takePendingRoute } from '../nav.js';
import { profile, saveProfile, EMOJIS } from '../settings.js';

/** Name + avatar picker. Also reused by Settings via buildProfileForm(). */
export function buildProfileForm({ submitLabel, onDone }) {
  const me = profile();
  let emoji = me.emoji || EMOJIS[Math.floor(Math.random() * 12)];
  const name = h('input', {
    class: 'input', id: 'pf-name', value: me.name || '', maxlength: 18, autocomplete: 'nickname',
    autocapitalize: 'words', enterkeyhint: 'done', placeholder: 'e.g. Rob',
  });
  const grid = h('div', { class: 'emoji-grid', role: 'radiogroup', 'aria-label': 'Avatar' });
  const renderGrid = () => {
    grid.replaceChildren(...EMOJIS.map((e) => h('button', {
      type: 'button', role: 'radio', 'aria-checked': String(e === emoji), 'aria-label': e,
      onclick: () => { emoji = e; renderGrid(); },
    }, e)));
  };
  renderGrid();
  const err = h('p', { class: 'hint', role: 'alert', style: { color: 'var(--danger)', minHeight: '20px' } });
  const form = h('form', {
    onsubmit: (e) => {
      e.preventDefault();
      const n = name.value.trim();
      if (!n) { err.textContent = 'Pick a name so friends know who’s winning.'; name.focus(); return; }
      saveProfile({ name: n, emoji });
      onDone();
    },
  },
  h('div', { class: 'field' }, h('label', { for: 'pf-name' }, 'Your name'), name),
  h('div', { class: 'field' }, h('span', { class: 'label', id: 'pf-av' }, 'Your avatar'), grid),
  err,
  h('button', { type: 'submit', class: 'btn btn-primary btn-lg btn-block' }, submitLabel),
  );
  return form;
}

export function render(app) {
  const form = buildProfileForm({
    submitLabel: 'Let’s play',
    onDone: () => go(takePendingRoute() || '/', { replace: true }),
  });
  app.append(h('main', { class: 'screen screen-enter' },
    h('header', { class: 'home-hero', style: { minHeight: '0', paddingBottom: '12px' } },
      h('p', { class: 'kicker' }, 'Gameday'),
      h('h1', { class: 'wordmark distress', style: { fontSize: 'clamp(60px, 20vw, 96px)' } }, 'BINGO'),
      h('p', { class: 'tagline' }, 'First, who’s playing?'),
    ),
    form,
  ));
}

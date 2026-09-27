// Invite UI: big code, QR code (short link), and Share invite (full link with payload).
import { h, shareOrCopy, say, copyText } from './ui.js';
import { inviteLink, shortLink } from './share.js';
import { loadQRCode } from './libs.js';

export function codeBig(code) {
  return h('div', { class: 'code-big', role: 'img', 'aria-label': 'Game code ' + code.split('').join(' ') },
    ...code.split('').map((c) => h('span', { 'aria-hidden': 'true' }, c)));
}

export function qrBox(code) {
  const box = h('div', { class: 'qr', role: 'img', 'aria-label': 'QR code to join game ' + code },
    h('span', { class: 'hint', style: { color: '#555' } }, 'Loading QR…'));
  loadQRCode()
    .then((QR) => QR.toString(shortLink(code), { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0B1B33', light: '#FFFFFF' } }))
    .then((svg) => { box.innerHTML = svg; box.querySelector('svg')?.setAttribute('aria-hidden', 'true'); })
    .catch(() => { box.replaceChildren(h('span', { class: 'hint', style: { color: '#555', textAlign: 'center' } }, 'QR code needs a connection. Share the link instead.')); });
  return box;
}

export async function shareInvite(session) {
  const cfg = session.shareableConfig();
  const url = await inviteLink(cfg);
  const text = `Join my Gameday Bingo game${cfg.opp ? ` (vs ${cfg.opp})` : ''}! Code: ${cfg.code}`;
  const res = await shareOrCopy({ title: 'Gameday Bingo', text, url });
  if (res === 'copied') say('Invite link copied', '🔗');
  else if (res === 'failed') say('Couldn’t share. Tell them the code: ' + cfg.code, '⚠️');
}

export function invitePanel(session, { compact = false } = {}) {
  return h('div', { class: 'center' },
    h('p', { class: 'label' }, 'Game code'),
    codeBig(session.code),
    h('p', { class: 'hint' }, 'Friends tap “Join with Code”, or scan:'),
    qrBox(session.code),
    h('div', { class: 'stack' },
      h('button', { class: 'btn btn-primary btn-block' + (compact ? '' : ' btn-lg'), onclick: () => shareInvite(session) }, '📤 Share invite'),
      h('button', {
        class: 'btn btn-ghost btn-block',
        onclick: async () => {
          const url = await inviteLink(session.shareableConfig());
          if (await copyText(url)) say('Invite link copied', '🔗');
        },
      }, '🔗 Copy link'),
    ),
  );
}

// Built-in square packs. Every square is editable in the app (Square Packs).
// {OPP} = opponent, {TEAM} = your team. Rarity: C common, U uncommon, R rare.
//
// Rarity guide: C = happens in most NFL games, U = maybe half, R = rare.
// Optional tags narrow when a square can be drawn:
//   opponents: ['49ers']        only when the game's opponent matches (aliases in js/tags.js)
//   broadcasts: ['snf']         only for that broadcast (see BROADCASTS in js/tags.js)
//
// Content rule: no player injuries. "Injury timeout" is the only injury square,
// and tests/board.test.mjs fails if one slips back in.

/** Bump when the default squares change; unedited copies on phones update automatically. */
export const DEFAULT_PACKS_VERSION = 2;

/** Fingerprints of earlier default packs, so we can tell if a user's copy is still unedited. */
export const PAST_FINGERPRINTS = {
  broncos: { 1: '5wrjdc' },
  any: { 1: '1g2rkxa' },
};

const snf = (t) => ({ t, broadcasts: ['snf'] });
const afternoon = (t) => ({ t, broadcasts: ['afternoon'] });
const vs49 = (t) => ({ t, opponents: ['49ers'] });

// Calls that show up in most games (Common in both packs).
const LIKELY_CALLS = [
  'Holding flag', 'False start', 'Pass interference', 'Defensive pass interference',
  'Offensive pass interference', 'Intentional grounding', 'Offside', 'Neutral zone infraction',
  'Encroachment', 'Illegal formation', 'Illegal contact', 'Unnecessary roughness', 'Facemask',
  'Illegal block in the back', 'Personal foul', 'Illegal motion/shift', 'Delay of game',
  'First down by penalty', 'Measurement / chains brought out', 'Flag picked up / no-call',
];

const AFTERNOON = {
  C: [
    afternoon('Out-of-town score ticker shows a blowout'),
    afternoon('Announcer mentions fantasy football'),
    afternoon('Network promo for the late game'),
  ],
  U: [afternoon('Cut to another game’s highlight')],
};

const broncos = {
  Classic: {
    C: [
      snf('IN… COME… PLETE!'), snf('“Here’s a guy”'), 'SACK', '30+ yard pass', 'Payton shown chewing gum',
      'DraftKings commercial', 'Dancing Broncos fans', '“Altitude” mentioned', 'Field goal', 'Kalshi ad',
      'Touchdown', 'Sad {OPP} fan shown', 'INT', 'Fumble',
    ],
    U: [
      'Riley Moss flagged', 'Camera shaking', snf('Collinsworth mentions Mahomes'),
      '2024 QB class stats graphic', 'New “Thunder” mentioned', 'Deep pass to Waddle',
    ],
    R: ['Nix rushing TD', 'Pick six'],
  },
  Plays: {
    C: [
      ...LIKELY_CALLS, 'Touchback', 'Rushing TD', 'QB kneel', 'Replay shown from 3+ angles', '3-and-out',
      '4th-down conversion', 'Tipped pass', 'Nix scramble for a 1st down', 'TD celebration dance',
      'Injury timeout', 'Punt', 'Timeout called',
    ],
    U: [
      'Missed FG', '50+ yard FG', 'Two-point attempt', 'Coach’s challenge', 'Call overturned on review',
      'Roughing the passer', 'Turnover on downs', 'Punt downed inside the 5', 'Return past the 40',
      'Player loses helmet', 'Surtain pass breakup', '60+ yard play', 'Offsetting penalties',
    ],
    R: [
      'Safety', 'Blocked kick', 'Onside kick', 'Hail Mary attempt', 'Kick-return TD',
      'Defensive TD (non-pick-six)', 'Successful fake punt/FG',
    ],
  },
  Broadcast: {
    C: [
      'Aerial shot of the Denver skyline', 'Mountains shown', 'Sideline reporter segment', '“Mile High” said',
      'Stat graphic starting “since 19__”', 'Promo for another network show',
      'Payton covering mouth with play sheet', 'Coach yelling at a ref', 'Peyton Manning mentioned',
      'Analyst draws on the telestrator', ...AFTERNOON.C,
    ],
    U: [
      'Elway shown in the suite', 'Celebrity in the stands', '“Rookie” mistake called out',
      'Weather/sunset graphic', 'Broadcast cuts back late from a commercial', ...AFTERNOON.U,
    ],
    R: [
      'Announcer mispronounces a name, then corrects it', 'Mic’d-up player audio aired',
      'Streaker / field invader mentioned',
    ],
  },
  Crowd: {
    C: ['Fan with painted face', 'Orange Crush throwback jersey', 'Kid on the big screen'],
    U: ['{OPP} fan booed on the big screen', 'Fan catches a ball in the stands', 'Proposal or sign asking for one'],
    R: ['Wave goes all the way around', 'Fan spills beer on camera'],
  },
  Ads: {
    C: ['State Farm ad', 'Pickup truck ad', 'Beer ad', 'Fast-food ad', 'Sports-betting ad (not DraftKings/Kalshi)'],
    U: ['Same ad twice in one break', 'Ad with an NFL player in it', 'Movie trailer'],
  },
  Opponent: {
    C: [
      vs49('Mike Shanahan mentioned'), vs49('Kyle Shanahan shown looking stressed'),
      vs49('Montana or Jerry Rice mentioned'), vs49('Niners screen pass goes 15+ yards'),
    ],
    U: [
      vs49('Payton and Shanahan split-screen'), vs49('Shanahan coaching tree graphic'),
      vs49('Fan in a Montana/Rice throwback jersey'), vs49('Super Bowl XXIV brought up'),
      vs49('“Mr. Irrelevant” mentioned'), vs49('Kittle shown yelling'), vs49('Golden Gate Bridge shot'),
    ],
    R: [
      vs49('Announcer makes a Gold Rush / “panning for gold” joke'), vs49('Silicon Valley tech-money joke'),
      vs49('Fan wearing a house-divided Broncos/49ers jersey'),
    ],
  },
};

const anyGame = {
  Plays: {
    C: [
      ...LIKELY_CALLS, 'Touchdown', 'Field goal', 'SACK', '30+ yard pass', 'Touchback', 'Rushing TD',
      'QB kneel', 'Replay shown from 3+ angles', '3-and-out', snf('IN… COME… PLETE!'), 'Timeout called', 'Punt',
      'Incomplete pass on 3rd down', 'INT', 'Fumble', '4th-down conversion', 'Tipped pass',
      'QB scramble for a 1st down', 'TD celebration dance', 'Sack on 3rd down', 'Injury timeout',
    ],
    U: [
      'Missed FG', '50+ yard FG', 'Two-point attempt', 'Coach’s challenge', 'Call overturned on review',
      'Roughing the passer', 'Turnover on downs', 'Punt downed inside the 5', 'Return past the 40',
      'Player loses helmet', '60+ yard play', 'Offsetting penalties',
    ],
    R: [
      'Safety', 'Blocked kick', 'Onside kick', 'Hail Mary attempt', 'Kick-return TD', 'Defensive TD',
      'Pick six', 'Successful fake punt/FG', 'Game goes to overtime', 'QB catches a pass',
    ],
  },
  Broadcast: {
    C: [
      'Aerial shot of the stadium', 'Sideline reporter segment', 'Stat graphic starting “since 19__”',
      'Promo for another network show', 'Coach covering mouth with play sheet', 'Coach yelling at a ref',
      snf('“Here’s a guy”'), 'Fantasy stat mentioned', 'Analyst draws on the telestrator',
      ...AFTERNOON.C.filter((s) => !/fantasy/i.test(s.t)),
    ],
    U: [
      '{TEAM} legend shown in a suite', 'Celebrity in the stands', '“Rookie” mistake called out',
      'Weather graphic', 'Broadcast cuts back late from a commercial', 'Camera shaking',
      'Talk of a QB who isn’t playing', 'Ref’s mic cuts out', ...AFTERNOON.U,
    ],
    R: [
      'Announcer flubs a name, then corrects it', 'Mic’d-up player audio aired',
      'Streaker / field invader mentioned', 'Wrong graphic on screen',
    ],
  },
  Crowd: {
    C: ['Fan with painted face', 'Throwback jersey in the stands', 'Kid on the big screen', 'Dancing {TEAM} fans', 'Sad {OPP} fan shown'],
    U: ['{OPP} fan booed on the big screen', 'Fan catches a ball in the stands', 'Proposal or sign asking for one', 'Fan asleep in the stands'],
    R: ['Wave goes all the way around', 'Fan spills beer on camera'],
  },
  Ads: {
    C: ['Insurance ad', 'Pickup truck ad', 'Beer ad', 'Fast-food ad', 'Sports-betting ad', 'Pizza ad'],
    U: ['Same ad twice in one break', 'Ad with an NFL player in it', 'Movie trailer', 'Ad with a talking animal'],
  },
  Opponent: {
    C: [
      vs49('Mike Shanahan mentioned'), vs49('Kyle Shanahan shown looking stressed'),
      vs49('Montana or Jerry Rice mentioned'), vs49('Niners screen pass goes 15+ yards'),
    ],
    U: [
      vs49('Kyle Shanahan split-screen with the other coach'), vs49('Shanahan coaching tree graphic'),
      vs49('Fan in a Montana/Rice throwback jersey'), vs49('Super Bowl XXIV brought up'),
      vs49('“Mr. Irrelevant” mentioned'), vs49('Kittle shown yelling'), vs49('Golden Gate Bridge shot'),
    ],
    R: [
      vs49('Announcer makes a Gold Rush / “panning for gold” joke'), vs49('Silicon Valley tech-money joke'),
      vs49('Fan wearing a house-divided {TEAM}/49ers jersey'),
    ],
  },
};

function flatten(groups) {
  const out = [];
  for (const [cat, tiers] of Object.entries(groups)) {
    for (const [r, list] of Object.entries(tiers)) {
      for (const item of list) {
        const sq = typeof item === 'string' ? { t: item } : { ...item };
        out.push({ ...sq, r, c: cat });
      }
    }
  }
  return out;
}

export const BUILTIN_PACKS = [
  { builtin: 'broncos', name: 'Broncos Game Night', squares: flatten(broncos) },
  { builtin: 'any', name: 'Any Game', squares: flatten(anyGame) },
];

export const DEFAULT_CATEGORIES = ['Classic', 'Plays', 'Broadcast', 'Crowd', 'Ads'];

/**
 * Content rule: squares must not be about someone getting hurt. The only allowed
 * injury square is the generic "Injury timeout".
 */
export const INJURY_WORDS = /\b(injur\w*|hurt|carted|cart|concussion|ankle|knee|hamstring|acl|limp\w*|stretcher|trainer)\b/i;
export function isInjurySquare(text) {
  const t = String(text || '').trim();
  return INJURY_WORDS.test(t) && !/^injury timeout$/i.test(t);
}

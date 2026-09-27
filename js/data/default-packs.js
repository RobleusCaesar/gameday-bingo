// Built-in square packs. Every square is editable in the app (Square Packs).
// {OPP} = opponent, {TEAM} = your team. Rarity: C common, U uncommon, R rare.

const broncos = {
  Classic: {
    C: [
      'IN… COME… PLETE!', '“Here’s a guy”', 'SACK', '30+ yard pass', 'Payton shown chewing gum',
      'DraftKings commercial', 'Dancing Broncos fans', '“Altitude” mentioned', 'Field goal', 'Kalshi ad',
      'Touchdown', 'Sad {OPP} fan shown',
    ],
    U: [
      'Riley Moss flagged', 'Bo Nix ankle injury mentioned', 'Camera shaking', 'Collinsworth mentions Mahomes',
      'INT', '2024 QB class stats graphic', 'Fumble', 'New “Thunder” mentioned', 'Deep pass to Waddle',
    ],
    R: ['Nix rushing TD', 'Pick six', 'Dobbins injured'],
  },
  Plays: {
    C: [
      'Holding flag', 'False start', 'Pass interference', 'Touchback', 'Rushing TD', 'QB kneel',
      'Replay shown from 3+ angles', '3-and-out',
    ],
    U: [
      'Missed FG', '50+ yard FG', 'Two-point attempt', 'Coach’s challenge', 'Call overturned on review',
      'Delay of game', 'Roughing the passer', '4th-down conversion', 'Turnover on downs',
      'Punt downed inside the 5', 'Return past the 40', 'Tipped pass', 'Player loses helmet',
      'Nix scramble for a 1st down', 'Surtain pass breakup', 'TD celebration dance',
    ],
    R: [
      'Safety', 'Blocked kick', 'Onside kick', '60+ yard play', 'Hail Mary attempt', 'Offsetting penalties',
      'Kick-return TD', 'Defensive TD (non-pick-six)', 'Successful fake punt/FG',
    ],
  },
  Broadcast: {
    C: [
      'Aerial shot of the Denver skyline', 'Mountains shown', 'Sideline reporter segment', '“Mile High” said',
      'Stat graphic starting “since 19__”', 'Promo for another network show',
      'Payton covering mouth with play sheet', 'Coach yelling at a ref',
    ],
    U: [
      'Elway shown in the suite', 'Peyton Manning mentioned', 'Celebrity in the stands',
      '“Rookie” mistake called out', 'Weather/sunset graphic', 'Analyst draws on the telestrator',
      'Broadcast cuts back late from a commercial',
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
};

const anyGame = {
  Plays: {
    C: [
      'Touchdown', 'Field goal', 'SACK', '30+ yard pass', 'Holding flag', 'False start', 'Pass interference',
      'Touchback', 'Rushing TD', 'QB kneel', 'Replay shown from 3+ angles', '3-and-out', 'IN… COME… PLETE!',
      'Timeout called', 'Punt', 'Incomplete pass on 3rd down',
    ],
    U: [
      'INT', 'Fumble', 'Missed FG', '50+ yard FG', 'Two-point attempt', 'Coach’s challenge',
      'Call overturned on review', 'Delay of game', 'Roughing the passer', '4th-down conversion',
      'Turnover on downs', 'Punt downed inside the 5', 'Return past the 40', 'Tipped pass',
      'Player loses helmet', 'QB scramble for a 1st down', 'TD celebration dance', 'Injury cart comes out',
      'Sack on 3rd down',
    ],
    R: [
      'Safety', 'Blocked kick', 'Onside kick', '60+ yard play', 'Hail Mary attempt', 'Offsetting penalties',
      'Kick-return TD', 'Defensive TD', 'Pick six', 'Successful fake punt/FG', 'Game goes to overtime',
      'QB catches a pass',
    ],
  },
  Broadcast: {
    C: [
      'Aerial shot of the stadium', 'Sideline reporter segment', 'Stat graphic starting “since 19__”',
      'Promo for another network show', 'Coach covering mouth with play sheet', 'Coach yelling at a ref',
      '“Here’s a guy”', 'Fantasy stat mentioned',
    ],
    U: [
      '{TEAM} legend shown in a suite', 'Celebrity in the stands', '“Rookie” mistake called out',
      'Weather graphic', 'Analyst draws on the telestrator', 'Broadcast cuts back late from a commercial',
      'Camera shaking', 'Talk of a QB who isn’t playing', 'Ref’s mic cuts out',
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
};

function flatten(groups) {
  const out = [];
  for (const [cat, tiers] of Object.entries(groups)) {
    for (const [r, list] of Object.entries(tiers)) {
      for (const t of list) out.push({ t, r, c: cat });
    }
  }
  return out;
}

export const BUILTIN_PACKS = [
  { builtin: 'broncos', name: 'Broncos Game Night', squares: flatten(broncos) },
  { builtin: 'any', name: 'Any Game', squares: flatten(anyGame) },
];

export const DEFAULT_CATEGORIES = ['Classic', 'Plays', 'Broadcast', 'Crowd', 'Ads'];

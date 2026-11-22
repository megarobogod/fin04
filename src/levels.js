// levels.js - the maps.
// Each level is a grid of characters. One character = one square of the map
// (think of it as about 2.5 m across). Short rows are padded with brick.
//
// WALLS (solid):
//   #  brick              %  dark brick        w  brick with a lit window
//   v  dark window        G  "VIPERS" graffiti X  wanted posters
//   D  door (just a picture, you can't open it) S  bar sign (glows)
//   W  wooden wall        C  concrete          M  corrugated metal
//   F  wooden fence
// FLOORS:
//   .  the level's main floor     ,  the level's second floor
// THINGS (they stand on the floor):
//   P  you (the player)   t  thug    h  heavy with a tommy gun    K  the boss
//   a  ammo box           +  first-aid tin
//   L  street lamp (gives light)  o  hanging bulb (gives light)
//   b  barrel   c  crate   T  trash can

export const WALLS = {
  '#': 'brick', '%': 'darkbrick', w: 'window', v: 'darkwindow', G: 'graffiti', X: 'poster',
  D: 'door', S: 'bar', W: 'wood', C: 'concrete', M: 'metal', F: 'fence',
};

export const THINGS = {
  P: 'player', t: 'thug', h: 'heavy', K: 'boss', a: 'ammo', '+': 'health',
  L: 'lamp', o: 'bulb', b: 'barrel', c: 'crate', T: 'trash',
};

export const ENEMY_KINDS = ['thug', 'heavy', 'boss'];

export const LEVELS = [
  {
    name: 'MAIN STREET',
    intro: "The Vipers own this street. Somebody out here knows where they're keeping your wife.",
    outdoor: true, rain: true, lightning: true,
    ambient: 0.30, fog: 17,
    floors: { '.': 'asphalt', ',': 'sidewalk' },
    angle: 0,                               // which way you face at the start (0 = east)
    map: [
      '############################################',
      '#%%%%%%%%%%%%,,c,%%%%%%%%%%%%%%%%,,,t,%%%%%#',
      '#%%%%%%%%%%%%,t,,%%%%%%%%%%%%%%%%,b,,,%%%%%#',
      '#w#v#Dw#S#v#w,,,,w#X#Gw#v#D#w#v#w,,,,,w#S#w#',
      '#,,,L,,,,,,,,,,,,,,,,,,L,,,,,,,,,,,,,,,,L,a#',
      '#P.........................................#',
      '#.....t.............b..........h...........#',
      '#..........................................#',
      '#,+,,,,,,L,,,,,,,,,,,,,,,,L,,,,,,,,,,T,,,,,#',
      '#w#D#v#w#S,,,,#w#G#v#X#D#w#,,,,v#w#D#w#v#w##',
      '#%%%%%%%%%,,t,%%%%%%%%%%%%%,c,,%%%%%%%%%%%%#',
      '#%%%%%%%%%,,,T%%%%%%%%%%%%%,,t,%%%%%%%%%%%%#',
      '############################################',
    ],
  },
  {
    name: 'THE BACK ALLEYS',
    intro: 'The ones who got away ran for the alleys. Dark corners, wet bricks, nowhere to hide. For them.',
    outdoor: true, rain: true, lightning: true,
    ambient: 0.26, fog: 14,
    floors: { '.': 'cobble', ',': 'cobble' },
    angle: Math.PI / 2,                     // facing south
    map: [
      '%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%',
      '%P,,,#,,,,,,,,,,F,,,,,,,,,,,,%',
      '%,,,,#,,b,,,,t,,F,,c,,,,,,t,,%',
      '%,,,,D,,,,,#XG#WF,,,,,,WWWW,,%',
      '%,,,,,,,,,,#,,,,,,,,,,,%,,,,,%',
      '%#D,##v#,,,#,,t,,,##,,,%,,o,,%',
      '%,,,,,,#,,,#,,,,,,##,,,M,,,,,%',
      '%,,o,,,M,,,,,,c,,,,,,,,,,,,,,%',
      '%,,,,,,#v#G#,,,,#X#,,h,,#D#w#%',
      '%,t,,,,,,,,#,,L,,,,,,,,,,,,,,%',
      '%,,,,,,,,,,C,,,,b,CCCCCC,,,,,%',
      '%%G%%,,,,,,C,,,,,,C,,,,C,,t,,%',
      '%,,,,,,,,,,,,,,,,,,,t,,G,,,,,%',
      '%,+,,c,,,,,C,,,t,,C,,,,,,,a,,%',
      '%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%',
    ],
  },
  {
    name: 'THE HIDEOUT',
    intro: 'Their warehouse down by the docks. The boss is in the back room, and so is she. End it.',
    outdoor: false, rain: false, lightning: false,
    ambient: 0.27, fog: 15,
    floors: { '.': 'woodfloor', ',': 'concretefloor' },
    ceiling: 'beams',
    angle: Math.PI / 2,
    map: [
      'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
      'CP..W.........WMMMMMMMMMMMMMMC',
      'C...W..c..t...M,,,,,,,,,,,,,,C',
      'C...W....o....M,,c,,,,,,,,b,,C',
      'C...WWWW.WWWWWM,,,,,,h,,,,,,,C',
      'C....o.........,,o,,,,,,o,,,,C',
      'C...W.........M,,,,,,,,,,,,,,C',
      'C...W..t......M,,b,,,,,,,,c,,C',
      'CC.WWWWWWWWWWWM,,,,,,t,,,,,,,C',
      'C....W.......MMMMM,,,,MMMMMMMC',
      'C.t..W...o...W...........o...C',
      'C............W...............C',
      'C.+..W.......W..o.....h......C',
      'C....W...h...................C',
      'C.a..W.......W.......t.....K.C',
      'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
    ],
  },
];

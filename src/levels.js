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
//   inside the Dellwood apartments:
//   y  wallpaper          Y  dark wallpaper    q  plaster
//   n  apartment door (a picture)   m  mailboxes   l  the broken lift
// DOORS that slide open when someone comes near:
//   |  a door you walk through going east-west    -  going north-south
// FLOORS: each level says which floor texture each of these means:
//   .  ,  :  ;      and  ^  stairs up to the next floor (walk onto them)
// THINGS (they stand on the floor):
//   P  you (the player)   t  thug    h  heavy with a tommy gun    K  the boss
//   Z  the Vipers lieutenant (top of the Dellwood)
//   a  ammo box           +  first-aid tin       s  box of shotgun shells
//   L  street lamp (gives light)  o  hanging bulb (gives light)
//   b  barrel   c  crate   T  trash can

export const WALLS = {
  '#': 'brick', '%': 'darkbrick', w: 'window', v: 'darkwindow', G: 'graffiti', X: 'poster',
  D: 'door', S: 'bar', W: 'wood', C: 'concrete', M: 'metal', F: 'fence',
  y: 'wallpaper', Y: 'wallpaper2', q: 'plaster', n: 'aptdoor', m: 'mailboxes', l: 'elevator',
};

export const THINGS = {
  P: 'player', t: 'thug', h: 'heavy', K: 'boss', Z: 'lieutenant', a: 'ammo', '+': 'health', s: 'shells',
  L: 'lamp', o: 'bulb', b: 'barrel', c: 'crate', T: 'trash',
};

export const ENEMY_KINDS = ['thug', 'heavy', 'boss', 'lieutenant'];

// A level can have several floors ("stages"). Walk onto ^ to climb to the next.
// Anything a stage sets (outdoor, rain, light...) overrides the level's own.
export const LEVELS = [
  {
    name: 'THE DELLWOOD',
    intro: "The Vipers run the block from the Dellwood Apartments. Their lieutenant keeps the top floor. He'll know where she is.",
    floors: { ',': 'sidewalk', '.': 'carpet', ':': 'lino', ';': 'woodfloor', '^': 'stairs' },
    ceilings: { '.': 'plaster', ':': 'plaster', ';': 'plaster', '^': 'plaster' },   // the street (,) has no roof
    fog: 15,
    lieutenant: true,         // the level ends when you put the lieutenant down
    stages: [
      {
        name: 'GROUND FLOOR', outdoor: true, rain: true, lightning: true, ambient: 0.24, angle: 0,
        map: [
      '#################################',
      '#,,,,w;+;;;;;;;;y;;;;;Y:::::Y;;;#',
      '#,,,,#;;;;;;t;;;y;;;;;Y::a::Y;;;#',
      '#,L,,w;;;;o;;;;;y;;;;;Y:::::Y;t;#',
      '#,,,,#;;;;;;;;;;y;;t;;Y::o::Y;;;#',
      '#,,,,wqqqq-qqqqqy;;;;;Y:::::Y;;;#',
      '#,,,,#..........y;;o;;Y:c:::Y;o;#',
      '#b,,,w......cc..m;;;;;Y:::::Y;;;#',
      '#,,,,#...t......l;;;;;Y:::::Y;;;#',
      '#,,,,w..o.......yyn-yyyyn-yyyy-y#',
      '#,P,,|..............o..........^#',
      '#,,,,w..................h..o...^#',
      '#,,,,#.......o..yyn-yyyyn-yyyy-y#',
      '#,,,,w..........y;;;;;Y:::::Y;;;#',
      '#,,T,#.......t..m;;;;;Y:::::Y;;;#',
      '#,,,,w..........y;;o;;Y::o::Y;;;#',
      '#,,,,#..........y;;;;;Y:::::Y;o;#',
      '#,L,,wqqqq-qqqqqy;t;;;Y:::::Y;;;#',
      '#,,,,#::::::::::y;;;;;Y::t::Y;;;#',
      '#,,,,w::::o::t::y;;;;;Y:::::Y;;;#',
      '#,,,,#:a::::::::y;;;+;Y:::::Y;a;#',
      '#,,,,w::::::::::y;;;;;Y:::::Y;;;#',
      '#################################',
        ],
      },
      {
        name: 'SECOND FLOOR', outdoor: false, rain: false, lightning: false, ambient: 0.2, angle: 0,
        map: [
      '#################################',
      '#qqq;;;;;;Y::::::Y;;;;;;Y;;;;q.^#',
      '#qqq;;;;;;Y::::::Y;;;;;;Y;;;;q..#',
      '#qqq;;;;;;Y:::t::Y;;o;;;Y;;t;q.o#',
      '#qqq;;t;;;Y::::::Y;;;;;;Y;;;;q..#',
      '#qqq;;;;;;Y::::::Y;;;;;;Y;;;;q.t#',
      '#qqq;;o;;;Y::::::Y;;t;;;Y;;;;q..#',
      '#qqq;;;;;;Y:c::::Y;;;;;;Y;+;;q..#',
      '#qqq;;;;;;Y::::::Y;;;;;;Y;;;;qo.#',
      '#yqyyn-yyyyyyn-yyyyy-nyyyy-yyq..#',
      '#P::....o.............h.o.......#',
      '#:a:........t...o...............#',
      '#yyyyn-yyyyyyn-yyyyy-nyyyy-yyqqq#',
      '#qqq::::::Y;;;;;;Y::::::Y;;;;qqq#',
      '#qqq::::::Y;;;;;;Y::::::Y;;;;qqq#',
      '#qqq:::o::Y;;;o;;Y::o:::Y;;;;qqq#',
      '#qqq::::::Y;;;;;;Y::::::Y;;;;qqq#',
      '#qqq:::t::Y;;;;;;Y::::::Y;;;;qqq#',
      '#qqq::::::Y;;;;;;Y::t:::Y;;c;qqq#',
      '#qqq::::::Y;;;+;;Y::::::Y;;;;qqq#',
      '#qqq::::::Y;;;;;;Y::::::Y;a;;qqq#',
      '#qqq::::::Y;;;;;;Y::::::Y;;;;qqq#',
      '#################################',
        ],
      },
      {
        name: 'TOP FLOOR', outdoor: false, rain: false, lightning: false, ambient: 0.2, angle: -Math.PI / 2,
        map: [
      '#################################',
      '#::::::::::::Y;;;;;;;;;;;;;;;;;;#',
      '#:a:::::::+::Y;;;;;;;;;;;;cc;;;;#',
      '#::::::::::::Y;;;;;h;;;;;;;;;;;;#',
      '#::::to::::::Y;;;;;;;;o;;;;Z;;;;#',
      '#::::::::::::Y;;;;;;;;;;;;;;o;;;#',
      '#::::::::::::Y;;;;;;;;;;;;;;;;t;#',
      '#::::::::::::Y;;;;;;;;;;;;;;;;;;#',
      '#qqqqq-qqqqqqqYYYYYYYY--YYYYYYYY#',
      '#.............o.................#',
      '#.....o.........t..........t.o..#',
      '#.....................o.........#',
      '#q-qqqqqq-qqqqqqq-qqqqqqqq-qqqqq#',
      '#::::q;;;;;;;;Y::::::Y..........#',
      '#::::q;;;;;c;;Y::::::Y........a.#',
      '#::::q;;t;;;;;Y::o:::Y..........#',
      '#::::q;;;;;;;;Y::::::Y...t......#',
      '#::::q;;;;o;;;Y::h:::Y....o.....#',
      '#::::q;;;;;;;;Y::::::Y..........#',
      '#:P::q;;;;;;t;Y::::::Y.......t..#',
      '#::::q;c;;;;;;Y::::+:Y.b........#',
      '#::::q;;;;;;;;Y::::::Y......c...#',
      '#################################',
        ],
      },
    ],
  },
  {
    name: 'THE BACK ALLEYS',
    intro: 'Pier Nine is on the far side of the back alleys. The Vipers know you are coming.',
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
      '%,,o,,,M,,,,,,c,,,,,,s,,,,,,,%',
      '%,,,,,,#v#G#,,,,#X#,,h,,#D#w#%',
      '%,t,,,,,,,,#,,L,,,,,,,,,,,s,,%',
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
      'C............W......s........C',
      'C.+..W.......W..o.....h......C',
      'C....W...h...................C',
      'C.a..W.......W.......t.....K.C',
      'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
    ],
  },
];

/* The wire between the two sides of a game, and the one place that says what a
   message is called and what counts as a legal setting. Loaded by the server
   under node and by the browser beside the rest of the game, so neither side
   can drift from the other.

   Every message is JSON with a `t` (type). Anything the server sends about a
   room is the whole room again rather than a patch: rooms are small, and a
   client that has just reconnected then needs no catching up.

   ---- client to server ----
   hello        { name, playerId }              introduce (or re-introduce) yourself
   lobby.chat   { text }
   game.create  { name, settings }              and you become its host, in seat A
   game.join    { id }                          take the free seat, or watch
   game.leave   { }
   game.kick    { playerId }                    host only
   game.settings{ patch }                       host only: tier, pl, planet, scenario, campaign
   game.seat    { seat }                        take A, B or 'watch'
   game.force   { force }                       your own faction, tactic, list, colour, name
   game.ready   { ready }
   game.start   { }                             host only, once both seats are ready
   game.chat    { text }
   intent       { intent }                      a thing you are trying to do on the table
   resync       { }                             send me the table again, in full

   ---- server to client ----
   welcome      { you, games, chat }
   error        { text, fatal }
   lobby        { games }                       the open games, whenever they change
   lobby.chat   { from, text, at }
   game         { room }                        the room you are in, whole
   game.chat    { from, text, at }
   started      { seat, cfg }                   the battle has begun; the table follows
   snapshot     { state, seq }                  the whole table as the server sees it
   events       { events, seq }                 what just happened, in order
   over         { report }
*/
(function (root) {
  'use strict';

  var TIERS = [1, 2, 3, 4, 5];
  var PLS = [1, 2];
  /* The worlds on offer. Desert and arctic are the book's one barren table in
     two looks; 'barren' is still accepted, from an older client or an old
     campaign, and is settled into one of the two when the battle is set up. */
  var PLANETS = ['random', 'desert', 'arctic', 'sparse', 'dense', 'industrial', 'jungle', 'mountain', 'unstable', 'barren'];
  // what a player is shown to choose from: everything but the old name
  var PLANET_CHOICES = PLANETS.filter(function (p) { return p !== 'barren'; });
  var SCENARIOS = ['roll', 'rolld3', 'meeting', 'secure', 'find', 'invasion', 'demolish', 'takeover'];
  var FACTIONS = ['pmc', 'rebel', 'bugs', 'xeno'];
  var TACTICS = ['', 'laststand', 'wave', 'guerillas'];
  var COLOURS = ['ochre', 'steel', 'olive', 'crimson', 'slate', 'plum', 'sand', 'rust', 'jade', 'midnight'];
  var SEATS = ['A', 'B'];

  var LIMITS = {
    name: 24,            // a player's name, and a room's
    force: 40,
    chat: 400,
    chatLog: 120,        // how much backlog a room or the lobby keeps
    rooms: 64,
    units: 40            // the longest a force list may be before it is nonsense
  };

  /* Room life: setup -> battle -> over. A room in `battle` is closed to joiners
     taking a seat, but not to watchers. */
  var PHASE = { SETUP: 'setup', BATTLE: 'battle', OVER: 'over' };

  function clampText(s, max) {
    if (typeof s !== 'string') return '';
    // control characters have no business in a chat line or a force name
    return s.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
  }

  function oneOf(v, list, fallback) {
    return list.indexOf(v) >= 0 ? v : fallback;
  }

  function defaultSettings() {
    return {
      tier: 3, pl: 1,
      planet: 'random',
      scenario: 'roll',
      campaign: null,        // a campaign id on the server, or null for a one-off
      contract: null         // when a campaign is attached: which job is being fought
    };
  }

  /* Only the fields a host is allowed to set, each forced back into range. An
     unknown key is dropped rather than refused: an older client should still be
     able to change the tier. */
  function cleanSettings(patch, onto) {
    var s = onto || defaultSettings();
    if (!patch || typeof patch !== 'object') return s;
    if ('tier' in patch) s.tier = oneOf(+patch.tier, TIERS, s.tier);
    if ('pl' in patch) s.pl = oneOf(+patch.pl, PLS, s.pl);
    if ('planet' in patch) s.planet = oneOf(patch.planet, PLANETS, s.planet);
    if ('scenario' in patch) s.scenario = oneOf(patch.scenario, SCENARIOS, s.scenario);
    if ('campaign' in patch) s.campaign = patch.campaign ? clampText(patch.campaign, LIMITS.name) : null;
    if ('contract' in patch) s.contract = patch.contract == null ? null : clampText(String(patch.contract), 64);
    return s;
  }

  function defaultForce(seat) {
    return {
      faction: 'pmc',
      tactic: '',
      keys: [],
      name: '',
      colour: seat === 'B' ? 'steel' : 'ochre',
      /* A campaign force is a list of roster ids out of the shared campaign
         rather than freshly bought units. */
      roster: null
    };
  }

  function cleanForce(force, seat) {
    var f = defaultForce(seat);
    if (!force || typeof force !== 'object') return f;
    f.faction = oneOf(force.faction, FACTIONS, f.faction);
    f.tactic = f.faction === 'rebel' ? oneOf(force.tactic || '', TACTICS, '') : '';
    f.colour = oneOf(force.colour, COLOURS, f.colour);
    f.name = clampText(force.name, LIMITS.force);
    if (Array.isArray(force.keys)) {
      f.keys = force.keys.slice(0, LIMITS.units)
        .filter(function (k) { return typeof k === 'string'; })
        .map(function (k) { return clampText(k, 64); });
    }
    if (Array.isArray(force.roster)) {
      f.roster = force.roster.slice(0, LIMITS.units)
        .filter(function (k) { return typeof k === 'string' || typeof k === 'number'; })
        .map(String);
    }
    return f;
  }

  /* What the lobby list shows about a room — never its forces, which are the
     players' own business until the battle starts. */
  function summarise(room) {
    return {
      id: room.id,
      name: room.name,
      phase: room.phase,
      host: room.host,
      players: SEATS.map(function (s) {
        var p = room.seats[s];
        return p ? { seat: s, name: p.name, ready: !!p.ready } : { seat: s, name: null, ready: false };
      }),
      watchers: room.watchers.length,
      settings: { tier: room.settings.tier, pl: room.settings.pl, scenario: room.settings.scenario, planet: room.settings.planet },
      campaign: room.settings.campaign || null,
      at: room.at
    };
  }

  root.PMCProto = {
    TIERS: TIERS, PLS: PLS, PLANETS: PLANETS, PLANET_CHOICES: PLANET_CHOICES, SCENARIOS: SCENARIOS,
    FACTIONS: FACTIONS, TACTICS: TACTICS, COLOURS: COLOURS, SEATS: SEATS,
    LIMITS: LIMITS, PHASE: PHASE,
    clampText: clampText, oneOf: oneOf,
    defaultSettings: defaultSettings, cleanSettings: cleanSettings,
    defaultForce: defaultForce, cleanForce: cleanForce,
    summarise: summarise
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCProto;
})(typeof window !== 'undefined' ? window : global);

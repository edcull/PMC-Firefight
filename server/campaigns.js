/* Campaigns kept on the server, so two players share one.

   The old single-campaign file is still read and still served: a campaign saved
   before there were names lands under `default`, and a client that asks for
   /campaign with no name gets it. Everything is a JSON file in one directory —
   swap readFile/writeFile for a database when there is a reason to. */
'use strict';
const fs = require('fs');
const path = require('path');

const NAME = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,39}$/;

class Campaigns {
  constructor(dir, opts) {
    this.dir = dir;
    this.log = (opts || {}).log || function () { };
    fs.mkdirSync(dir, { recursive: true });
    this.adopt(path.join(dir, '..', 'campaign.json'));
  }

  /* A campaign.json left beside server.js by the old single-campaign server. */
  adopt(old) {
    try {
      if (!fs.existsSync(old)) return;
      const to = this.file('default');
      if (fs.existsSync(to)) return;
      fs.copyFileSync(old, to);
      this.log('adopted the existing campaign.json as "default"');
    } catch (e) { /* nothing to adopt */ }
  }

  file(name) {
    return path.join(this.dir, encodeURIComponent(name) + '.json');
  }
  valid(name) { return typeof name === 'string' && NAME.test(name); }

  list() {
    let names;
    try { names = fs.readdirSync(this.dir); } catch (e) { return []; }
    return names.filter((f) => f.endsWith('.json')).map((f) => {
      const name = decodeURIComponent(f.slice(0, -5));
      let camp = null;
      try { camp = JSON.parse(fs.readFileSync(path.join(this.dir, f), 'utf8')); } catch (e) { }
      return {
        name: name,
        turn: (camp && camp.turn) || 0,
        companies: camp && camp.companies
          ? ['A', 'B'].map((s) => (camp.companies[s] && camp.companies[s].name) || null)
          : [null, null],
        pending: !!(camp && camp.pending)
      };
    });
  }

  get(name) {
    if (!this.valid(name)) return null;
    try { return JSON.parse(fs.readFileSync(this.file(name), 'utf8')); }
    catch (e) { return null; }
  }

  put(name, camp) {
    if (!this.valid(name)) throw new Error('that is not a usable campaign name');
    if (!camp || !camp.companies) throw new Error('that is not a campaign');
    fs.writeFileSync(this.file(name), JSON.stringify(camp));
    return { ok: true, turn: camp.turn || 0 };
  }

  remove(name) {
    if (!this.valid(name)) return false;
    try { fs.unlinkSync(this.file(name)); return true; }
    catch (e) { return false; }
  }

  /* A battle fought under this campaign. The aftermath itself is the campaign
     module's business; all that happens here is that the report is filed
     against the campaign both players will open next. */
  finish(name, report) {
    const camp = this.get(name);
    if (!camp) return null;
    camp.lastReport = report;
    camp.reports = (camp.reports || []).concat([{ at: Date.now(), report: report }]).slice(-20);
    this.put(name, camp);
    this.log('campaign "' + name + '" recorded a battle on turn ' + (camp.turn || 0));
    return camp;
  }
}

module.exports = { Campaigns: Campaigns };

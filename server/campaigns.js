/* Campaigns kept on the server, so two players share one.

   The old single-campaign file is still read and still served: a campaign saved
   before there were names lands under `default`, and a client that asks for
   /campaign with no name gets it. Everything is a JSON file in one directory —
   swap readFile/writeFile for a database when there is a reason to. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

  /* Who may change a campaign (multiplayer plan MP-3, until there are accounts):
     whoever first saved it here is given a key, and every later save or delete
     must present it. Kept hashed beside the campaign. A campaign saved before
     there were keys is claimed by the next browser to save it. */
  keyFile(name) { return path.join(this.dir, encodeURIComponent(name) + '.key'); }
  hash(key) { return crypto.createHash('sha256').update(String(key)).digest('hex'); }
  mayWrite(name, key) {
    let want;
    try { want = fs.readFileSync(this.keyFile(name), 'utf8').trim(); } catch (e) { return true; }   // nobody holds it yet
    const got = this.hash(key || '');
    return want.length === got.length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(got));
  }
  // the key for a campaign nobody holds yet, given to whoever saves it now; null if it is held
  claim(name) {
    if (fs.existsSync(this.keyFile(name))) return null;
    const key = crypto.randomBytes(24).toString('hex');
    fs.writeFileSync(this.keyFile(name), this.hash(key));
    return key;
  }

  /* Written to a file beside it and renamed over it, so a save cut short leaves
     the last good copy rather than half of a new one. */
  put(name, camp, key) {
    if (!this.valid(name)) throw new Error('that is not a usable campaign name');
    if (!camp || !camp.companies) throw new Error('that is not a campaign');
    if (key !== undefined && !this.mayWrite(name, key)) { const e = new Error('that campaign is someone else\'s to change'); e.code = 403; throw e; }
    const tmp = this.file(name) + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(camp));
    fs.renameSync(tmp, this.file(name));
    const out = { ok: true, turn: camp.turn || 0 };
    if (key !== undefined) { const got = this.claim(name); if (got) out.key = got; }
    return out;
  }

  remove(name, key) {
    if (!this.valid(name)) return false;
    if (key !== undefined && !this.mayWrite(name, key)) return null;
    try { fs.unlinkSync(this.file(name)); } catch (e) { return false; }
    try { fs.unlinkSync(this.keyFile(name)); } catch (e) { }
    return true;
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

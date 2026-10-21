/* The worker threads the tables think the OpFor's answers out ahead in
   (aiworker.js, table.js thinkAhead): a few, made as they are wanted, so a
   battle thinking does not hold the event loop, and the other rooms, still.

   ask(snap, rng, cb): cb(reply) with what the worker sent, or cb(null) if it
   could not be asked or failed. A worker is kept from holding the process open
   while it has nothing to do (a server shutting down, a test finishing).
   PMC_NO_AIWORKER=1: none at all, and every table thinks on the event loop, as before. */
'use strict';
const path = require('path');
const os = require('os');

let Worker = null;
try { Worker = require('worker_threads').Worker; } catch (e) { Worker = null; }

// (a Raspberry Pi has four cores: one for the event loop, two for this, one to spare)
const SIZE = Math.max(1, Math.min(2, ((os.cpus() || []).length || 2) - 1));
const FILE = path.join(__dirname, 'aiworker.js');
const pool = [];                       // { w, busy, jobs: Map(id -> cb) }
let seq = 0;

function spawn() {
  const slot = { w: null, busy: 0, jobs: new Map() };
  const w = new Worker(FILE);
  slot.w = w;
  w.unref();
  w.on('message', (m) => {
    const cb = slot.jobs.get(m && m.id);
    if (!cb) return;
    slot.jobs.delete(m.id);
    if (--slot.busy === 0) w.unref();
    cb(m);
  });
  // a worker gone (it threw outside a job, or ran out of memory): its jobs are let go of, and another is made when wanted
  const gone = () => {
    const i = pool.indexOf(slot);
    if (i >= 0) pool.splice(i, 1);
    const cbs = [...slot.jobs.values()];
    slot.jobs.clear();
    cbs.forEach((cb) => cb(null));
  };
  w.on('error', gone);
  w.on('exit', gone);
  pool.push(slot);
  return slot;
}

function available() { return !!Worker && process.env.PMC_NO_AIWORKER !== '1'; }

function ask(snap, rng, cb) {
  if (!available()) { cb(null); return false; }
  let slot;
  try {
    // the least busy of them, or another while the pool is not full
    slot = pool.slice().sort((a, b) => a.busy - b.busy)[0];
    if (!slot || (slot.busy && pool.length < SIZE)) slot = spawn();
  } catch (e) { cb(null); return false; }
  const id = ++seq;
  slot.jobs.set(id, cb);
  if (slot.busy++ === 0) slot.w.ref();     // (held open while it has work: the answer is waited for)
  try { slot.w.postMessage({ id: id, snap: snap, rng: rng }); }
  catch (e) { slot.jobs.delete(id); if (--slot.busy === 0) slot.w.unref(); cb(null); return false; }
  return true;
}

// every worker let go of (the tests, a server stopping)
function close() { pool.splice(0).forEach((s) => { s.jobs.clear(); s.w.terminate(); }); }

module.exports = { ask, available, close, SIZE };

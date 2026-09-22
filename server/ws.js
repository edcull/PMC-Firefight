/* A WebSocket server in one file, no dependencies — RFC 6455, the parts a game
   needs: the handshake, text frames in both directions, fragmentation on the way
   in, ping/pong, and a clean close. Binary frames are accepted and handed on as
   Buffers; the protocol above this only ever sends JSON.

   Usage:
     const ws = require('./ws');
     ws.attach(httpServer, '/ws', function (sock, req) {
       sock.on('message', function (text) { ... });
       sock.send('...');
     });
*/
'use strict';
const crypto = require('crypto');
const { EventEmitter } = require('events');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_MESSAGE = 8 * 1024 * 1024;      // a battlefield snapshot is well under this

function accept(key) {
  return crypto.createHash('sha1').update(key + GUID).digest('base64');
}

/* ---- frames ---- */
/* Opcodes: 0 continuation, 1 text, 2 binary, 8 close, 9 ping, 10 pong.
   A frame from a client must be masked and one from a server must not be, so
   which end is writing decides. */
function frame(opcode, payload, masked) {
  const len = payload.length;
  let head;
  if (len < 126) {
    head = Buffer.alloc(2);
    head[1] = len;
  } else if (len < 65536) {
    head = Buffer.alloc(4);
    head[1] = 126;
    head.writeUInt16BE(len, 2);
  } else {
    head = Buffer.alloc(10);
    head[1] = 127;
    // lengths above 2^32 never happen here, so the high word is zero
    head.writeUInt32BE(0, 2);
    head.writeUInt32BE(len, 6);
  }
  head[0] = 0x80 | opcode;                 // FIN set: every message goes out whole
  if (!masked) return Buffer.concat([head, payload]);
  head[1] |= 0x80;
  const key = crypto.randomBytes(4);
  const body = Buffer.allocUnsafe(len);
  for (let i = 0; i < len; i++) body[i] = payload[i] ^ key[i & 3];
  return Buffer.concat([head, key, body]);
}

class Socket extends EventEmitter {
  constructor(sock, req, isClient) {
    super();
    this.raw = sock;
    this.req = req;
    this.open = true;
    this.alive = true;
    this.client = !!isClient;              // which end we are, which decides masking
    this.data = {};                        // whatever the layer above wants to hang here
    this._buf = Buffer.alloc(0);
    this._frag = null;                     // { opcode, chunks, length }

    sock.setNoDelay(true);
    sock.on('data', (c) => this._feed(c));
    sock.on('close', () => this._shut());
    /* A socket that fails is one player gone, not a reason to stop the game:
       a tab closed mid-frame arrives as ECONNRESET, and an 'error' nobody is
       listening for is thrown by EventEmitter and would take the server with
       it. Tell whoever is listening, if anyone is, and close the socket. */
    sock.on('error', (e) => {
      if (this.listenerCount('error')) this.emit('error', e);
      this._shut();
    });
  }

  send(text) {
    if (!this.open) return false;
    const body = Buffer.isBuffer(text) ? text : Buffer.from(String(text), 'utf8');
    try { this.raw.write(frame(Buffer.isBuffer(text) ? 2 : 1, body, this.client)); }
    catch (e) { return false; }
    return true;
  }

  ping() {
    if (!this.open) return;
    try { this.raw.write(frame(9, Buffer.alloc(0), this.client)); } catch (e) { }
  }

  close(code, reason) {
    if (!this.open) return;
    const body = Buffer.alloc(2 + Buffer.byteLength(reason || ''));
    body.writeUInt16BE(code || 1000, 0);
    if (reason) body.write(reason, 2);
    try { this.raw.write(frame(8, body, this.client)); } catch (e) { }
    this.open = false;
    try { this.raw.end(); } catch (e) { }
  }

  _shut() {
    if (!this.open && this._gone) return;
    this._gone = true;
    this.open = false;
    this.emit('close');
  }

  _feed(chunk) {
    this._buf = this._buf.length ? Buffer.concat([this._buf, chunk]) : chunk;
    for (;;) {
      const got = this._frame();
      if (!got) return;
      if (got === 'bad') { this.close(1002, 'protocol error'); return; }
    }
  }

  /* Pull one frame off the front of the buffer. Returns false when there is not
     a whole one there yet, 'bad' on a protocol violation, true when one was
     consumed (there may be another behind it). */
  _frame() {
    const b = this._buf;
    if (b.length < 2) return false;
    const fin = (b[0] & 0x80) !== 0;
    const opcode = b[0] & 0x0f;
    const masked = (b[1] & 0x80) !== 0;
    let len = b[1] & 0x7f;
    let off = 2;
    if (len === 126) {
      if (b.length < 4) return false;
      len = b.readUInt16BE(2); off = 4;
    } else if (len === 127) {
      if (b.length < 10) return false;
      const hi = b.readUInt32BE(2);
      if (hi !== 0) return 'bad';
      len = b.readUInt32BE(6); off = 10;
    }
    /* Every frame from a browser is masked and every frame from a server is
       not, so an unexpected mask bit either way is a protocol error. */
    if (masked === this.client) return 'bad';
    if (len > MAX_MESSAGE) return 'bad';
    if (b.length < off + (masked ? 4 : 0) + len) return false;
    let mask = null;
    if (masked) { mask = b.slice(off, off + 4); off += 4; }
    const body = Buffer.allocUnsafe(len);
    for (let i = 0; i < len; i++) body[i] = mask ? b[off + i] ^ mask[i & 3] : b[off + i];
    this._buf = b.slice(off + len);

    if (opcode === 8) { this.close(1000, ''); return true; }
    if (opcode === 9) { if (this.open) { try { this.raw.write(frame(10, body, this.client)); } catch (e) { } } return true; }
    if (opcode === 10) { this.alive = true; return true; }

    if (opcode === 0) {
      // a continuation with nothing to continue is a protocol error
      if (!this._frag) return 'bad';
      this._frag.chunks.push(body);
      this._frag.length += len;
      if (this._frag.length > MAX_MESSAGE) return 'bad';
      if (!fin) return true;
      const whole = Buffer.concat(this._frag.chunks, this._frag.length);
      const op = this._frag.opcode;
      this._frag = null;
      this._deliver(op, whole);
      return true;
    }
    if (opcode !== 1 && opcode !== 2) return 'bad';
    if (this._frag) return 'bad';           // a new message on top of an unfinished one
    if (!fin) { this._frag = { opcode: opcode, chunks: [body], length: len }; return true; }
    this._deliver(opcode, body);
    return true;
  }

  _deliver(opcode, body) {
    this.alive = true;
    if (opcode === 1) this.emit('message', body.toString('utf8'));
    else this.emit('binary', body);
  }
}

/* Take over the upgrade on `path` and hand each accepted socket to `onOpen`.
   A heartbeat runs underneath: a client that misses two pings is dropped, which
   is how a closed laptop lid gets noticed. */
function attach(server, path, onOpen, opts) {
  opts = opts || {};
  const sockets = new Set();

  server.on('upgrade', function (req, sock, head) {
    const url = (req.url || '').split('?')[0];
    if (url.replace(/\/$/, '') !== path.replace(/\/$/, '')) {
      sock.destroy();
      return;
    }
    const key = req.headers['sec-websocket-key'];
    if ((req.headers.upgrade || '').toLowerCase() !== 'websocket' || !key) {
      sock.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      return;
    }
    sock.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      'Sec-WebSocket-Accept: ' + accept(key) + '\r\n\r\n');

    const s = new Socket(sock, req);
    sockets.add(s);
    s.on('close', () => sockets.delete(s));
    if (head && head.length) s._feed(head);
    try { onOpen(s, req); }
    catch (e) { s.close(1011, 'server error'); }
  });

  const beat = setInterval(function () {
    sockets.forEach(function (s) {
      if (!s.alive) { s.close(1001, 'no answer'); try { s.raw.destroy(); } catch (e) { } return; }
      s.alive = false;
      s.ping();
    });
  }, opts.heartbeat || 25000);
  beat.unref && beat.unref();

  return { sockets: sockets, stop: function () { clearInterval(beat); } };
}

/* The other end of the same wire. Node has no WebSocket client of its own that
   this code can lean on without a dependency, and the test suite needs one to
   play a whole game against the server the way a browser would. */
function connect(url, done) {
  const net = require('net');
  const u = new URL(url);
  const key = crypto.randomBytes(16).toString('base64');
  const raw = net.connect({
    host: u.hostname,
    port: +u.port || (u.protocol === 'wss:' ? 443 : 80)
  });
  let handshake = Buffer.alloc(0);
  let sock = null;

  raw.on('connect', function () {
    raw.write(
      'GET ' + (u.pathname || '/') + ' HTTP/1.1\r\n' +
      'Host: ' + u.host + '\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      'Sec-WebSocket-Key: ' + key + '\r\n' +
      'Sec-WebSocket-Version: 13\r\n\r\n');
  });

  function onHead(chunk) {
    handshake = Buffer.concat([handshake, chunk]);
    const end = handshake.indexOf('\r\n\r\n');
    if (end < 0) return;
    const head = handshake.slice(0, end).toString('ascii');
    const rest = handshake.slice(end + 4);
    raw.removeListener('data', onHead);
    if (!/^HTTP\/1\.1 101/.test(head)) { raw.destroy(); return done(new Error('not upgraded: ' + head.split('\r\n')[0])); }
    if (!new RegExp('sec-websocket-accept: ' + accept(key).replace(/\+/g, '\\+'), 'i').test(head)) {
      raw.destroy();
      return done(new Error('the server did not answer the key'));
    }
    sock = new Socket(raw, null, true);
    if (rest.length) sock._feed(rest);
    done(null, sock);
  }
  raw.on('data', onHead);
  raw.on('error', function (e) { if (!sock) done(e); });
}

module.exports = { attach: attach, connect: connect, Socket: Socket, frame: frame };

/* Email from the server: the links that activate an account, reset a password, or
   confirm a new address (auth.js). Sent through any SMTP server (nodemailer),
   set up in the environment:

     PUBLIC_URL     the address players open the game at, e.g. https://example.org/pmc/
                    (the links go there — never to an address taken from a request,
                    which anyone could make up)
     SMTP_HOST      the mail server
     SMTP_PORT      587 by default (465 means TLS from the start)
     SMTP_USER, SMTP_PASS   its sign-in, if it wants one
     MAIL_FROM      who the mail is from (SMTP_USER by default)
     MAIL_OUTBOX    instead of SMTP: a folder each message is written to, as a file
                    (for trying it out, and the tests)

   Without SMTP_HOST and PUBLIC_URL nothing is sent: each message, link and all, is
   written to the server's log instead, and accounts are active as soon as they are
   made (there would be no way to activate them). */
'use strict';

function create(opts) {
  opts = opts || {};
  const env = opts.env || process.env;
  const log = opts.log || function () { };
  const url = String(env.PUBLIC_URL || '').trim();
  const host = String(env.SMTP_HOST || '').trim();
  const outbox = String(env.MAIL_OUTBOX || '').trim();
  let tx = null;
  if (outbox && url) {
    const fs = require('fs'), path = require('path');
    fs.mkdirSync(outbox, { recursive: true });
    let n = 0;
    tx = { sendMail: (m) => new Promise((res, rej) => {
      const f = path.join(outbox, Date.now() + '-' + (n++) + '.json');
      fs.writeFile(f, JSON.stringify(m, null, 1), (e) => (e ? rej(e) : res()));
    }) };
  } else if (host && url) {
    const port = +env.SMTP_PORT || 587;
    tx = require('nodemailer').createTransport({
      host: host, port: port, secure: env.SMTP_SECURE === '1' || port === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS || '' } : undefined
    });
  } else if (host) log('SMTP_HOST is set but PUBLIC_URL is not: no mail will be sent until it is');
  const from = env.MAIL_FROM || env.SMTP_USER || 'PMC 2670 <noreply@localhost>';
  const base = url ? url.replace(/\/*$/, '/') : '/';

  return {
    // whether mail actually goes out (and so whether a new account waits for its link)
    live: !!tx,
    // the page a link opens: the game, told what the link is for
    link(kind, t) { return base + '?' + kind + '=' + encodeURIComponent(t); },
    send(m) {
      if (!tx) {
        log('mail not sent (no SMTP set up) to ' + m.to + ': ' + m.subject + '\n' + m.text);
        return Promise.resolve({ ok: false, logged: true });
      }
      return tx.sendMail({ from: from, to: m.to, subject: m.subject, text: m.text })
        .then(() => ({ ok: true }), (e) => { log('mail to ' + m.to + ' failed: ' + ((e && e.message) || e)); return { ok: false }; });
    }
  };
}

module.exports = { create: create };

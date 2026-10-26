'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { securityHeaders, inlineHashes } = require('./lib/security.cjs');
const { validateRequest } = require('./lib/request-validation.cjs');
const { allPages } = require('./lib/site-files.cjs');
const analytics = require('./lib/analytics.cjs');
const { createClientAddressResolver } = require('./lib/client-address.cjs');
const MIN_PASSWORD = 12, MAX_PASSWORD = 256;

function createApp(options = {}) {
  const { createAssessmentAccess } = require('./lib/assessment-access.cjs');
  const assessment = createAssessmentAccess({
    store: require('./lib/assessment-memory-store.cjs').createMemoryStore(),
    codeHash: options.assessmentCodeHash || require('./lib/assessment-access-config.cjs').codeHash,
    html: require('./private/assessment-app.cjs'), secure: process.env.COOKIE_SECURE === 'true'
  });
  const clientAddress = createClientAddressResolver(options.trustedProxies ?? process.env.TRUSTED_PROXIES ?? '');
  const suppliedPassword = options.password || process.env.INBOX_PASSWORD;
  if (suppliedPassword && (typeof suppliedPassword !== 'string' || suppliedPassword.length < MIN_PASSWORD || suppliedPassword.length > MAX_PASSWORD)) {
    throw new Error('INBOX_PASSWORD must contain between 12 and 256 characters.');
  }
  const root = __dirname;
  const dataDir = path.resolve(options.dataDir || process.env.DATA_DIR || path.join(root, '.data'));
  fs.mkdirSync(dataDir, { recursive: true });
  const authFile = path.join(dataDir, 'inbox-auth.json');
  const passwordFile = path.join(dataDir, 'inbox-password.txt');
  const hashPassword = (password, salt) => crypto.scryptSync(password, salt, 64).toString('hex');
  let credentials;
  if (suppliedPassword) {
    const salt = crypto.randomBytes(16).toString('hex');
    credentials = { salt, hash: hashPassword(suppliedPassword, salt) };
  } else if (fs.existsSync(authFile)) {
    credentials = JSON.parse(fs.readFileSync(authFile, 'utf8'));
  } else {
    const password = crypto.randomBytes(18).toString('base64url');
    const salt = crypto.randomBytes(16).toString('hex');
    credentials = { salt, hash: hashPassword(password, salt) };
    fs.writeFileSync(authFile, JSON.stringify(credentials), { mode: 0o600, flag: 'wx' });
    fs.writeFileSync(passwordFile, password + '\n', { mode: 0o600, flag: 'wx' });
  }
  const verifyPassword = password => {
    if (typeof password !== 'string' || password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) return false;
    const hash = Buffer.from(hashPassword(password, credentials.salt), 'hex');
    const expected = Buffer.from(credentials.hash, 'hex');
    return hash.length === expected.length && crypto.timingSafeEqual(hash, expected);
  };
  const db = new DatabaseSync(path.join(dataDir, 'requests.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY, reference TEXT UNIQUE NOT NULL,
      client_token TEXT UNIQUE NOT NULL, kind TEXT NOT NULL,
      created_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new',
      details TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS requests_created ON requests(created_at DESC);
    CREATE INDEX IF NOT EXISTS requests_kind_created ON requests(kind, created_at DESC);
    CREATE INDEX IF NOT EXISTS requests_status_created ON requests(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS requests_kind_status_created ON requests(kind, status, created_at DESC);
    CREATE TABLE IF NOT EXISTS pageviews (
      day TEXT NOT NULL, page TEXT NOT NULL, views INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (day, page)
    );`);
  const insert = db.prepare('INSERT INTO requests (id, reference, client_token, kind, created_at, details) VALUES (?, ?, ?, ?, ?, ?)');
  const findToken = db.prepare('SELECT reference, kind, details FROM requests WHERE client_token = ?');
  const sessions = new Map();
  const rates = new Map();
  const pages = new Set([...allPages, 'sitemap.xml', 'robots.txt']);
  const mime = { '.html':'text/html; charset=utf-8', '.xml':'application/xml; charset=utf-8', '.txt':'text/plain; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.mp4':'video/mp4', '.pdf':'application/pdf' };
  const fail = (status, message) => Object.assign(new Error(message), { status });
  const json = (res, status, value) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(value));
  };
  function limit(req, key, max, res) {
    const now = Date.now(), id = key + ':' + clientAddress(req);
    let bucket = rates.get(id);
    if (!bucket || bucket.until <= now) { bucket = { count: 0, until: now + 15 * 60 * 1000 }; rates.set(id, bucket); }
    if (++bucket.count > max) {
      res.setHeader('Retry-After', Math.ceil((bucket.until - now) / 1000));
      throw fail(429, 'Please wait a little before trying again.');
    }
  }
  function readJson(req) {
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw fail(415, 'Please send this request using the website form.');
    const origin = req.headers.origin;
    if (!origin) throw fail(403, 'Please submit this request from the website.');
    try {
      const parsed = new URL(origin);
      if (parsed.host !== req.headers.host || !['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    } catch (_) { throw fail(403, 'Please submit this request from the website.'); }
    return new Promise((resolve, reject) => {
      let size = 0, tooLarge = false;
      const chunks = [];
      req.on('data', chunk => {
        size += chunk.length;
        if (size > 16384) tooLarge = true;
        else chunks.push(chunk);
      });
      req.on('end', () => {
        if (tooLarge) return reject(fail(413, 'Your request is too long. Please shorten it.'));
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
          resolve(body);
        } catch (_) { reject(fail(400, 'Please check the form and try again.')); }
      });
      req.on('error', reject);
    });
  }
  const sessionToken = req => {
    const match = (req.headers.cookie || '').match(/(?:^|;\s*)bc_inbox_session=([a-f0-9]{64})(?:;|$)/);
    return match ? match[1] : '';
  };
  const authorized = req => {
    const token = sessionToken(req), expires = sessions.get(token);
    if (!expires || expires < Date.now()) { sessions.delete(token); return false; }
    return true;
  };
  const setCookie = (req, res, token, age) => res.setHeader('Set-Cookie', 'bc_inbox_session=' + token + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=' + age + ((req.socket.encrypted || process.env.COOKIE_SECURE === 'true') ? '; Secure' : ''));
  async function handleApi(req, res, url) {
    // Signing out must remain possible after the general allowance is used.
    if (!(url.pathname === '/api/inbox/logout' && req.method === 'POST')) limit(req, 'api', 150, res);
    if (url.pathname === '/api/pageviews' && req.method === 'POST') {
      limit(req, 'pageview', 30, res);
      const page = analytics.validatePage(await readJson(req));
      if (req.headers.dnt === '1' || req.headers['sec-gpc'] === '1') { json(res, 200, { ok: true }); return; }
      db.prepare('INSERT INTO pageviews (day, page, views) VALUES (?, ?, 1) ON CONFLICT(day, page) DO UPDATE SET views = views + 1').run(analytics.dayAt(Date.now()), page);
      json(res, 200, { ok: true }); return;
    }
    if (url.pathname === '/api/requests' && req.method === 'POST') {
      limit(req, 'request', 20, res);
      const body = await readJson(req);
      const { token, details } = validateRequest(body);
      const existing = findToken.get(token);
      if (existing) {
        if (existing.kind !== body.kind || existing.details !== JSON.stringify(details)) throw fail(409, 'This request reference has already been used. Please refresh the page before sending a different request.');
        json(res, 201, { ok: true, reference: existing.reference }); return;
      }
      const reference = 'BC-' + crypto.randomBytes(6).toString('hex').toUpperCase();
      insert.run(crypto.randomUUID(), reference, token, body.kind, new Date().toISOString(), JSON.stringify(details));
      json(res, 201, { ok: true, reference });
      return;
    }
    if (url.pathname === '/api/inbox/login' && req.method === 'POST') {
      limit(req, 'login', 8, res);
      const body = await readJson(req);
      if (!verifyPassword(body.password)) throw fail(401, 'That password is not correct.');
      const token = crypto.randomBytes(32).toString('hex');
      sessions.set(token, Date.now() + 12 * 60 * 60 * 1000);
      setCookie(req, res, token, 12 * 60 * 60);
      json(res, 200, { ok: true, canChangePassword: !suppliedPassword }); return;
    }
    if (!url.pathname.startsWith('/api/inbox/')) throw fail(404, 'Not found.');
    if (!authorized(req)) throw fail(401, 'Please sign in to your inbox.');
    if (url.pathname === '/api/inbox/session' && req.method === 'GET') { json(res, 200, { ok: true, canChangePassword: !suppliedPassword }); return; }
    if (url.pathname === '/api/inbox/analytics' && req.method === 'GET') {
      const days = analytics.periodDays(url.searchParams.get('days'));
      const rows = db.prepare('SELECT day, page, views FROM pageviews WHERE day >= ?').all(analytics.dateRange(Date.now(), days)[0]);
      json(res, 200, analytics.summarize(rows, Date.now(), days)); return;
    }
    if (url.pathname === '/api/inbox/logout' && req.method === 'POST') {
      await readJson(req);
      sessions.delete(sessionToken(req)); setCookie(req, res, '', 0);
      json(res, 200, { ok: true }); return;
    }
    if (url.pathname === '/api/inbox/password' && req.method === 'POST') {
      limit(req, 'password', 8, res);
      const body = await readJson(req);
      if (suppliedPassword) throw fail(409, 'This password is managed by your server settings.');
      if (!verifyPassword(body.currentPassword)) throw fail(401, 'Your current password is not correct.');
      if (typeof body.newPassword !== 'string' || body.newPassword.length < MIN_PASSWORD || body.newPassword.length > MAX_PASSWORD) throw fail(422, 'Use a password with 12 to 256 characters.');
      const salt = crypto.randomBytes(16).toString('hex');
      const nextCredentials = { salt, hash: hashPassword(body.newPassword, salt) };
      fs.writeFileSync(authFile + '.tmp', JSON.stringify(nextCredentials), { mode: 0o600 });
      fs.renameSync(authFile + '.tmp', authFile);
      credentials = nextCredentials;
      if (fs.existsSync(passwordFile)) fs.unlinkSync(passwordFile);
      sessions.clear(); setCookie(req, res, '', 0);
      json(res, 200, { ok: true }); return;
    }
    if (url.pathname === '/api/inbox/requests' && req.method === 'GET') {
      const page = Math.max(1, Math.min(100000, Number.parseInt(url.searchParams.get('page'), 10) || 1));
      const kind = ['materials', 'trial', 'payment'].includes(url.searchParams.get('kind')) ? url.searchParams.get('kind') : '';
      const unread = url.searchParams.get('unread') === '1';
      const clauses = [], args = [];
      if (kind) { clauses.push('kind = ?'); args.push(kind); }
      if (unread) clauses.push("status = 'new'");
      const where = clauses.length ? ' WHERE ' + clauses.join(' AND ') : '';
      const total = db.prepare('SELECT COUNT(*) AS total FROM requests' + where).get(...args).total;
      const unreadCount = db.prepare("SELECT COUNT(*) AS total FROM requests WHERE status = 'new'").get().total;
      const rows = db.prepare('SELECT id, reference, kind, created_at, status, details FROM requests' + where + ' ORDER BY created_at DESC, rowid DESC LIMIT 30 OFFSET ?').all(...args, (page - 1) * 30);
      json(res, 200, { ok: true, requests: rows.map(row => ({ ...row, details: JSON.parse(row.details) })), total, unreadCount, page, pageSize: 30 });
      return;
    }
    const item = url.pathname.match(/^\/api\/inbox\/requests\/([a-f0-9-]{36})$/);
    if (item && req.method === 'PATCH') {
      const body = await readJson(req);
      if (!['read', 'new'].includes(body.status)) throw fail(422, 'Choose a valid request status.');
      const result = db.prepare('UPDATE requests SET status = ? WHERE id = ?').run(body.status, item[1]);
      if (!result.changes) throw fail(404, 'This request could not be found.');
      json(res, 200, { ok: true }); return;
    }
    throw fail(404, 'Not found.');
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    for (const [key, value] of Object.entries(securityHeaders([], process.env.COOKIE_SECURE === 'true'))) res.setHeader(key, value);
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/assessment/')) {
        const scheme = process.env.COOKIE_SECURE === 'true' ? 'https:' : 'http:';
        const request = new Request(scheme + '//' + req.headers.host + req.url, { method: req.method, headers: req.headers, ...(['GET', 'HEAD'].includes(req.method) ? {} : { body: require('node:stream').Readable.toWeb(req), duplex: 'half' }) });
        const result = await assessment(request, { ip: clientAddress(req) });
        res.writeHead(result.status, Object.fromEntries(result.headers));
        res.end(Buffer.from(await result.arrayBuffer())); return;
      }
      if (url.pathname === '/inbox.html' || url.pathname.startsWith('/api/')) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      if (url.pathname.startsWith('/api/')) { await handleApi(req, res, url); return; }
      if (!['GET', 'HEAD'].includes(req.method)) throw fail(405, 'Method not allowed.');
      const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
      const file = path.resolve(root, relative);
      const assets = path.join(root, 'assets') + path.sep;
      if (!(pages.has(relative) || (relative.startsWith('assets/') && file.startsWith(assets)))) throw fail(404, 'Not found.');
      if (path.extname(file).toLowerCase() === '.mp4') {
        const stat = await fs.promises.stat(file).catch(() => { throw fail(404, 'Not found.'); });
        if (!stat.isFile()) throw fail(404, 'Not found.');
        let start = 0, end = stat.size - 1, status = 200;
        res.setHeader('Accept-Ranges', 'bytes');
        if (req.headers.range && req.method === 'GET') {
          const range = req.headers.range.match(/^bytes=(\d*)-(\d*)$/);
          if (range && range[1]) {
            start = Number(range[1]);
            end = range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
          } else if (range && range[2]) {
            const suffix = Number(range[2]);
            start = suffix > 0 && Number.isSafeInteger(suffix) ? Math.max(0, stat.size - suffix) : stat.size;
          } else start = stat.size;
          if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= stat.size || end < start) {
            res.writeHead(416, { 'Content-Range': 'bytes */' + stat.size }); res.end(); return;
          }
          status = 206;
          res.setHeader('Content-Range', 'bytes ' + start + '-' + end + '/' + stat.size);
        }
        res.writeHead(status, { 'Content-Type': 'video/mp4', 'Content-Length': stat.size ? end - start + 1 : 0 });
        if (req.method === 'HEAD' || !stat.size) { res.end(); return; }
        const stream = fs.createReadStream(file, { start, end });
        stream.on('error', () => res.destroy());
        res.on('close', () => stream.destroy());
        stream.pipe(res);
        return;
      }
      const bytes = await fs.promises.readFile(file).catch(() => { throw fail(404, 'Not found.'); });
      if (path.extname(file) === '.html') res.setHeader('Content-Security-Policy', securityHeaders(inlineHashes(bytes.toString('utf8')))['Content-Security-Policy']);
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch (error) {
      if (!res.headersSent) json(res, error.status || 500, { ok: false, error: error.status ? error.message : 'We could not save this request. Please try again.' });
      else res.end();
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of sessions) if (value < now) sessions.delete(key);
    for (const [key, value] of rates) if (value.until < now) rates.delete(key);
  }, 60000).unref();
  server.on('close', () => { clearInterval(cleanup); db.close(); });
  return { server, dataDir };
}

if (require.main === module) {
  const app = createApp();
  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT || 4173);
  app.server.listen(port, host, () => {
    console.log('BeyondClass website: http://' + host + ':' + port + '/');
    console.log('Owner inbox: /inbox.html');
    console.log('First-run password is stored in .data/inbox-password.txt.');
  });
}
module.exports = { createApp };

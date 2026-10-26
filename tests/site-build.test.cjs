'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { publicPages, pageUrl } = require('../lib/site-files.cjs');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'dist');

test('Netlify build publishes only public assets and creates correct search and security files', () => {
  execFileSync(process.execPath, ['scripts/build.cjs'], { cwd: root, env: { ...process.env, SITE_URL: 'https://beyondclassmath.netlify.app', CONTEXT: 'production', GOOGLE_SITE_VERIFICATION: '' } });
  const top = fs.readdirSync(output).sort();
  assert.deepEqual(top, ['_headers', '_redirects', 'assets', 'inbox.html', 'robots.txt', 'sitemap.xml', ...publicPages].sort());
  for (const name of ['.data', '.env', '.preview', '.git', 'node_modules', 'server.cjs', 'lib', 'netlify', 'package.json']) assert(!fs.existsSync(path.join(output, name)));
  const sitemap = fs.readFileSync(path.join(output, 'sitemap.xml'), 'utf8');
  const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
  assert.deepEqual(locations, publicPages.map(file => pageUrl('https://beyondclassmath.netlify.app', file)));
  assert(!sitemap.includes('inbox'));
  for (const file of publicPages) {
    const html = fs.readFileSync(path.join(output, file), 'utf8');
    assert(html.includes('rel="canonical" href="' + pageUrl('https://beyondclassmath.netlify.app', file) + '"'));
    assert(!html.includes('https://www.beyondclassmath.com/'));
    assert(html.includes('property="og:image"'));
    assert.equal((html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').match(/<h1\b/g) || []).length, 1);
    for (const script of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(script[1]);
  }
  const headers = fs.readFileSync(path.join(output, '_headers'), 'utf8');
  assert(headers.includes("frame-ancestors 'none'")); assert(headers.includes('Strict-Transport-Security'));
  assert(!headers.includes("script-src 'self' 'unsafe-inline'"));
});

test('new domain and Google verification update the build without exposing preview pages to search', () => {
  try {
    execFileSync(process.execPath, ['scripts/build.cjs'], { cwd: root, env: { ...process.env, SITE_URL: 'https://example.invalid', CONTEXT: 'deploy-preview', GOOGLE_SITE_VERIFICATION: 'test-only-google-verification-code' } });
    const home = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
    assert(home.includes('rel="canonical" href="https://example.invalid/"'));
    assert(home.includes('name="google-site-verification" content="test-only-google-verification-code"'));
    assert(fs.readFileSync(path.join(output, '_redirects'), 'utf8').includes('https://beyondclassmath.netlify.app/* https://example.invalid/:splat 301!'));
    assert(fs.readFileSync(path.join(output, '_headers'), 'utf8').includes('/*\n  X-Robots-Tag: noindex, nofollow'));
    assert(fs.readFileSync(path.join(output, 'robots.txt'), 'utf8').includes('https://example.invalid/sitemap.xml'));
  } finally {
    execFileSync(process.execPath, ['scripts/build.cjs'], { cwd: root, env: { ...process.env, SITE_URL: 'https://beyondclassmath.netlify.app', CONTEXT: 'production', GOOGLE_SITE_VERIFICATION: '' } });
  }
});

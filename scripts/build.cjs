'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { allPages, normalizeUrl, searchFiles, configureHtml } = require('../lib/site-files.cjs');
const { securityHeaders, inlineHashes } = require('../lib/security.cjs');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'dist');
const siteConfig = require('../site.config.json');
const origin = normalizeUrl(process.env.SITE_URL || siteConfig.url);
if (path.dirname(output) !== root || path.basename(output) !== 'dist') throw new Error('Invalid build destination.');
if (fs.existsSync(output)) {
  if (fs.lstatSync(output).isSymbolicLink() || fs.realpathSync(output) !== output) throw new Error('Build destination must be a real workspace directory.');
  fs.rmSync(output, { recursive: true });
}
fs.mkdirSync(output);
const hashes = new Set();
for (const file of allPages) {
  const html = configureHtml(fs.readFileSync(path.join(root, file), 'utf8'), origin, file);
  inlineHashes(html).forEach(hash => hashes.add(hash));
  fs.writeFileSync(path.join(output, file), html);
}
function copyAssets(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (entry.isSymbolicLink() || entry.name.startsWith('.')) throw new Error('Unexpected asset: ' + entry.name);
    const from = path.join(source, entry.name), to = path.join(destination, entry.name);
    if (entry.isDirectory()) copyAssets(from, to);
    else if (/\.(?:css|js|svg|png|jpe?g|mp4|pdf|webp|woff2?)$/i.test(entry.name)) fs.copyFileSync(from, to);
    else throw new Error('Unexpected public asset type: ' + entry.name);
  }
}
copyAssets(path.join(root, 'assets'), path.join(output, 'assets'));
for (const [file, text] of Object.entries(searchFiles(origin))) fs.writeFileSync(path.join(output, file), text);
let headers = '/*\n' + Object.entries(securityHeaders([...hashes], true)).map(([key, value]) => '  ' + key + ': ' + value).join('\n') + '\n\n/inbox.html\n  Cache-Control: no-store\n  X-Robots-Tag: noindex, nofollow\n';
if (process.env.CONTEXT && process.env.CONTEXT !== 'production') headers += '\n/*\n  X-Robots-Tag: noindex, nofollow\n';
fs.writeFileSync(path.join(output, '_headers'), headers);
const netlifyOrigin = normalizeUrl(siteConfig.netlifyUrl || siteConfig.url);
const redirects = (origin !== netlifyOrigin ? netlifyOrigin + '/index.html ' + origin + '/ 301!\n' + netlifyOrigin + '/* ' + origin + '/:splat 301!\n' : '') + '/index.html / 301\n';
fs.writeFileSync(path.join(output, '_redirects'), redirects);
console.log('Built ' + allPages.length + ' pages for ' + origin + '. Private files are excluded.');

'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { publicPages, normalizeUrl, searchFiles, configureHtml } = require('../lib/site-files.cjs');
const root = path.resolve(__dirname, '..');
const configFile = path.join(root, 'site.config.json');
const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
const origin = normalizeUrl(process.argv[2] || config.url);
fs.writeFileSync(configFile, JSON.stringify({ ...config, url: origin }, null, 2) + '\n');
for (const file of publicPages) {
  const full = path.join(root, file), before = fs.readFileSync(full, 'utf8');
  const after = configureHtml(before, origin, file);
  if (before !== after) fs.writeFileSync(full, after);
}
for (const [file, text] of Object.entries(searchFiles(origin))) fs.writeFileSync(path.join(root, file), text);
console.log('Search settings configured for ' + origin);

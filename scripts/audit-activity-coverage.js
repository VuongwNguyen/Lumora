#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const publicRoot = path.join(root, 'public');
const failures = [];
const stats = { pages: 0, controls: 0, fetchCalls: 0, xhrCalls: 0, failureBranches: 0, dynamicControls: 0 };

function walk(directory, predicate) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...walk(full, predicate));
    else if (!predicate || predicate(full)) result.push(full);
  }
  return result;
}

function relative(file) { return path.relative(root, file).replace(/\\/g, '/'); }
function count(source, regex) { return (source.match(regex) || []).length; }

const htmlFiles = walk(publicRoot, file => file.endsWith('.html'));
for (const file of htmlFiles) {
  const rel = relative(file);
  const source = fs.readFileSync(file, 'utf8');
  if (rel.startsWith('public/admin/')) {
    if (/activityAutoTracker|trackedFetch|activityLogger/.test(source)) failures.push(`${rel}: admin must not load end-user tracking`);
    continue;
  }
  stats.pages += 1;
  stats.controls += count(source, /<(button|a)\b|<input\b[^>]*type=["'](?:submit|button|file)["']|role=["']button["']/gi);
  const scripts = ['activityApi.js', 'activityLogger.js', 'trackedFetch.js', 'activityAutoTracker.js'];
  let previous = -1;
  for (const script of scripts) {
    const index = source.indexOf(script);
    if (index < 0) failures.push(`${rel}: missing ${script}`);
    if (index >= 0 && index < previous) failures.push(`${rel}: tracking scripts are not loaded in safe order`);
    previous = Math.max(previous, index);
  }
}

const jsFiles = walk(publicRoot, file => file.endsWith('.js') && !relative(file).includes('/vendor/'));
for (const file of jsFiles) {
  const rel = relative(file);
  const source = fs.readFileSync(file, 'utf8');
  stats.fetchCalls += count(source, /\bfetch\s*\(/g);
  stats.xhrCalls += count(source, /\bXMLHttpRequest\b/g);
  stats.failureBranches += count(source, /\bcatch\s*\(|\.catch\s*\(|\.onerror\s*=|\.ontimeout\s*=|\.onabort\s*=/g);
  stats.dynamicControls += count(source, /createElement\s*\(\s*["'](?:button|a)["']/g);
  if (rel !== 'public/shared/js/activityApi.js' && /fetch\s*\(\s*["'`]\/activity\/add/.test(source)) {
    failures.push(`${rel}: activity endpoint must only be called by activityApi.js`);
  }
}

const nextLayout = fs.readFileSync(path.join(root, 'web/app/layout.tsx'), 'utf8');
const nextConfig = fs.readFileSync(path.join(root, 'web/next.config.ts'), 'utf8');
for (const script of ['activityApi.js', 'activityLogger.js', 'trackedFetch.js', 'activityAutoTracker.js']) {
  if (!nextLayout.includes(script)) failures.push(`web/app/layout.tsx: missing ${script}`);
  if (!nextConfig.includes(script)) failures.push(`web/next.config.ts: missing rewrite for ${script}`);
}
if (!nextConfig.includes('/activity/:path*')) failures.push('web/next.config.ts: missing activity API rewrite');

console.log('Activity coverage audit');
console.log(JSON.stringify(stats, null, 2));
if (failures.length) {
  console.error('\nCoverage failures:');
  failures.forEach(failure => console.error('- ' + failure));
  process.exitCode = 1;
} else {
  console.log('\nPASS: every end-user entry point loads lifecycle/control/API/error tracking; admin is excluded.');
}

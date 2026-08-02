#!/usr/bin/env node
/**
 * Fails if a release build carries demo-mode code.
 *
 * Demo mode is gated on `__DEMO_MODE_AVAILABLE__`, which the bundler folds to
 * `false` for `wxt build`, dropping the Options "Developer" section, the toggle,
 * and mockClient.ts. That elimination is easy to break by accident — a stray
 * top-level side effect in mockClient.ts is enough to pin the whole file back
 * into the output — so the shipped artifact is checked directly.
 *
 * Usage: node utils/checkReleaseBuild.mjs build/chrome-mv3 [more dirs...]
 */
import fs from 'node:fs';
import path from 'node:path';

/** Strings that must never appear in a release build, and what each implies. */
const FORBIDDEN = [
  ['checkbox-mock-mode', 'the Options demo-mode toggle'],
  ['Enable Demo mode to explore', 'the Options "Developer" section'],
  ['Demo mode', 'demo-mode UI copy'],
  ['no real iCloud data', 'the demo-mode banner'],
  ['MockPremiumMailSettings', 'the mock iCloud service'],
  ['privaterelay.appleid.com', 'mock alias fixtures'],
  ['__DEMO_MODE_AVAILABLE__', 'an unsubstituted build flag'],
];

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });

const SCANNED_EXTENSIONS = new Set(['.js', '.mjs', '.html', '.css', '.json']);

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error('usage: node utils/checkReleaseBuild.mjs <build-dir>...');
  process.exit(2);
}

let failed = false;

for (const target of targets) {
  if (!fs.existsSync(target)) {
    console.error(`✗ ${target}: not found`);
    failed = true;
    continue;
  }

  const findings = [];
  for (const file of walk(target)) {
    if (!SCANNED_EXTENSIONS.has(path.extname(file))) continue;
    const contents = fs.readFileSync(file, 'utf8');
    for (const [needle, description] of FORBIDDEN) {
      if (contents.includes(needle)) {
        findings.push(
          `${path.relative(target, file)} contains "${needle}" (${description})`
        );
      }
    }
  }

  if (findings.length > 0) {
    console.error(`✗ ${target}: demo-mode code present in a release build`);
    for (const finding of findings) {
      console.error(`    ${finding}`);
    }
    failed = true;
  } else {
    console.log(`✓ ${target}: no demo-mode code`);
  }
}

process.exit(failed ? 1 : 0);

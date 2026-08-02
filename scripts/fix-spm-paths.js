#!/usr/bin/env node
'use strict';
/**
 * cap sync regenerates ios/App/CapApp-SPM/Package.swift on every run. When
 * that sync runs on Windows, the CLI writes OS-native backslash paths into
 * the .package(path: "...") entries, which Swift Package Manager cannot
 * resolve on macOS/Linux. Forward slashes are valid on every OS, so
 * normalize them in place after every sync - a no-op when sync already
 * produced forward slashes (e.g. run on Mac).
 *
 * Wired up as the "capacitor:sync:after" npm script, which the Capacitor
 * CLI runs automatically at the end of every `cap sync`.
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'ios', 'App', 'CapApp-SPM', 'Package.swift');
if (!fs.existsSync(file)) process.exit(0);

const before = fs.readFileSync(file, 'utf8');
const after = before.replace(
  /(path:\s*")([^"]*)(")/g,
  (match, open, pkgPath, close) => open + pkgPath.replace(/\\/g, '/') + close
);

if (after !== before) {
  fs.writeFileSync(file, after);
  console.log('fix-spm-paths: normalized backslash paths in ios/App/CapApp-SPM/Package.swift');
}

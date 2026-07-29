'use strict';
/**
 * Tests the pure decision logic in www/italy/access-guard.js: which
 * environments/cache-states lead to reveal/redirect/verify, and how the
 * one-per-session background re-check resolves refund/error cases.
 *
 * Zero dependencies - run with: node test/italy-access-guard.test.js
 */
const assert = require('assert');
const path = require('path');

const guardPath = path.join(__dirname, '..', 'www', 'italy', 'access-guard.js');
delete require.cache[require.resolve(guardPath)];
const {
  decideInitialAccess,
  decideAfterVerify,
  shouldRunBackgroundRecheck,
  decideBackgroundRecheckOutcome
} = require(guardPath);

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// ── decideInitialAccess ──────────────────────────────────────────────

test('web, cached unlocked -> reveal (manual testing flag keeps working)', () => {
  assert.strictEqual(decideInitialAccess({ isNative: false, cachedUnlocked: true }), 'reveal');
});

test('web, not cached -> redirect', () => {
  assert.strictEqual(decideInitialAccess({ isNative: false, cachedUnlocked: false }), 'redirect');
});

test('native, cached unlocked -> reveal immediately, no RC round-trip', () => {
  assert.strictEqual(decideInitialAccess({ isNative: true, cachedUnlocked: true }), 'reveal');
});

test('native, cold cache (e.g. reinstall) -> verify with RevenueCat before deciding', () => {
  assert.strictEqual(decideInitialAccess({ isNative: true, cachedUnlocked: false }), 'verify');
});

// ── decideAfterVerify (cache-miss path: no fallback, deny by default) ──

test('verify: entitlement confirmed active -> reveal', () => {
  assert.strictEqual(decideAfterVerify({ entitlementActive: true }), 'reveal');
});

test('verify: entitlement confirmed inactive -> redirect', () => {
  assert.strictEqual(decideAfterVerify({ entitlementActive: false }), 'redirect');
});

test('verify: RC error/timeout (unknown) -> redirect, not stuck', () => {
  assert.strictEqual(decideAfterVerify({ entitlementActive: null }), 'redirect');
});

// ── shouldRunBackgroundRecheck ───────────────────────────────────────

test('background recheck: native + cache hit + not yet checked this session -> run', () => {
  assert.strictEqual(shouldRunBackgroundRecheck({
    isNative: true, cachedUnlocked: true, alreadyCheckedThisSession: false
  }), true);
});

test('background recheck: already ran this session -> do not run again', () => {
  assert.strictEqual(shouldRunBackgroundRecheck({
    isNative: true, cachedUnlocked: true, alreadyCheckedThisSession: true
  }), false);
});

test('background recheck: web -> never run (no RevenueCat there)', () => {
  assert.strictEqual(shouldRunBackgroundRecheck({
    isNative: false, cachedUnlocked: true, alreadyCheckedThisSession: false
  }), false);
});

test('background recheck: native but no cache hit -> nothing to recheck', () => {
  assert.strictEqual(shouldRunBackgroundRecheck({
    isNative: true, cachedUnlocked: false, alreadyCheckedThisSession: false
  }), false);
});

// ── decideBackgroundRecheckOutcome (opposite default from verify) ─────

test('background recheck outcome: confirmed inactive (refund) -> revoke', () => {
  assert.strictEqual(decideBackgroundRecheckOutcome({ entitlementActive: false }), 'revoke');
});

test('background recheck outcome: confirmed active -> keep', () => {
  assert.strictEqual(decideBackgroundRecheckOutcome({ entitlementActive: true }), 'keep');
});

test('background recheck outcome: RC error/timeout (unknown) -> keep, do not kick out mid-game', () => {
  assert.strictEqual(decideBackgroundRecheckOutcome({ entitlementActive: null }), 'keep');
});

// ── Run ──────────────────────────────────────────────────────────────
let failed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`  ok - ${name}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL - ${name}`);
    console.log(`         ${err.message}`);
  }
}
console.log('');
console.log(`${tests.length - failed}/${tests.length} passed`);
if (failed > 0) process.exit(1);

/**
 * Unit tests for soft-sync pure logic functions
 * Run with: node --test src/lib/sync/softSync/logic.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDrift,
  decideSyncMode,
  computePlaybackRate,
  computeSoftSyncDuration,
  createSoftSyncDecision,
  isSoftSyncAllowed,
  DEFAULT_SOFT_SYNC_CONFIG
} from './logic.js';

describe('calculateDrift', () => {
  it('should calculate positive drift when original is ahead', () => {
    const drift = calculateDrift(10.0, 5.0, 0);
    assert.equal(drift, 5.0);
  });

  it('should calculate negative drift when original is behind', () => {
    const drift = calculateDrift(5.0, 10.0, 0);
    assert.equal(drift, -5.0);
  });

  it('should account for time offset', () => {
    const drift = calculateDrift(15.0, 10.0, 3.0);
    // Expected: 10 + 3 = 13, actual: 15, drift = 15 - 13 = 2
    assert.equal(drift, 2.0);
  });

  it('should return zero when perfectly synced', () => {
    const drift = calculateDrift(10.0, 10.0, 0);
    assert.equal(drift, 0);
  });

  it('should handle negative offset', () => {
    const drift = calculateDrift(10.0, 15.0, -5.0);
    // Expected: 15 + (-5) = 10, actual: 10, drift = 0
    assert.equal(drift, 0);
  });
});

describe('decideSyncMode', () => {
  it('should return no-op for drift below threshold', () => {
    const mode = decideSyncMode(0.05);
    assert.equal(mode, 'no-op');
  });

  it('should return no-op for negative drift below threshold', () => {
    const mode = decideSyncMode(-0.09);
    assert.equal(mode, 'no-op');
  });

  it('should return soft-sync for drift at threshold boundary', () => {
    const mode = decideSyncMode(0.10);
    assert.equal(mode, 'soft-sync');
  });

  it('should return soft-sync for drift within range', () => {
    const mode = decideSyncMode(1.0);
    assert.equal(mode, 'soft-sync');
  });

  it('should return soft-sync for drift at max boundary', () => {
    const mode = decideSyncMode(2.0);
    assert.equal(mode, 'soft-sync');
  });

  it('should return hard-sync for drift above max', () => {
    const mode = decideSyncMode(2.1);
    assert.equal(mode, 'hard-sync');
  });

  it('should return hard-sync for large negative drift', () => {
    const mode = decideSyncMode(-3.0);
    assert.equal(mode, 'hard-sync');
  });

  it('should respect custom config', () => {
    const config = {
      noOpThreshold: 0.2,
      softSyncMax: 1.0,
      minPlaybackRate: 0.90,
      maxPlaybackRate: 1.10,
      cooldownMs: 750
    };
    assert.equal(decideSyncMode(0.15, config), 'no-op');
    assert.equal(decideSyncMode(0.5, config), 'soft-sync');
    assert.equal(decideSyncMode(1.5, config), 'hard-sync');
  });
});

describe('computePlaybackRate', () => {
  it('should return rate > 1.0 when original is behind', () => {
    const rate = computePlaybackRate(-1.0);
    assert.ok(rate > 1.0);
    assert.ok(rate <= DEFAULT_SOFT_SYNC_CONFIG.maxPlaybackRate);
  });

  it('should return rate < 1.0 when original is ahead', () => {
    const rate = computePlaybackRate(1.0);
    assert.ok(rate < 1.0);
    assert.ok(rate >= DEFAULT_SOFT_SYNC_CONFIG.minPlaybackRate);
  });

  it('should return higher rate for larger negative drift', () => {
    const rate1 = computePlaybackRate(-0.5);
    const rate2 = computePlaybackRate(-1.5);
    assert.ok(rate2 > rate1);
  });

  it('should return lower rate for larger positive drift', () => {
    const rate1 = computePlaybackRate(0.5);
    const rate2 = computePlaybackRate(1.5);
    assert.ok(rate2 < rate1);
  });

  it('should clamp rate to max bound', () => {
    const rate = computePlaybackRate(-10.0);
    assert.equal(rate, DEFAULT_SOFT_SYNC_CONFIG.maxPlaybackRate);
  });

  it('should clamp rate to min bound', () => {
    const rate = computePlaybackRate(10.0);
    assert.equal(rate, DEFAULT_SOFT_SYNC_CONFIG.minPlaybackRate);
  });

  it('should be stable for same drift', () => {
    const rate1 = computePlaybackRate(1.0);
    const rate2 = computePlaybackRate(1.0);
    assert.equal(rate1, rate2);
  });

  it('should scale linearly within range', () => {
    const rateSmall = computePlaybackRate(-0.1);
    const rateMed = computePlaybackRate(-1.05);
    const rateLarge = computePlaybackRate(-2.0);
    
    // Should show progression
    assert.ok(rateSmall < rateMed);
    assert.ok(rateMed < rateLarge);
    assert.ok(rateLarge <= DEFAULT_SOFT_SYNC_CONFIG.maxPlaybackRate);
  });
});

describe('computeSoftSyncDuration', () => {
  it('should return duration within expected range', () => {
    const duration = computeSoftSyncDuration(1.0);
    assert.ok(duration >= 1200);
    assert.ok(duration <= 2500);
  });

  it('should return longer duration for larger drift', () => {
    const duration1 = computeSoftSyncDuration(0.5);
    const duration2 = computeSoftSyncDuration(1.5);
    assert.ok(duration2 > duration1);
  });

  it('should return same duration for positive and negative drift of same magnitude', () => {
    const duration1 = computeSoftSyncDuration(1.0);
    const duration2 = computeSoftSyncDuration(-1.0);
    assert.equal(duration1, duration2);
  });

  it('should return minimum duration for smallest drift', () => {
    const duration = computeSoftSyncDuration(0.1);
    assert.equal(duration, 1200);
  });

  it('should return maximum duration for largest drift', () => {
    const duration = computeSoftSyncDuration(2.0);
    assert.equal(duration, 2500);
  });
});

describe('createSoftSyncDecision', () => {
  it('should create no-op decision for small drift', () => {
    const decision = createSoftSyncDecision(10.05, 10.0, 0);
    assert.equal(decision.mode, 'no-op');
    assert.ok(Math.abs(decision.drift - 0.05) < 0.001); // Allow for floating point precision
    assert.equal(decision.playbackRate, undefined);
    assert.equal(decision.durationMs, undefined);
  });

  it('should create soft-sync decision with rate and duration', () => {
    const decision = createSoftSyncDecision(11.0, 10.0, 0);
    assert.equal(decision.mode, 'soft-sync');
    assert.equal(decision.drift, 1.0);
    assert.ok(typeof decision.playbackRate === 'number');
    assert.ok(typeof decision.durationMs === 'number');
  });

  it('should create hard-sync decision for large drift', () => {
    const decision = createSoftSyncDecision(13.0, 10.0, 0);
    assert.equal(decision.mode, 'hard-sync');
    assert.equal(decision.drift, 3.0);
    assert.equal(decision.playbackRate, undefined);
    assert.equal(decision.durationMs, undefined);
  });

  it('should account for time offset in drift calculation', () => {
    const decision = createSoftSyncDecision(15.0, 10.0, 3.0);
    // Expected: 10 + 3 = 13, actual: 15, drift = 2
    assert.equal(decision.drift, 2.0);
    assert.equal(decision.mode, 'soft-sync');
  });
});

describe('isSoftSyncAllowed', () => {
  it('should return true when cooldown period has passed', () => {
    const lastSync = 1000;
    const now = 2000;
    const allowed = isSoftSyncAllowed(lastSync, now);
    assert.equal(allowed, true);
  });

  it('should return false when cooldown period has not passed', () => {
    const lastSync = 1000;
    const now = 1500;
    const allowed = isSoftSyncAllowed(lastSync, now);
    assert.equal(allowed, false);
  });

  it('should return true exactly at cooldown boundary', () => {
    const lastSync = 1000;
    const now = 1750; // Exactly 750ms later
    const allowed = isSoftSyncAllowed(lastSync, now);
    assert.equal(allowed, true);
  });

  it('should return true when lastSyncAt is 0', () => {
    const allowed = isSoftSyncAllowed(0, 1000);
    assert.equal(allowed, true);
  });

  it('should respect custom cooldown config', () => {
    const config = {
      noOpThreshold: 0.1,
      softSyncMax: 2.0,
      minPlaybackRate: 0.90,
      maxPlaybackRate: 1.10,
      cooldownMs: 1000
    };
    const lastSync = 1000;
    const now = 1999;
    assert.equal(isSoftSyncAllowed(lastSync, now, config), false);
    assert.equal(isSoftSyncAllowed(lastSync, 2000, config), true);
  });
});

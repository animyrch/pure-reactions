/**
 * Unit Tests for Adaptive Sync Mechanism
 * 
 * Tests drift calculation, decision logic, compensation, and orchestrator
 * with mocked players and storage.
 */

import { test, describe, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Import functions to test
import {
  computeExpectedOriginalTime,
  computeDrift,
  createDriftMeasurement,
  getAbsoluteDrift
} from '../src/lib/sync/drift.js';

import {
  decideSyncStrategy,
  detectCatastrophicWorsening,
  didSyncImprove,
  shouldIgnoreSync,
  THRESHOLDS
} from '../src/lib/sync/decision.js';

import {
  buildStorageKey,
  clampCompensation,
  updateCompensationWithBoundedAverage,
  COMPENSATION_BOUNDS
} from '../src/lib/sync/compensationStore.js';

describe('Drift Calculation', () => {
  test('computeExpectedOriginalTime subtracts offset from reaction time', () => {
    const reactionTime = 10.5;
    const timeOffset = 2.0;
    const expected = computeExpectedOriginalTime(reactionTime, timeOffset);
    
    assert.equal(expected, 8.5);
  });
  
  test('computeDrift returns O - E (positive when ahead)', () => {
    const actual = 10.0;
    const expected = 9.0;
    const drift = computeDrift(actual, expected);
    
    assert.equal(drift, 1.0);
  });
  
  test('computeDrift returns negative when behind', () => {
    const actual = 8.0;
    const expected = 9.0;
    const drift = computeDrift(actual, expected);
    
    assert.equal(drift, -1.0);
  });
  
  test('computeDrift returns zero when in sync', () => {
    const actual = 9.0;
    const expected = 9.0;
    const drift = computeDrift(actual, expected);
    
    assert.equal(drift, 0.0);
  });
  
  test('createDriftMeasurement returns correct structure', () => {
    const actual = 10.5;
    const expected = 10.0;
    const timestamp = Date.now();
    
    const measurement = createDriftMeasurement(actual, expected, timestamp);
    
    assert.equal(measurement.drift, 0.5);
    assert.equal(measurement.actualTime, 10.5);
    assert.equal(measurement.expectedTime, 10.0);
    assert.equal(measurement.timestamp, timestamp);
  });
  
  test('getAbsoluteDrift returns magnitude only', () => {
    assert.equal(getAbsoluteDrift(1.5), 1.5);
    assert.equal(getAbsoluteDrift(-1.5), 1.5);
    assert.equal(getAbsoluteDrift(0), 0);
  });
});

describe('Decision Logic - Ignore Threshold', () => {
  test('shouldIgnoreSync returns true for drift below 0.10s', () => {
    assert.equal(shouldIgnoreSync(0.05), true);
    assert.equal(shouldIgnoreSync(-0.05), true);
    assert.equal(shouldIgnoreSync(0.09), true);
  });
  
  test('shouldIgnoreSync returns false for drift at or above 0.10s', () => {
    assert.equal(shouldIgnoreSync(0.10), false);
    assert.equal(shouldIgnoreSync(-0.10), false);
    assert.equal(shouldIgnoreSync(0.15), false);
    assert.equal(shouldIgnoreSync(1.0), false);
  });
});

describe('Decision Logic - Sync Strategy', () => {
  test('decideSyncStrategy returns ignore for drift < 0.10s', () => {
    const decision = decideSyncStrategy(0.05);
    
    assert.equal(decision.strategy, 'ignore');
    assert.equal(decision.shouldSync, false);
    assert.match(decision.reason, /below ignore threshold/i);
  });
  
  test('decideSyncStrategy returns soft for drift >= 0.10s and < 0.30s', () => {
    const decision = decideSyncStrategy(0.20);
    
    assert.equal(decision.strategy, 'soft');
    assert.equal(decision.shouldSync, true);
  });
  
  test('decideSyncStrategy returns hard for drift >= 0.30s', () => {
    const decision = decideSyncStrategy(0.50);
    
    assert.equal(decision.strategy, 'hard');
    assert.equal(decision.shouldSync, true);
    assert.match(decision.reason, /hard seek/i);
  });
  
  test('decideSyncStrategy handles negative drift correctly', () => {
    const decision = decideSyncStrategy(-0.40);
    
    assert.equal(decision.strategy, 'hard');
    assert.equal(decision.shouldSync, true);
  });
});

describe('Decision Logic - Outcome Detection', () => {
  test('didSyncImprove returns true when final drift is smaller', () => {
    const initial = createDriftMeasurement(10.0, 8.0); // drift = 2.0
    const final = createDriftMeasurement(9.0, 8.0);    // drift = 1.0
    
    assert.equal(didSyncImprove(initial, final), true);
  });
  
  test('didSyncImprove returns false when final drift is larger', () => {
    const initial = createDriftMeasurement(10.0, 8.0); // drift = 2.0
    const final = createDriftMeasurement(11.0, 8.0);   // drift = 3.0
    
    assert.equal(didSyncImprove(initial, final), false);
  });
  
  test('detectCatastrophicWorsening returns false for small increase', () => {
    const initial = createDriftMeasurement(10.0, 8.0); // drift = 2.0
    const final = createDriftMeasurement(10.3, 8.0);   // drift = 2.3 (increase = 0.3)
    
    assert.equal(detectCatastrophicWorsening(initial, final), false);
  });
  
  test('detectCatastrophicWorsening returns true for large increase', () => {
    const initial = createDriftMeasurement(10.0, 8.0); // drift = 2.0
    const final = createDriftMeasurement(11.0, 8.0);   // drift = 3.0 (increase = 1.0 > 0.50)
    
    assert.equal(detectCatastrophicWorsening(initial, final), true);
  });
  
  test('detectCatastrophicWorsening handles negative drift correctly', () => {
    const initial = createDriftMeasurement(6.0, 8.0);  // drift = -2.0
    const final = createDriftMeasurement(5.0, 8.0);    // drift = -3.0 (abs increase = 1.0)
    
    assert.equal(detectCatastrophicWorsening(initial, final), true);
  });
});

describe('Compensation Store - Storage Key', () => {
  test('buildStorageKey creates deterministic key', () => {
    const profile = {
      playerType: 'youtube',
      deviceClass: 'desktop'
    };
    
    const key1 = buildStorageKey(profile);
    const key2 = buildStorageKey(profile);
    
    assert.equal(key1, key2);
    assert.match(key1, /pr_sync_compensation/);
    assert.match(key1, /youtube/);
    assert.match(key1, /desktop/);
  });
  
  test('buildStorageKey includes browser if provided', () => {
    const profile = {
      playerType: 'youtube',
      deviceClass: 'mobile',
      browser: 'safari'
    };
    
    const key = buildStorageKey(profile);
    
    assert.match(key, /safari/);
  });
  
  test('buildStorageKey creates different keys for different profiles', () => {
    const desktop = buildStorageKey({
      playerType: 'youtube',
      deviceClass: 'desktop'
    });
    
    const mobile = buildStorageKey({
      playerType: 'youtube',
      deviceClass: 'mobile'
    });
    
    assert.notEqual(desktop, mobile);
  });
});

describe('Compensation Store - Clamping', () => {
  test('clampCompensation respects MIN bound', () => {
    assert.equal(
      clampCompensation(-5.0),
      COMPENSATION_BOUNDS.MIN
    );
  });
  
  test('clampCompensation respects MAX bound', () => {
    assert.equal(
      clampCompensation(5.0),
      COMPENSATION_BOUNDS.MAX
    );
  });
  
  test('clampCompensation allows values within bounds', () => {
    assert.equal(clampCompensation(1.0), 1.0);
    assert.equal(clampCompensation(-1.0), -1.0);
    assert.equal(clampCompensation(0), 0);
  });
  
  test('clampCompensation bounds are ±2s as per spec', () => {
    assert.equal(COMPENSATION_BOUNDS.MIN, -2.0);
    assert.equal(COMPENSATION_BOUNDS.MAX, 2.0);
  });
});

describe('Compensation Store - Moving Average', () => {
  test('updateCompensationWithBoundedAverage updates offset', () => {
    const current = {
      offset: 0.0,
      sampleCount: 0,
      lastUpdated: Date.now()
    };
    
    const updated = updateCompensationWithBoundedAverage(current, 0.5);
    
    assert.ok(updated.offset > 0);
    assert.ok(updated.offset < 0.5);
    assert.equal(updated.sampleCount, 1);
  });
  
  test('updateCompensationWithBoundedAverage ignores noise', () => {
    const current = {
      offset: 0.0,
      sampleCount: 5,
      lastUpdated: Date.now()
    };
    
    // Drift below noise threshold (0.05) should be ignored
    const updated = updateCompensationWithBoundedAverage(current, 0.04);
    
    assert.equal(updated.offset, 0.0);
    assert.equal(updated.sampleCount, 5);
  });
  
  test('updateCompensationWithBoundedAverage converges gradually', () => {
    let current = {
      offset: 0.0,
      sampleCount: 0,
      lastUpdated: Date.now()
    };
    
    // Apply same drift multiple times
    for (let i = 0; i < 10; i++) {
      current = updateCompensationWithBoundedAverage(current, 1.0);
    }
    
    // Should converge toward 1.0 but not immediately
    assert.ok(current.offset > 0.5);
    assert.ok(current.offset < 1.0);
    assert.equal(current.sampleCount, 10);
  });
  
  test('updateCompensationWithBoundedAverage clamps result', () => {
    const current = {
      offset: 1.8,
      sampleCount: 10,
      lastUpdated: Date.now()
    };
    
    // Large drift that would push over bound
    const updated = updateCompensationWithBoundedAverage(current, 5.0);
    
    assert.ok(updated.offset <= COMPENSATION_BOUNDS.MAX);
  });
});

describe('Compensation Store - localStorage (mocked)', () => {
  let mockStorage = {};
  
  beforeEach(() => {
    mockStorage = {};
    
    // Mock localStorage
    global.window = {
      localStorage: {
        getItem: (key) => mockStorage[key] || null,
        setItem: (key, value) => {
          mockStorage[key] = value;
        }
      }
    };
  });
  
  test('loadCompensation returns default when no data stored', async () => {
    const { loadCompensation } = await import('../src/lib/sync/compensationStore.js');
    
    const profile = {
      playerType: 'youtube',
      deviceClass: 'desktop'
    };
    
    const data = loadCompensation(profile);
    
    assert.equal(data.offset, 0);
    assert.equal(data.sampleCount, 0);
  });
  
  test('saveCompensation and loadCompensation round-trip', async () => {
    const { loadCompensation, saveCompensation } = await import('../src/lib/sync/compensationStore.js');
    
    const profile = {
      playerType: 'youtube',
      deviceClass: 'mobile'
    };
    
    const toSave = {
      offset: 1.5,
      sampleCount: 10,
      lastUpdated: Date.now()
    };
    
    saveCompensation(profile, toSave);
    const loaded = loadCompensation(profile);
    
    assert.equal(loaded.offset, 1.5);
    assert.equal(loaded.sampleCount, 10);
  });
  
  test('saveCompensation clamps values before storing', async () => {
    const { loadCompensation, saveCompensation } = await import('../src/lib/sync/compensationStore.js');
    
    const profile = {
      playerType: 'youtube',
      deviceClass: 'desktop'
    };
    
    const toSave = {
      offset: 10.0, // Way over bound
      sampleCount: 5,
      lastUpdated: Date.now()
    };
    
    saveCompensation(profile, toSave);
    const loaded = loadCompensation(profile);
    
    assert.equal(loaded.offset, COMPENSATION_BOUNDS.MAX);
  });
});

describe('Thresholds - Constants', () => {
  test('THRESHOLDS.IGNORE is 0.10s as per spec', () => {
    assert.equal(THRESHOLDS.IGNORE, 0.10);
  });
  
  test('THRESHOLDS.CATASTROPHIC is defined', () => {
    assert.ok(THRESHOLDS.CATASTROPHIC > 0);
  });
});

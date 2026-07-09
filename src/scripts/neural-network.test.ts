import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getEffectiveNodeCount } from './neural-network';

test('caps neural node count on mobile-sized canvases', () => {
  assert.equal(getEffectiveNodeCount(390, 48), 20);
});

test('keeps configured neural node count on desktop-sized canvases', () => {
  assert.equal(getEffectiveNodeCount(1200, 48), 48);
});

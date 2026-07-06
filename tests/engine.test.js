import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createEngine } from '../src/lib/engine/generator.js';
import { analyze } from '../src/lib/engine/analyzer.js';
import { vet } from '../src/lib/engine/vetting.js';
import { resolveConfig, POOLS } from '../src/lib/engine/config.js';

const draws = JSON.parse(fs.readFileSync(new URL('../static/draws.json', import.meta.url), 'utf8'));
const veto = resolveConfig().veto;

test('draws.json is valid modern-era data', () => {
  assert.ok(draws.length > 1000);
  for (const d of draws) {
    const regs = d.slice(1, 6);
    assert.equal(new Set(regs).size, 5, `duplicate regulars on ${d[0]}`);
    regs.forEach((r) => assert.ok(r >= 1 && r <= 69, `bad regular ${r} on ${d[0]}`));
    assert.ok(d[6] >= 1 && d[6] <= 26, `bad powerball ${d[6]} on ${d[0]}`);
  }
});

test('weights stay bounded for every strategy', () => {
  for (const weighting of ['uniform', 'linear', 'exponential', 'recency', 'logarithmic']) {
    const analysis = analyze(draws, resolveConfig({ weighting }));
    for (const { value, weight } of analysis.regularDistribution) {
      assert.ok(Number.isFinite(weight) && weight >= 0, `${weighting}: weight for ${value} is ${weight}`);
    }
    // Total weighted mass must be spread out, not concentrated on a few
    // recent draws (the old 1.1^n exponential collapsed onto the tail).
    const weights = analysis.regularDistribution.map((d) => d.weight).sort((a, b) => b - a);
    const total = weights.reduce((a, b) => a + b, 0);
    const top5 = weights.slice(0, 5).reduce((a, b) => a + b, 0);
    assert.ok(top5 / total < 0.5, `${weighting}: top 5 numbers hold ${(top5 / total) * 100}% of mass`);
  }
});

test('generateSet returns valid, vetted sets', () => {
  const engine = createEngine(draws);
  for (let i = 0; i < 50; i++) {
    const s = engine.generateSet();
    assert.equal(s.regular_balls.length, 5);
    assert.equal(new Set(s.regular_balls).size, 5);
    s.regular_balls.forEach((n) => assert.ok(n >= POOLS.regular.min && n <= POOLS.regular.max));
    assert.ok(s.powerball >= POOLS.powerball.min && s.powerball <= POOLS.powerball.max);
    assert.deepEqual(s.regular_balls, [...s.regular_balls].sort((a, b) => a - b));
    assert.equal(vet(s, veto).isVetoed, false);
  }
});

test('generateSets honors batch diversity constraints', () => {
  const engine = createEngine(draws);
  const sets = engine.generateSets(5);
  assert.equal(sets.length, 5);
  const usage = new Map();
  for (let i = 0; i < sets.length; i++) {
    sets[i].regular_balls.forEach((n) => usage.set(n, (usage.get(n) || 0) + 1));
    for (let j = i + 1; j < sets.length; j++) {
      const shared = sets[i].regular_balls.filter((n) => sets[j].regular_balls.includes(n)).length;
      assert.ok(shared <= 2, `sets ${i} and ${j} share ${shared} numbers`);
    }
  }
  for (const [n, c] of usage) assert.ok(c <= 2, `number ${n} used ${c} times`);
});

test('single ball and powerball generation', () => {
  const engine = createEngine(draws);
  for (let i = 0; i < 100; i++) {
    const b = engine.generateBall();
    assert.ok(b >= 1 && b <= 69);
    const pb = engine.generatePowerball();
    assert.ok(pb >= 1 && pb <= 26);
  }
  // exclusion is respected
  const exclude = [1, 2, 3, 4, 5, 10, 20, 30];
  for (let i = 0; i < 50; i++) {
    assert.ok(!exclude.includes(engine.generateBall(exclude)));
  }
});

test('veto rules fire on pathological sets', () => {
  const cases = [
    [{ regular_balls: [1, 2, 3, 4, 5], powerball: 10 }, /consecutive|sum/],
    [{ regular_balls: [10, 20, 30, 40, 50], powerball: 10 }, /ending in|progression/],
    [{ regular_balls: [60, 62, 64, 66, 68], powerball: 10 }, /sum|decade|divisible/],
    [{ regular_balls: [7, 14, 28, 35, 63], powerball: 10 }, /divisible/],
  ];
  for (const [set, pattern] of cases) {
    const result = vet(set, veto);
    assert.equal(result.isVetoed, true, `expected veto: ${set.regular_balls}`);
    assert.match(result.reason, pattern);
  }
  assert.equal(vet({ regular_balls: [3, 17, 24, 46, 61], powerball: 12 }, veto).isVetoed, false);
});

test('a 100-set batch completes quickly (analysis is not re-run per attempt)', () => {
  const engine = createEngine(draws, { batch: { maxOverlap: 4, maxPerNumberUsage: 20 } });
  const start = performance.now();
  const sets = engine.generateSets(100);
  const ms = performance.now() - start;
  assert.equal(sets.length, 100);
  assert.ok(ms < 2000, `took ${ms}ms`);
});

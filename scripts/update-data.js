// Rebuilds data.csv and static/draws.json from the official NY Open Data
// Powerball dataset (https://data.ny.gov/d/d6yy-54nr). Replaces the old
// puppeteer scraper, which mixed Double Play draws into the main-draw data
// and stopped capturing regular balls in May 2025.
//
// Usage:
//   node scripts/update-data.js            # fetch live data and rebuild
//   node scripts/update-data.js --check    # validate existing data.csv only
//
// Rows before NY coverage (Feb 3, 2010) are preserved from the existing
// data.csv as unverified legacy history; everything from Feb 2010 onward is
// replaced with the official main-draw record.

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_CSV = path.join(ROOT, 'data.csv');
const DRAWS_JSON = path.join(ROOT, 'static', 'draws.json');
const NY_URL = 'https://data.ny.gov/api/views/d6yy-54nr/rows.csv?accessType=DOWNLOAD';
const NY_COVERAGE_START = Date.UTC(2010, 1, 3);

// Official Powerball matrix changes: [startDate, regMax, pbMax]
const ERAS = [
  [Date.UTC(1992, 3, 22), 45, 45],
  [Date.UTC(1997, 10, 5), 49, 42],
  [Date.UTC(2002, 9, 9), 53, 42],
  [Date.UTC(2005, 7, 31), 55, 42],
  [Date.UTC(2009, 0, 7), 59, 39],
  [Date.UTC(2012, 0, 15), 59, 35],
  [Date.UTC(2015, 9, 7), 69, 26],
];
export const MODERN_ERA_START = ERAS[ERAS.length - 1][0];

export function eraFor(utcMs) {
  let era = ERAS[0];
  for (const e of ERAS) {
    if (utcMs >= e[0]) era = e;
  }
  return { regMax: era[1], pbMax: era[2] };
}

function toUtc(dateString) {
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return null;
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

function displayDate(utcMs) {
  return new Date(utcMs).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });
}

export function validateRow(row, { strict }) {
  const errors = [];
  const { regs, pb, utcMs } = row;
  const { regMax, pbMax } = eraFor(utcMs);
  if (regs.length !== 5) errors.push(`expected 5 regular balls, got ${regs.length}`);
  if (new Set(regs).size !== regs.length) errors.push('duplicate regular balls');
  for (const r of regs) {
    if (!Number.isInteger(r) || r < 1 || r > regMax) errors.push(`regular ball ${r} outside 1-${regMax}`);
  }
  if (!Number.isInteger(pb) || pb < 1 || pb > pbMax) errors.push(`powerball ${pb} outside 1-${pbMax}`);
  // Legacy pre-2010 rows can't be verified against NY data; only report
  // structural problems for them when strict.
  return strict ? errors : errors.filter((e) => !e.includes('outside'));
}

function parseExistingLegacy(csvText) {
  const rows = parse(csvText, { columns: true, skip_empty_lines: true });
  const legacy = [];
  const seen = new Set();
  for (const r of rows) {
    const utcMs = toUtc(r.date);
    if (utcMs === null || utcMs >= NY_COVERAGE_START) continue;
    if (seen.has(utcMs)) continue;
    seen.add(utcMs);
    const regs = (r.regularBalls || '')
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
    const pb = parseInt(r.powerball, 10);
    legacy.push({ utcMs, regs, pb });
  }
  return legacy;
}

function parseNyCsv(csvText) {
  const rows = parse(csvText, { columns: true, skip_empty_lines: true });
  const out = [];
  const seen = new Set();
  for (const r of rows) {
    const utcMs = toUtc(r['Draw Date']);
    if (utcMs === null) throw new Error(`NY row has bad date: ${r['Draw Date']}`);
    if (seen.has(utcMs)) throw new Error(`NY dataset has duplicate date: ${r['Draw Date']}`);
    seen.add(utcMs);
    const nums = (r['Winning Numbers'] || '').trim().split(/\s+/).map(Number);
    if (nums.length !== 6 || nums.some(isNaN)) {
      throw new Error(`NY row has bad numbers on ${r['Draw Date']}: "${r['Winning Numbers']}"`);
    }
    out.push({ utcMs, regs: nums.slice(0, 5).sort((a, b) => a - b), pb: nums[5] });
  }
  return out;
}

function toCsv(rows) {
  const header = 'date,regularBalls,powerball,mainNumberPool,powerballPool';
  const lines = rows.map((r) => {
    const { regMax, pbMax } = eraFor(r.utcMs);
    return `"${displayDate(r.utcMs)}","${r.regs.join(',')}",${r.pb},1 to ${regMax},1 to ${pbMax}`;
  });
  return [header, ...lines].join('\n') + '\n';
}

export function validateAll(rows) {
  const problems = [];
  let prev = -Infinity;
  const seen = new Set();
  for (const row of rows) {
    if (seen.has(row.utcMs)) problems.push(`${displayDate(row.utcMs)}: duplicate date`);
    seen.add(row.utcMs);
    if (row.utcMs < prev) problems.push(`${displayDate(row.utcMs)}: out of chronological order`);
    prev = row.utcMs;
    const strict = row.utcMs >= NY_COVERAGE_START;
    for (const e of validateRow(row, { strict })) {
      problems.push(`${displayDate(row.utcMs)}: ${e}`);
    }
  }
  return problems;
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const existing = await fs.readFile(DATA_CSV, 'utf8');

  if (checkOnly) {
    const rows = parse(existing, { columns: true, skip_empty_lines: true }).map((r) => ({
      utcMs: toUtc(r.date),
      regs: (r.regularBalls || '').split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n)),
      pb: parseInt(r.powerball, 10),
    }));
    const problems = validateAll(rows);
    console.log(`Checked ${rows.length} rows: ${problems.length} problem(s)`);
    problems.slice(0, 20).forEach((p) => console.log('  -', p));
    process.exit(problems.length ? 1 : 0);
  }

  console.log('Fetching official Powerball history from data.ny.gov ...');
  const res = await fetch(NY_URL);
  if (!res.ok) throw new Error(`NY data fetch failed: ${res.status} ${res.statusText}`);
  const nyRows = parseNyCsv(await res.text());

  const legacy = parseExistingLegacy(existing);
  const all = [...legacy, ...nyRows].sort((a, b) => a.utcMs - b.utcMs);

  const problems = validateAll(all);
  if (problems.length) {
    console.error(`Validation failed with ${problems.length} problem(s):`);
    problems.slice(0, 20).forEach((p) => console.error('  -', p));
    process.exit(1);
  }

  await fs.writeFile(DATA_CSV, toCsv(all));

  // Compact modern-era file for the client-side engine: [isoDate, r1..r5, pb]
  const modern = all
    .filter((r) => r.utcMs >= MODERN_ERA_START)
    .map((r) => [new Date(r.utcMs).toISOString().slice(0, 10), ...r.regs, r.pb]);
  await fs.mkdir(path.dirname(DRAWS_JSON), { recursive: true });
  await fs.writeFile(DRAWS_JSON, JSON.stringify(modern));

  console.log(`Wrote ${all.length} rows to data.csv (${legacy.length} legacy + ${nyRows.length} confirmed).`);
  console.log(`Wrote ${modern.length} modern-era draws to static/draws.json.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

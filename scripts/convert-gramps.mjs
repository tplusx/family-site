#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const NODE_WIDTH = 180;
const COLUMN_GAP = 70;
const ROW_GAP = 145;
const START_X = 40;
const START_Y = 45;

export function parseGrampsExport(contents) {
  const trimmed = contents.trim();
  if (!trimmed) return [];

  // Gramps Web currently emits one JSON object per line. Accept a JSON array too,
  // which makes the converter useful with other Gramps export pipelines.
  if (trimmed.startsWith('[')) {
    const records = JSON.parse(trimmed);
    if (!Array.isArray(records)) throw new TypeError('Expected a JSON array');
    return records;
  }

  return trimmed.split(/\r?\n/).filter(Boolean).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new SyntaxError(`Invalid JSON on line ${index + 1}: ${error.message}`);
    }
  });
}

function displayName(person) {
  const name = person.primary_name ?? {};
  const surnames = (name.surname_list ?? []).map(({ prefix = '', surname = '' }) =>
    [prefix, surname].filter(Boolean).join(' '));
  return [name.title, name.first_name, ...surnames, name.suffix]
    .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || person.gramps_id || 'Unknown';
}

function eventFor(person, index, events) {
  if (!Number.isInteger(index) || index < 0) return undefined;
  const reference = person.event_ref_list?.[index]?.ref;
  return reference ? events.get(reference) : undefined;
}

function eventYear(event) {
  const year = event?.date?.dateval?.[2];
  return Number.isInteger(year) && year > 0 ? year : undefined;
}

function publicId(person) {
  // Gramps IDs survive ordinary exports and are more readable than handles.
  return String(person.gramps_id || person.handle);
}

function generationOf(handle, parentsByChild, cache, visiting = new Set()) {
  if (cache.has(handle)) return cache.get(handle);
  if (visiting.has(handle)) return 0;
  visiting.add(handle);
  const parents = parentsByChild.get(handle) ?? [];
  const generation = parents.length
    ? Math.max(...parents.map((parent) => generationOf(parent, parentsByChild, cache, visiting))) + 1
    : 0;
  visiting.delete(handle);
  cache.set(handle, generation);
  return generation;
}

export function convertGramps(records, options = {}) {
  const includePrivate = options.includePrivate ?? false;
  const people = records.filter((record) => record?._class === 'Person' && (includePrivate || !record.private));
  const allowedHandles = new Set(people.map(({ handle }) => handle));
  const events = new Map(records.filter((record) => record?._class === 'Event')
    .filter((event) => includePrivate || !event.private).map((event) => [event.handle, event]));
  const families = records.filter((record) => record?._class === 'Family' && (includePrivate || !record.private));

  const parentsByChild = new Map();
  for (const family of families) {
    const parents = [family.father_handle, family.mother_handle].filter((handle) => allowedHandles.has(handle));
    for (const child of family.child_ref_list ?? []) {
      if (allowedHandles.has(child.ref)) parentsByChild.set(child.ref, parents);
    }
  }

  const generationCache = new Map();
  const rows = new Map();
  for (const person of people) {
    const generation = generationOf(person.handle, parentsByChild, generationCache);
    const row = rows.get(generation) ?? [];
    row.push(person);
    rows.set(generation, row);
  }

  const positions = new Map();
  for (const [generation, row] of [...rows].sort(([a], [b]) => a - b)) {
    row.sort((a, b) => displayName(a).localeCompare(displayName(b)));
    row.forEach((person, column) => positions.set(person.handle, {
      x: START_X + column * (NODE_WIDTH + COLUMN_GAP),
      y: START_Y + generation * ROW_GAP,
    }));
  }

  return people.map((person) => {
    const birth = eventYear(eventFor(person, person.birth_ref_index, events));
    const death = eventYear(eventFor(person, person.death_ref_index, events));
    const years = birth || death ? `${birth ?? '?'}–${death ?? ''}` : 'Dates unknown';
    const parentIds = (parentsByChild.get(person.handle) ?? [])
      .map((handle) => publicId(people.find((candidate) => candidate.handle === handle)));
    return {
      id: publicId(person),
      name: displayName(person),
      years,
      relation: 'Family member',
      ...positions.get(person.handle),
      parentIds,
      summary: 'Profile details are preserved in the family archive.',
    };
  });
}

function usage() {
  return 'Usage: npm run convert:gramps -- <input.json> [output.json] [--include-private]';
}

async function main(args) {
  const includePrivate = args.includes('--include-private');
  const paths = args.filter((arg) => !arg.startsWith('--'));
  if (!paths[0] || args.includes('--help')) {
    console.log(usage());
    return paths[0] ? 0 : 1;
  }
  const output = paths[1] ?? 'src/data/people.json';
  const records = parseGrampsExport(await readFile(paths[0], 'utf8'));
  const converted = convertGramps(records, { includePrivate });
  await writeFile(output, `${JSON.stringify(converted, null, 2)}\n`);
  console.log(`Converted ${converted.length} public people to ${output}`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2));
}

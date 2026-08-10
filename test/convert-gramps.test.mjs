import assert from 'node:assert/strict';
import test from 'node:test';

import { convertGramps, parseGrampsExport } from '../scripts/convert-gramps.mjs';

const date = (year) => ({ date: { dateval: [0, 0, year, false] } });
const name = (first, surname) => ({ first_name: first, surname_list: [{ surname }] });

test('parses Gramps Web newline-delimited JSON and JSON arrays', () => {
  const records = [{ _class: 'Person', handle: 'one' }, { _class: 'Family', handle: 'two' }];
  assert.deepEqual(parseGrampsExport(records.map(JSON.stringify).join('\n')), records);
  assert.deepEqual(parseGrampsExport(JSON.stringify(records)), records);
});

test('maps names, dates, parent links, layout, and privacy to the public schema', () => {
  const records = [
    { _class: 'Event', handle: 'birth', private: false, ...date(1950) },
    { _class: 'Person', handle: 'parent', gramps_id: 'I1', private: false, primary_name: name('Ada', 'Lovelace'), event_ref_list: [{ ref: 'birth' }], birth_ref_index: 0, death_ref_index: -1 },
    { _class: 'Person', handle: 'child', gramps_id: 'I2', private: false, primary_name: name('Byron', 'Lovelace'), event_ref_list: [], birth_ref_index: -1, death_ref_index: -1 },
    { _class: 'Person', handle: 'secret', gramps_id: 'I3', private: true, primary_name: name('Private', 'Person') },
    { _class: 'Family', handle: 'family', private: false, father_handle: 'parent', mother_handle: '', child_ref_list: [{ ref: 'child' }] },
  ];

  const result = convertGramps(records);
  assert.equal(result.length, 2);
  assert.deepEqual(result[0], {
    id: 'I1', name: 'Ada Lovelace', years: '1950–', relation: 'Family member',
    x: 40, y: 45, parentIds: [], summary: 'Profile details are preserved in the family archive.',
  });
  assert.equal(result[1].y, 190);
  assert.deepEqual(result[1].parentIds, ['I1']);
});

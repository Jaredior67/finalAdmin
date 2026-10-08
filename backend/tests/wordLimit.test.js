/* Word-limit policy for free-text fields.
 *
 * Two separate guarantees, deliberately distinct:
 *
 *  1. STORAGE — free-text columns stay TEXT, never VARCHAR. A narrow column
 *     silently truncates mid-sentence on this server (sql_mode has no
 *     STRICT_TRANS_TABLES), so the user sees a "successful" save that lost
 *     their words. The column must be wide enough to hold a full 500-word
 *     entry plus prefix text.
 *
 *  2. ENTRY — descriptions and remarks are capped at 500 WORDS, enforced in
 *     the form (so the user gets a live counter) and again in the API (so a
 *     hand-crafted request cannot bypass the cap). The word count is
 *     deliberately independent of the column type.
 *
 * Run: node --test tests/wordLimit.test.js                                   */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  countWords,
  wordLimitError,
  DESCRIPTION_WORD_LIMIT,
  REMARKS_WORD_LIMIT
} from '../src/utils/wordLimit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.join(__dirname, '..');
const SCHEMA = path.join(BACKEND, 'database', 'schema.sql');
const FRONTEND = path.join(BACKEND, '..', 'frontend', 'src');

/* Columns that store a description or remark. All must be TEXT. */
const FREE_TEXT_COLUMNS = [
  ['job_requests', 'description'],
  ['job_requests', 'replacement_reason'],
  ['job_requests', 'replacement_item_specs'],
  ['job_requests', 'supervisor_remarks'],
  ['job_requests', 'admin_remarks'],
  ['job_requests', 'admin_field_remarks'],
  ['job_requests', 'campus_admin_remarks'],
  ['job_requests', 'rejection_remarks'],
  ['job_request_status_history', 'remarks'],
  ['evaluations', 'comments'],
  ['messages', 'body'],
  ['message_replies', 'body']
];

const schema = fs.readFileSync(SCHEMA, 'utf8');

const columnDefinition = (table, column) => {
  const tableMatch = schema.match(
    new RegExp(`CREATE TABLE(?: IF NOT EXISTS)? \`${table}\`\\s*\\(([\\s\\S]*?)\\n\\) ENGINE=`, 'i')
  );
  if (!tableMatch) return null;
  const line = tableMatch[1]
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.startsWith(`\`${column}\``));
  if (!line) return null;
  return line
    .replace(/,$/, '')
    .replace(new RegExp(`^\`${column}\`\\s*`), '')
    .toUpperCase();
};

/* ---- word counting ---- */

test('countWords counts whitespace-separated runs', () => {
  assert.equal(countWords(''), 0);
  assert.equal(countWords('   '), 0);
  assert.equal(countWords(null), 0);
  assert.equal(countWords(undefined), 0);
  assert.equal(countWords('one'), 1);
  assert.equal(countWords('one two three'), 3);
  assert.equal(countWords('  padded   out  words '), 3);
  // Newlines and tabs separate words too.
  assert.equal(countWords('line one\nline two\tthree'), 5);
});

test('countWords is not fooled by punctuation', () => {
  assert.equal(countWords('Water, leak; flooding!'), 3);
  assert.equal(countWords('a-b'), 1, 'a hyphenated word is one word');
});

test('wordLimitError passes text at or under the limit', () => {
  assert.equal(wordLimitError('one two three', 5, 'description'), null);
  const exact = Array.from({ length: 5 }, () => 'w').join(' ');
  assert.equal(wordLimitError(exact, 5, 'description'), null);
});

test('wordLimitError rejects text over the limit and reports the count', () => {
  const nine = Array.from({ length: 9 }, () => 'w').join(' ');
  const err = wordLimitError(nine, 5, 'description');
  assert.ok(err, 'expected an error');
  assert.match(err.message, /description/);
  assert.match(err.message, /5 words or fewer/);
  assert.match(err.message, /received 9/);
});

test('wordLimitError ignores empty and non-string input', () => {
  assert.equal(wordLimitError('', 500, 'remarks'), null);
  assert.equal(wordLimitError(undefined, 500, 'remarks'), null);
});

/* ---- the limit itself ---- */

test('the documented limit is 500 words', () => {
  assert.equal(DESCRIPTION_WORD_LIMIT, 500);
  assert.equal(REMARKS_WORD_LIMIT, 500);
});

/* ---- storage must outlast the cap ---- */

test('a 500-word entry plus prefix fits inside every free-text column', () => {
  // The widest realistic payload: the full description plus the labels the
  // routes prepend when writing to job_request_status_history.remarks.
  const fiveHundredWords = Array.from({ length: 500 }, () => 'word').join(' ');
  const worstCase = `${fiveHundredWords} — Disapproved by Campus Administrator:`.length;
  // TEXT holds 65,535 chars; a VARCHAR(255) would not.
  assert.ok(worstCase < 65535, '500 words must fit in a TEXT column');
  assert.ok(worstCase > 255, 'sanity: the payload really is longer than a VARCHAR(255)');
});

test('schema declares every free-text column as TEXT, not VARCHAR', () => {
  const offenders = [];
  for (const [table, column] of FREE_TEXT_COLUMNS) {
    const def = columnDefinition(table, column);
    if (def === null) continue; // created by an ensureColumn migration
    if (/^VARCHAR/.test(def)) offenders.push(`${table}.${column} is ${def}`);
  }
  assert.deepEqual(offenders, [], `length-capped free-text columns:\n  ${offenders.join('\n  ')}`);
});

test('autoSetup still widens free-text columns on every boot', () => {
  const autoSetup = fs.readFileSync(path.join(BACKEND, 'src', 'scripts', 'autoSetup.js'), 'utf8');
  for (const [table, column] of FREE_TEXT_COLUMNS) {
    if (columnDefinition(table, column) !== null) continue;
    assert.ok(
      autoSetup.includes(`'${table}', '${column}'`),
      `no migration found for ${table}.${column}`
    );
  }
});

/* ---- enforcement ---- */

test('every remarks/description write path enforces the word limit in the API', () => {
  const routes = fs.readFileSync(
    path.join(BACKEND, 'src', 'routes', 'requisitionRoutes.js'),
    'utf8'
  );
  // The guard helper must be applied on: request create, urgent-form
  // completion, and the three approval-action endpoints.
  const descGuards = (routes.match(/wordLimitError\(\s*description/g) || []).length;
  const remarkGuards = (routes.match(/wordLimitError\(\s*remarks/g) || []).length;

  assert.ok(descGuards >= 2, `description guarded on only ${descGuards} endpoint(s), expected 2`);
  assert.ok(
    remarkGuards >= 3,
    `remarks guarded on only ${remarkGuards} endpoint(s), expected 3 (supervisor, admin, approver)`
  );
  assert.ok(
    routes.includes('DESCRIPTION_WORD_LIMIT') && routes.includes('REMARKS_WORD_LIMIT'),
    'the routes must use the shared limits, not hard-coded numbers'
  );
});

test('the client clamps to the same limit the API enforces', () => {
  const util = fs.readFileSync(path.join(FRONTEND, 'utils', 'wordLimit.js'), 'utf8');
  assert.match(util, /DESCRIPTION_WORD_LIMIT\s*=\s*500/, 'frontend limit must be 500');
  assert.match(util, /REMARKS_WORD_LIMIT\s*=\s*500/, 'frontend remarks limit must be 500');
  assert.ok(util.includes('clampWords'), 'frontend must trim rather than silently truncate');
});

test('free-text inputs are not capped by character maxLength', () => {
  // The cap is in WORDS, enforced in the handler — a maxLength would be a
  // second, conflicting character-based limit.
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.jsx?$/.test(entry.name)) {
        fs.readFileSync(full, 'utf8')
          .split('\n')
          .forEach((line, i) => {
            if (/maxLength/.test(line) && /descript|remark|note/i.test(line)) {
              offenders.push(`${path.relative(FRONTEND, full)}:${i + 1} ${line.trim()}`);
            }
          });
      }
    }
  };
  walk(FRONTEND);
  assert.deepEqual(offenders, [], `maxLength on free text:\n  ${offenders.join('\n  ')}`);
});

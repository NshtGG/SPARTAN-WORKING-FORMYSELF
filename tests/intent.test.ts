import assert from 'node:assert/strict';
import {
  classifyIntent, isFiller, isInstructionClause, remainingMinutesToday,
  splitClauses, startMinutesFor,
} from '../src/utils/intent';
import { parseTasks } from '../src/utils/planner';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log('\n--- the exact bug that was reported ---');

test('"forget tomorrow I want to plan the day for today" is NOT a task', () => {
  const intent = classifyIntent('forget tomorrow I want to plan the day for today');
  assert.equal(intent.kind, 'set_horizon');
  assert.equal(intent.horizon, 'today');
  assert.equal(parseTasks(intent.taskText).length, 0,
    `leftover text became tasks: "${intent.taskText}"`);
});

test('"first of all lets plan out the day rather than tomorrow" is NOT a task', () => {
  const intent = classifyIntent("first of all let's plan out the day rather than tomorrow");
  assert.equal(intent.kind, 'set_horizon');
  assert.equal(intent.horizon, 'today');
  assert.equal(parseTasks(intent.taskText).length, 0,
    `leftover text became tasks: "${intent.taskText}"`);
});

test('the old behaviour would have created a task — proving the fix matters', () => {
  // What the previous build did: parse the whole message as task content.
  const naive = parseTasks("first of all let's plan out the day rather than tomorrow");
  assert.ok(naive.length > 0, 'sanity: the naive parser does create a bogus task');
  // What the new pipeline does.
  const intent = classifyIntent("first of all let's plan out the day rather than tomorrow");
  assert.equal(parseTasks(intent.taskText).length, 0);
});

console.log('\n--- horizon switching ---');

test('plan for today', () => {
  assert.equal(classifyIntent('can we do today instead').horizon, 'today');
});
test('plan for tomorrow', () => {
  assert.equal(classifyIntent('actually make it tomorrow').horizon, 'tomorrow');
});
test('"not tomorrow" means today', () => {
  assert.equal(classifyIntent('not tomorrow please').horizon, 'today');
});
test('"forget today" means tomorrow', () => {
  assert.equal(classifyIntent('forget today, do the next day').horizon, 'tomorrow');
});
test('horizon change carried with real tasks keeps the tasks', () => {
  const intent = classifyIntent('plan for today instead: study 2 hours, gym');
  assert.equal(intent.horizon, 'today');
  const tasks = parseTasks(intent.taskText);
  assert.equal(tasks.length, 2, `expected 2 tasks, got ${tasks.map((t) => t.title).join(' | ')}`);
});

console.log('\n--- other instructions are not tasks either ---');

test('"lock it" locks, does not become a task', () => {
  assert.equal(classifyIntent('lock it').kind, 'lock');
});
test('"that\'s all" locks', () => {
  assert.equal(classifyIntent("that's all").kind, 'lock');
});
test('"start over" resets', () => {
  assert.equal(classifyIntent('start over').kind, 'reset');
});
test('"forget what I said" replaces', () => {
  assert.equal(classifyIntent('forget what I said, here is the real list').kind, 'replace_tasks');
});
test('"remove the gym" targets the gym', () => {
  const intent = classifyIntent('remove the gym');
  assert.equal(intent.kind, 'remove_task');
  assert.deepEqual(intent.removeTargets, ['gym']);
});
test('"drop the gym and emails" targets both', () => {
  const intent = classifyIntent('drop the gym and emails');
  assert.equal(intent.kind, 'remove_task');
  assert.equal(intent.removeTargets.length, 2);
});
test('"give me more" asks for a heavier day', () => {
  assert.equal(classifyIntent('give me more').kind, 'more_load');
});
test('"that is too much" asks for a lighter day', () => {
  assert.equal(classifyIntent("that's too much").kind, 'less_load');
});
test('a bare question is a question', () => {
  assert.equal(classifyIntent('what can you do?').kind, 'question');
});
test('empty input is empty', () => {
  assert.equal(classifyIntent('   ').kind, 'empty');
});

console.log('\n--- ordinary task lists still work ---');

test('plain list is add_tasks', () => {
  const intent = classifyIntent('study physics 2 hours, gym, reply to emails');
  assert.equal(intent.kind, 'add_tasks');
  assert.equal(parseTasks(intent.taskText).length, 3);
});
test('a task list is not mistaken for a lock', () => {
  assert.equal(classifyIntent('ok so study 2 hours and gym').kind, 'add_tasks');
});
test('"finish the report" is a task, not an instruction', () => {
  assert.equal(classifyIntent('finish the report').kind, 'add_tasks');
});
test('a task mentioning today survives as a task', () => {
  const intent = classifyIntent('study 2 hours, gym 1 hour');
  assert.equal(parseTasks(intent.taskText).length, 2);
});

test('connectives inside a clause still separate tasks', () => {
  const intent = classifyIntent('plan the reunion and gym 1 hour');
  const titles = parseTasks(intent.taskText).map((t) => t.title);
  assert.equal(titles.length, 2, `merged into: ${titles.join(' | ')}`);
});
test('a real "plan X" task is not mistaken for planning meta-talk', () => {
  const intent = classifyIntent('plan the reunion');
  assert.equal(parseTasks(intent.taskText).length, 1);
});

console.log('\n--- clause splitting & filler ---');

test('splits on commas before connectives', () => {
  const clauses = splitClauses("forget tomorrow, let's plan today");
  assert.equal(clauses.length, 2);
});
test('splits on sentence enders', () => {
  assert.equal(splitClauses('Study physics. Then gym. Then emails.').length, 3);
});
test('instruction clause detected', () => {
  assert.ok(isInstructionClause('rather than tomorrow'));
});
test('task clause not treated as instruction', () => {
  assert.ok(!isInstructionClause('study physics for 2 hours'));
});
test('filler is filtered', () => {
  assert.ok(isFiller('first of all'));
  assert.ok(isFiller('ok'));
  assert.ok(!isFiller('study physics'));
});

console.log('\n--- scheduling horizon ---');

test('tomorrow starts at 9am', () => {
  assert.equal(startMinutesFor('tomorrow'), 9 * 60);
});
test('today starts from the next quarter hour, not 9am', () => {
  const now = new Date();
  now.setHours(14, 3, 0, 0);
  const start = startMinutesFor('today', now);
  assert.equal(start, 14 * 60 + 15, `expected 2:15 PM, got ${Math.floor(start / 60)}:${start % 60}`);
});
test('today late at night is clamped, not scheduled past midnight', () => {
  const now = new Date();
  now.setHours(23, 40, 0, 0);
  assert.ok(startMinutesFor('today', now) <= 22 * 60);
});
test('remaining time shrinks as the day goes on', () => {
  const morning = new Date(); morning.setHours(9, 0, 0, 0);
  const evening = new Date(); evening.setHours(20, 0, 0, 0);
  assert.ok(remainingMinutesToday(morning) > remainingMinutesToday(evening));
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);

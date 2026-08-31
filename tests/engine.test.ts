import assert from 'node:assert/strict';
import {
  analyzeDiscipline, buildPlan, calibrateLoad, capacityProfile,
  classifyDifficulty, extractDuration, parseTasks, sprintProfile,
} from '../src/utils/planner';
import { extractJson, parseModelReply, analyzeLocally } from '../src/utils/ai';
import { formatClock, formatDuration } from '../src/types';

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

console.log('\n--- discipline detection ---');
test('bad day reads as building', () => {
  assert.equal(analyzeDiscipline('honestly I did nothing, scrolled all day and procrastinated'), 'building');
});
test('good day reads as sharp', () => {
  assert.equal(analyzeDiscipline('finished my project, studied 3 hours and went to the gym'), 'sharp');
});
test('vague day reads as steady', () => {
  assert.equal(analyzeDiscipline('it was an average day, some things happened'), 'steady');
});
test('one-word answer is penalised', () => {
  assert.equal(analyzeDiscipline('ok'), 'building');
});

console.log('\n--- duration extraction ---');
test('hours', () => assert.equal(extractDuration('study 2 hours'), 120));
test('minutes', () => assert.equal(extractDuration('gym 45 min'), 45));
test('decimal hours', () => assert.equal(extractDuration('read 1.5 hours'), 90));
test('hours and minutes', () => assert.equal(extractDuration('code 1 hr 30 mins'), 90));
test('half an hour', () => assert.equal(extractDuration('call mom half an hour'), 30));
test('no duration returns null', () => assert.equal(extractDuration('clean the room'), null));

console.log('\n--- difficulty classification ---');
test('gym is iron', () => assert.equal(classifyDifficulty('gym session'), 'iron'));
test('study is hard', () => assert.equal(classifyDifficulty('study chemistry'), 'hard'));
test('email is easy', () => assert.equal(classifyDifficulty('reply to email'), 'easy'));
test('unknown is medium', () => assert.equal(classifyDifficulty('figure out the garage situation'), 'medium'));
test('run errands is easy, not a workout', () => assert.equal(classifyDifficulty('run errands'), 'easy'));
test('word boundaries respected (ready is not read)', () => assert.equal(classifyDifficulty('get ready for the trip'), 'medium'));

console.log('\n--- open-ended task parsing (no fixed count) ---');
test('parses a single task', () => {
  assert.equal(parseTasks('finish the physics assignment').length, 1);
});
test('parses seven tasks without truncating to three', () => {
  const t = parseTasks('gym, study physics, reply to emails, clean room, read 30 min, code the app, call dad');
  assert.equal(t.length, 7);
});
test('parses newline lists', () => {
  assert.equal(parseTasks('gym\nstudy math\nbuy groceries').length, 3);
});
test('strips filler verbs', () => {
  assert.equal(parseTasks('I want to finish the report')[0].title, 'Finish the report');
});
test('numbered lists work', () => {
  const t = parseTasks('1. gym\n2. study\n3. emails');
  assert.equal(t.length, 3);
  assert.equal(t[0].title, 'Gym');
});
test('deduplicates repeats', () => {
  assert.equal(parseTasks('gym, gym, gym').length, 1);
});
test('explicit duration overrides the default estimate', () => {
  const t = parseTasks('study 3 hours');
  assert.equal(t[0].estimate, 180);
});
test('empty input yields nothing', () => {
  assert.equal(parseTasks('   ').length, 0);
});

console.log('\n--- workload calibration ---');
test('overloaded day gets trimmed', () => {
  const tasks = parseTasks('study 3 hours, code 3 hours, gym 2 hours, read 2 hours, clean 1 hour');
  const call = calibrateLoad(tasks, 'building');
  assert.equal(call.verdict, 'trim');
  assert.ok(call.deferred.length > 0, 'expected deferred tasks');
  const kept = call.accepted.reduce((s, t) => s + t.estimate, 0);
  assert.ok(kept <= call.capacityMinutes, `kept ${kept} exceeds cap ${call.capacityMinutes}`);
});
test('light day invites more', () => {
  const call = calibrateLoad(parseTasks('reply to emails'), 'sharp');
  assert.equal(call.verdict, 'add');
  assert.ok(call.roomForMore > 0);
});
test('well-sized day is balanced', () => {
  const call = calibrateLoad(parseTasks('study 2 hours, gym 1 hour, emails 30 min'), 'steady');
  assert.equal(call.verdict, 'balanced');
  assert.equal(call.deferred.length, 0);
});
test('discipline level changes how much survives', () => {
  const tasks = parseTasks('study 2 hours, code 2 hours, gym 1 hour, read 1 hour');
  const building = calibrateLoad(tasks, 'building');
  const sharp = calibrateLoad(tasks, 'sharp');
  assert.ok(sharp.accepted.length > building.accepted.length,
    `sharp kept ${sharp.accepted.length}, building kept ${building.accepted.length}`);
});
test('hardest task is scheduled first', () => {
  const call = calibrateLoad(parseTasks('reply to emails, study physics, gym'), 'steady');
  assert.equal(call.accepted[0].difficulty, 'hard');
});
test('a single oversized task is never dropped to nothing', () => {
  const call = calibrateLoad(parseTasks('study 8 hours'), 'building');
  assert.equal(call.accepted.length, 1);
  assert.equal(call.deferred.length, 0);
});
test('reasoning is real prose, not a stub', () => {
  const call = calibrateLoad(parseTasks('study 3 hours, gym, emails'), 'steady');
  assert.ok(call.reasoning.length > 80, 'reasoning too short');
});
test('capacity rises with discipline', () => {
  assert.ok(capacityProfile('sharp').minutes > capacityProfile('steady').minutes);
  assert.ok(capacityProfile('steady').minutes > capacityProfile('building').minutes);
});

console.log('\n--- schedule building ---');
test('produces tasks and blocks', () => {
  const call = calibrateLoad(parseTasks('study 2 hours, gym 1 hour'), 'steady');
  const { tasks, schedule } = buildPlan(call.accepted, 'steady');
  assert.equal(tasks.length, 2);
  assert.ok(schedule.length >= 2);
});
test('no overlapping or backwards blocks', () => {
  const call = calibrateLoad(parseTasks('study 2 hours, code 90 min, gym 45 min'), 'sharp');
  const { schedule } = buildPlan(call.accepted, 'sharp');
  for (let i = 1; i < schedule.length; i++) {
    assert.ok(schedule[i].startMinutes >= schedule[i - 1].endMinutes,
      `block ${i} starts before previous ends`);
  }
});
test('every block has positive duration', () => {
  const call = calibrateLoad(parseTasks('study 2 hours, emails 15 min, gym'), 'steady');
  const { schedule } = buildPlan(call.accepted, 'steady');
  schedule.forEach((b) => assert.ok(b.duration > 0, `${b.title} has duration ${b.duration}`));
});
test('breaks sit between sprints but never at the very end', () => {
  const call = calibrateLoad(parseTasks('study 2 hours, gym 1 hour'), 'steady');
  const { schedule } = buildPlan(call.accepted, 'steady');
  assert.notEqual(schedule[schedule.length - 1].type, 'break');
});
test('sprint length follows discipline profile', () => {
  const call = calibrateLoad(parseTasks('study 150 min'), 'building');
  const { tasks } = buildPlan(call.accepted, 'building');
  assert.ok(tasks[0].sprintLength <= sprintProfile('building').work + 5,
    `sprint ${tasks[0].sprintLength} too long for building mode`);
});
test('time block renders a real range', () => {
  const call = calibrateLoad(parseTasks('study 2 hours'), 'steady');
  const { tasks } = buildPlan(call.accepted, 'steady');
  assert.match(tasks[0].timeBlock, /^\d{1,2}:\d{2} (AM|PM) – \d{1,2}:\d{2} (AM|PM)$/);
});
test('every task id is unique', () => {
  const call = calibrateLoad(parseTasks('study, gym, emails, read, code'), 'sharp');
  const { tasks } = buildPlan(call.accepted, 'sharp');
  assert.equal(new Set(tasks.map((t) => t.id)).size, tasks.length);
});
test('every schedule block id is unique', () => {
  const call = calibrateLoad(parseTasks('study 2 hours, gym 1 hour, read 1 hour'), 'sharp');
  const { schedule } = buildPlan(call.accepted, 'sharp');
  assert.equal(new Set(schedule.map((b) => b.id)).size, schedule.length);
});
test('sprint count matches the blocks emitted', () => {
  const call = calibrateLoad(parseTasks('study 3 hours'), 'steady');
  const { tasks, schedule } = buildPlan(call.accepted, 'steady');
  const sprints = schedule.filter((b) => b.type === 'task' && b.taskId === tasks[0].id);
  assert.equal(sprints.length, tasks[0].sprintCount);
});

console.log('\n--- formatting ---');
test('clock formats midnight and noon', () => {
  assert.equal(formatClock(0), '12:00 AM');
  assert.equal(formatClock(12 * 60), '12:00 PM');
  assert.equal(formatClock(13 * 60 + 5), '1:05 PM');
});
test('duration formats', () => {
  assert.equal(formatDuration(45), '45m');
  assert.equal(formatDuration(120), '2h');
  assert.equal(formatDuration(90), '1h 30m');
});

console.log('\n--- AI layer (offline paths) ---');
test('local analysis works with no network', () => {
  const a = analyzeLocally('did nothing all day', 'study 2 hours, gym');
  assert.equal(a.source, 'local');
  assert.ok(a.capacity.accepted.length > 0);
});
test('extracts JSON from a fenced reply', () => {
  const obj = extractJson('```json\n{"a":1}\n```') as { a: number };
  assert.equal(obj.a, 1);
});
test('extracts JSON with chatty preamble', () => {
  const obj = extractJson('Sure! Here you go:\n{"a":2}\nHope that helps') as { a: number };
  assert.equal(obj.a, 2);
});
test('valid model reply is accepted', () => {
  const reply = JSON.stringify({
    discipline: 'steady',
    verdict: 'balanced',
    accepted: [{ title: 'Study physics', difficulty: 'hard', estimate: 120 }],
    deferred: [],
    roomForMore: 1,
    reasoning: 'This is a properly sized day for steady mode, hardest work first, no padding.',
  });
  const a = parseModelReply(reply);
  assert.equal(a.source, 'remote');
  assert.equal(a.capacity.accepted[0].title, 'Study physics');
});
test('garbage model reply is rejected so we can fall back', () => {
  assert.throws(() => parseModelReply('I cannot help with that'));
});
test('model reply with no tasks is rejected', () => {
  assert.throws(() => parseModelReply('{"discipline":"steady","accepted":[]}'));
});
test('absurd model estimates are clamped', () => {
  const reply = JSON.stringify({
    discipline: 'steady',
    accepted: [{ title: 'Study', difficulty: 'hard', estimate: 99999 }],
    reasoning: 'x'.repeat(50),
  });
  const a = parseModelReply(reply);
  assert.ok(a.capacity.accepted[0].estimate <= 480);
});
test('bad difficulty from model falls back to medium', () => {
  const reply = JSON.stringify({
    discipline: 'steady',
    accepted: [{ title: 'Thing', difficulty: 'banana', estimate: 60 }],
    reasoning: 'x'.repeat(50),
  });
  assert.equal(parseModelReply(reply).capacity.accepted[0].difficulty, 'medium');
});
test('model cannot smuggle in a bad discipline level', () => {
  const reply = JSON.stringify({
    discipline: 'godmode',
    accepted: [{ title: 'Thing', difficulty: 'hard', estimate: 60 }],
    reasoning: 'x'.repeat(50),
  });
  assert.equal(parseModelReply(reply).discipline, 'steady');
});

console.log('\n--- end-to-end scenarios ---');
test('lazy yesterday + huge list => trimmed short-sprint day', () => {
  const a = analyzeLocally(
    'nothing, I scrolled all day and procrastinated',
    'study 3 hours, code 3 hours, gym 2 hours, read 2 hours, emails, clean the flat',
  );
  assert.equal(a.discipline, 'building');
  assert.equal(a.capacity.verdict, 'trim');
  const { tasks } = buildPlan(a.capacity.accepted, a.discipline);
  tasks.forEach((t) => assert.ok(t.sprintLength <= 30, `sprint ${t.sprintLength} too long for building`));
});
test('disciplined yesterday + tiny list => told to add more', () => {
  const a = analyzeLocally(
    'finished the project, studied 3 hours, went to the gym and read',
    'reply to emails',
  );
  assert.equal(a.discipline, 'sharp');
  assert.equal(a.capacity.verdict, 'add');
  assert.ok(a.capacity.reasoning.toLowerCase().includes('under-loading'));
});
test('same list is treated differently by discipline level', () => {
  const list = 'study 2 hours, code 2 hours, gym 1 hour, read 1 hour, emails 30 min';
  const lazy = analyzeLocally('did nothing, procrastinated', list);
  const strong = analyzeLocally('finished project, studied, trained at the gym, read', list);
  assert.ok(strong.capacity.accepted.length > lazy.capacity.accepted.length,
    'a stronger yesterday should earn a heavier tomorrow');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);

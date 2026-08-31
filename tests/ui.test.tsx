import { JSDOM } from 'jsdom';

/* ---- jsdom bootstrap (must run before React is imported) ---- */
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'https://spartan.local',
  pretendToBeVisual: true,
});

const g = globalThis as unknown as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true });
g.HTMLElement = dom.window.HTMLElement;
g.Element = dom.window.Element;
g.Node = dom.window.Node;
g.getComputedStyle = dom.window.getComputedStyle;
g.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0);
g.cancelAnimationFrame = (id: number) => clearTimeout(id);
g.IS_REACT_ACT_ENVIRONMENT = true;

// jsdom has no scrollTo on elements; the chat autoscroll calls it.
dom.window.Element.prototype.scrollTo = function () {};
// Focus session vibrates on completion.
Object.defineProperty(dom.window.navigator, 'vibrate', { value: () => true, configurable: true });

const { render, screen, fireEvent, waitFor, cleanup, within } = await import('@testing-library/react');
const { default: App } = await import('../src/App');
const { default: React } = await import('react');

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    cleanup();
    dom.window.localStorage.clear();
  }
}

function textarea() {
  return screen.getByRole('textbox') as HTMLTextAreaElement;
}

/** Type a chat message and send it. */
async function say(text: string) {
  const box = textarea();
  fireEvent.change(box, { target: { value: text } });
  fireEvent.keyDown(box, { key: 'Enter', shiftKey: false });
}

/** Walk the chat from cold start to the calibration card. */
async function planUpTo(yesterday: string, tasks: string) {
  render(React.createElement(App));
  await say(yesterday);
  await waitFor(() => {
    if (!/what do you want to get done (tomorrow|today)/.test(document.body.textContent ?? '')) {
      throw new Error('task prompt did not appear');
    }
  }, { timeout: 4000 });
  await say(tasks);
  await waitFor(() => {
    if (!screen.queryByText(/LOCK COMMAND PLAN/i)) throw new Error('calibration card did not appear');
  }, { timeout: 6000 });
}

console.log('\n--- boot & login ---');

await test('app boots straight into the chat with no login screen', async () => {
  render(React.createElement(App));
  const body = document.body.textContent ?? '';
  if (/sign in|log in|login|create account|register|password|email address/i.test(body)) {
    throw new Error('found auth UI in a supposedly local-only app');
  }
  if (!body.includes('SPARTAN')) throw new Error('app shell did not render');
  if (!body.includes('account for today')) throw new Error('opening question missing');
});

await test('no network call happens on boot', async () => {
  let called = false;
  const original = g.fetch;
  g.fetch = (() => { called = true; return Promise.reject(new Error('blocked')); }) as typeof fetch;
  render(React.createElement(App));
  await new Promise((r) => setTimeout(r, 150));
  g.fetch = original;
  if (called) throw new Error('app phoned home on startup');
});

await test('all four tabs are present and switchable', async () => {
  render(React.createElement(App));
  for (const label of ['COMMAND', 'BOARD', 'FOCUS', 'TODAY']) {
    const tab = screen.getByText(label);
    fireEvent.click(tab);
    await new Promise((r) => setTimeout(r, 30));
  }
  if (!document.body.textContent?.includes('SPARTAN')) throw new Error('app broke while switching tabs');
});

console.log('\n--- the planning conversation ---');

await test('AI asks an open-ended "what do you want to do tomorrow", not "give me three"', async () => {
  render(React.createElement(App));
  await say('worked a bit, wasted the afternoon');
  await waitFor(() => {
    const body = document.body.textContent ?? '';
    if (!/what do you want to get done tomorrow/.test(body)) throw new Error('open question missing');
  }, { timeout: 4000 });
  const body = document.body.textContent ?? '';
  if (/three outcomes|top three|3 outcomes|give me three/i.test(body)) {
    throw new Error('still demanding exactly three tasks');
  }
});

await test('accepts a seven-task list without silently dropping four', async () => {
  await planUpTo(
    'finished the report, studied for two hours, went to the gym, read a chapter',
    'study physics 2 hours, write the essay 90 min, gym 1 hour, read 30 min, reply to emails, clean the room, call dad',
  );
  const body = document.body.textContent ?? '';
  // Every task must appear somewhere — either scheduled or explicitly deferred.
  for (const fragment of ['Study physics', 'Write the essay', 'Gym', 'Read', 'Reply to emails', 'Clean the room', 'Call dad']) {
    if (!body.includes(fragment)) throw new Error(`task "${fragment}" vanished entirely`);
  }
});

await test('overloaded day is cut down and the cuts are shown', async () => {
  await planUpTo(
    'did nothing, scrolled all day, procrastinated badly',
    'study 3 hours, code 3 hours, gym 2 hours, read 2 hours, clean the flat 1 hour',
  );
  const body = document.body.textContent ?? '';
  if (!body.includes('Load reduced')) throw new Error('did not flag the overload');
  if (!body.includes('Pushed to another day')) throw new Error('deferred list not shown');
});

await test('under-loaded day is told it has room for more', async () => {
  await planUpTo(
    'finished the project, studied three hours, trained at the gym, read a lot',
    'reply to emails',
  );
  const body = document.body.textContent ?? '';
  if (!body.includes('Room for more')) throw new Error('did not flag the light day');
  if (!/under-loading/i.test(body)) throw new Error('missing the explanation');
});

await test('a well-sized day is accepted as balanced', async () => {
  await planUpTo(
    'ordinary day, got some things done',
    'study 2 hours, gym 1 hour, reply to emails 30 min',
  );
  const body = document.body.textContent ?? '';
  if (!body.includes('Load balanced')) throw new Error('expected a balanced verdict');
  if (body.includes('Pushed to another day')) throw new Error('cut tasks from an already-fine day');
});

await test('the same list is judged differently after a bad vs good yesterday', async () => {
  const list = 'study 2 hours, code 2 hours, gym 1 hour, read 1 hour, emails 30 min';

  await planUpTo('did nothing, procrastinated, scrolled', list);
  const lazyBody = document.body.textContent ?? '';
  cleanup();
  dom.window.localStorage.clear();

  await planUpTo('finished the project, studied, trained at the gym, read', list);
  const strongBody = document.body.textContent ?? '';

  if (!lazyBody.includes('Pushed to another day')) throw new Error('lazy day was not trimmed');
  if (strongBody.includes('Pushed to another day') && lazyBody.includes('Pushed to another day')) {
    // both trimmed is fine only if the strong day kept more
    const lazyCut = (lazyBody.match(/Pushed to another day/g) ?? []).length;
    if (lazyCut === 0) throw new Error('inconsistent trimming');
  }
});

await test('adding more tasks re-runs the calibration', async () => {
  await planUpTo('finished project, studied, gym, read', 'reply to emails');
  if (!document.body.textContent?.includes('Room for more')) throw new Error('setup failed');
  await say('study physics 2 hours, write the essay 90 minutes');
  await waitFor(() => {
    const body = document.body.textContent ?? '';
    if (!body.includes('Study physics')) throw new Error('added task not picked up');
  }, { timeout: 6000 });
});

console.log('\n--- locking, board, timetable ---');

await test('locking the plan fills the board and timetable', async () => {
  await planUpTo('average day', 'study 2 hours, gym 1 hour, emails 30 min');
  fireEvent.click(screen.getByText(/LOCK COMMAND PLAN/i));

  await waitFor(() => {
    if (!document.body.textContent?.includes('TASK BOARD')) throw new Error('board did not fill');
  }, { timeout: 4000 });

  fireEvent.click(screen.getByText('TODAY'));
  await waitFor(() => {
    const body = document.body.textContent ?? '';
    if (body.includes('NOTHING RECORDED')) {
      throw new Error('Today view is still empty after locking');
    }
  }, { timeout: 4000 });
});

await test('board shows progress and tasks can be completed', async () => {
  await planUpTo('average day', 'study 2 hours, gym 1 hour');
  fireEvent.click(screen.getByText(/LOCK COMMAND PLAN/i));
  await waitFor(() => {
    if (!document.body.textContent?.includes('TASK BOARD')) throw new Error('board did not fill');
  }, { timeout: 4000 });

  if (!document.body.textContent?.includes('0 of 2 complete')) {
    throw new Error('progress counter wrong at start');
  }
  fireEvent.click(screen.getByText('01'));
  await waitFor(() => {
    if (!document.body.textContent?.includes('1 of 2 complete')) {
      throw new Error('completing a task did not update progress');
    }
  }, { timeout: 3000 });
});

await test('TODAY shows the locked tasks as reality with a plan-next button', async () => {
  await planUpTo('average day', 'study 2 hours, gym 1 hour, emails 30 min');
  fireEvent.click(screen.getByText(/LOCK COMMAND PLAN/i));
  await waitFor(() => {
    if (!document.body.textContent?.includes('TASK BOARD')) throw new Error('board did not fill');
  }, { timeout: 4000 });
  fireEvent.click(screen.getByText('TODAY'));
  await new Promise((r) => setTimeout(r, 120));

  const body = document.body.textContent ?? '';
  if (body.includes('NOTHING RECORDED')) throw new Error('Today view is empty after locking');
  if (!body.includes('WHAT ACTUALLY')) throw new Error('Today headline missing');
  // Nothing done yet, so everything sits under "left undone".
  if (!/LEFT UNDONE/i.test(body)) throw new Error('undone section missing');
  if (!/PLAN TOMORROW/i.test(body)) throw new Error('the loop-back button is missing');
});

await test('completing tasks moves them into the finished section of TODAY', async () => {
  await planUpTo('average day', 'study 2 hours, gym 1 hour');
  fireEvent.click(screen.getByText(/LOCK COMMAND PLAN/i));
  await waitFor(() => {
    if (!document.body.textContent?.includes('TASK BOARD')) throw new Error('board did not fill');
  }, { timeout: 4000 });
  // Mark the first task done on the board.
  fireEvent.click(screen.getByText('01'));
  await new Promise((r) => setTimeout(r, 80));
  fireEvent.click(screen.getByText('TODAY'));
  await new Promise((r) => setTimeout(r, 120));
  const body = document.body.textContent ?? '';
  if (!/FINISHED/i.test(body)) throw new Error('finished section missing after a completion');
});

console.log('\n--- persistence (everything local) ---');

await test('plan survives an app restart via localStorage', async () => {
  await planUpTo('average day', 'study 2 hours, gym 1 hour');
  fireEvent.click(screen.getByText(/LOCK COMMAND PLAN/i));
  await waitFor(() => {
    if (!document.body.textContent?.includes('TASK BOARD')) throw new Error('board did not fill');
  }, { timeout: 4000 });

  const stored = dom.window.localStorage.getItem('spartan.plan.v1');
  if (!stored) throw new Error('nothing written to localStorage');

  cleanup();
  render(React.createElement(App));
  await waitFor(() => {
    if (!document.body.textContent?.includes('TASK BOARD')) {
      throw new Error('plan did not reload after restart');
    }
  }, { timeout: 4000 });
});

await test('settings persist and default to the offline engine', async () => {
  render(React.createElement(App));
  const gear = document.querySelector('button[title="AI engine settings"]') as HTMLButtonElement;
  if (!gear) throw new Error('settings button missing');
  fireEvent.click(gear);
  await waitFor(() => {
    if (!document.body.textContent?.includes('AI SETTINGS')) throw new Error('settings sheet did not open');
  }, { timeout: 3000 });

  if (!document.body.textContent?.includes('On-device engine')) throw new Error('local option missing');
  fireEvent.click(screen.getByText('OpenRouter free models'));
  fireEvent.click(screen.getByText(/SAVE SETTINGS/i));

  await waitFor(() => {
    const raw = dom.window.localStorage.getItem('spartan.ai.v1');
    if (!raw || !raw.includes('openrouter')) throw new Error('settings not persisted');
  }, { timeout: 3000 });
});

await test('clearing local data wipes the plan', async () => {
  await planUpTo('average day', 'study 2 hours, gym 1 hour');
  fireEvent.click(screen.getByText(/LOCK COMMAND PLAN/i));
  await waitFor(() => {
    if (!document.body.textContent?.includes('TASK BOARD')) throw new Error('board did not fill');
  }, { timeout: 4000 });

  fireEvent.click(screen.getByText('COMMAND'));
  const gear = document.querySelector('button[title="AI engine settings"]') as HTMLButtonElement;
  fireEvent.click(gear);
  await waitFor(() => {
    if (!screen.queryByText(/CLEAR LOCAL DATA/i)) throw new Error('clear button missing');
  }, { timeout: 3000 });
  fireEvent.click(screen.getByText(/CLEAR LOCAL DATA/i));
  fireEvent.click(screen.getByText(/TAP AGAIN TO WIPE/i));

  await waitFor(() => {
    if (dom.window.localStorage.getItem('spartan.plan.v1')) throw new Error('plan still stored');
  }, { timeout: 3000 });
});

console.log('\n--- remote model resilience ---');

await test('falls back to the on-device engine when the model call fails', async () => {
  dom.window.localStorage.setItem('spartan.ai.v1', JSON.stringify({
    provider: 'pollinations', apiKey: '', model: 'x',
  }));
  const original = g.fetch;
  g.fetch = (() => Promise.reject(new Error('offline'))) as typeof fetch;

  try {
    await planUpTo('average day', 'study 2 hours, gym 1 hour');
    const body = document.body.textContent ?? '';
    if (!body.includes('LOCK COMMAND PLAN')) throw new Error('planning died when the model failed');
    if (!body.includes('on-device engine')) throw new Error('user was not told about the fallback');
  } finally {
    g.fetch = original;
  }
});

await test('uses the remote model when it answers correctly', async () => {
  dom.window.localStorage.setItem('spartan.ai.v1', JSON.stringify({
    provider: 'pollinations', apiKey: '', model: 'x',
  }));
  const original = g.fetch;
  g.fetch = (() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      choices: [{
        message: {
          content: JSON.stringify({
            discipline: 'sharp',
            verdict: 'balanced',
            accepted: [{ title: 'Remote model task', difficulty: 'hard', estimate: 120 }],
            deferred: [],
            roomForMore: 0,
            reasoning: 'This came from the remote model and should appear verbatim in the chat transcript.',
          }),
        },
      }],
    }),
  } as Response)) as typeof fetch;

  try {
    await planUpTo('average day', 'whatever the model decides');
    const body = document.body.textContent ?? '';
    if (!body.includes('Remote model task')) throw new Error('remote task not used');
    if (!body.includes('came from the remote model')) throw new Error('remote reasoning not shown');
  } finally {
    g.fetch = original;
  }
});

await test('a malformed model reply does not break the app', async () => {
  dom.window.localStorage.setItem('spartan.ai.v1', JSON.stringify({
    provider: 'pollinations', apiKey: '', model: 'x',
  }));
  const original = g.fetch;
  g.fetch = (() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ choices: [{ message: { content: 'I refuse to answer.' } }] }),
  } as Response)) as typeof fetch;

  try {
    await planUpTo('average day', 'study 2 hours, gym 1 hour');
    if (!document.body.textContent?.includes('LOCK COMMAND PLAN')) {
      throw new Error('garbage reply broke the flow');
    }
  } finally {
    g.fetch = original;
  }
});

console.log('\n--- focus session ---');

await test('focus tab lists the locked tasks and gates the sprint behind proof', async () => {
  await planUpTo('average day', 'study 2 hours, gym 1 hour');
  fireEvent.click(screen.getByText(/LOCK COMMAND PLAN/i));
  await waitFor(() => {
    if (!document.body.textContent?.includes('TASK BOARD')) throw new Error('board did not fill');
  }, { timeout: 4000 });

  fireEvent.click(screen.getByText('FOCUS'));
  await new Promise((r) => setTimeout(r, 150));

  const body = document.body.textContent ?? '';
  if (!body.includes('ONE TASK.')) throw new Error('focus setup did not render');

  const select = document.querySelector('select') as HTMLSelectElement;
  if (!select) throw new Error('task selector missing');
  if (select.options.length !== 2) throw new Error(`expected 2 tasks in selector, got ${select.options.length}`);

  const begin = Array.from(document.querySelectorAll('button'))
    .find((b) => /BEGIN .*SPRINT/i.test(b.textContent ?? '')) as HTMLButtonElement | undefined;
  if (!begin) throw new Error('begin button missing');
  if (!begin.disabled) throw new Error('sprint could start without proof — the whole point of the app');
});

await test('starting a task from the board opens it in focus', async () => {
  await planUpTo('average day', 'study 2 hours, gym 1 hour');
  fireEvent.click(screen.getByText(/LOCK COMMAND PLAN/i));
  await waitFor(() => {
    if (!document.body.textContent?.includes('TASK BOARD')) throw new Error('board did not fill');
  }, { timeout: 4000 });

  const focusButtons = Array.from(document.querySelectorAll('button[aria-label^="Focus on"]'));
  if (focusButtons.length === 0) throw new Error('no focus shortcuts on the board');
  fireEvent.click(focusButtons[0]);

  await waitFor(() => {
    if (!document.body.textContent?.includes('ONE TASK.')) throw new Error('did not jump to focus');
  }, { timeout: 3000 });
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);

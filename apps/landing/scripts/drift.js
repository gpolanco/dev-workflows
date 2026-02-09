// ── Drift Animation ──
const DRIFT_STAGES = [
  {
    day: 1, progress: 0,
    caption: 'Day 1 \u2014 All files in sync. <strong class="green">Life is good.</strong>',
    claude:  [
      { text: '- Use named exports', cls: '' },
      { text: '- Organize by feature', cls: '' },
      { text: '- camelCase for variables', cls: '' },
      { text: '- No default exports', cls: '' },
    ],
    cursor:  [
      { text: '- Use named exports', cls: '' },
      { text: '- Organize by feature', cls: '' },
      { text: '- camelCase for variables', cls: '' },
      { text: '- No default exports', cls: '' },
    ],
    gemini:  [
      { text: '- Use named exports', cls: '' },
      { text: '- Organize by feature', cls: '' },
      { text: '- camelCase for variables', cls: '' },
      { text: '- No default exports', cls: '' },
    ],
    conflicts: { claude: false, cursor: false, gemini: false },
    statuses: { claude: '\u25cf synced', cursor: '\u25cf synced', gemini: '\u25cf synced' },
  },
  {
    day: 5, progress: 17,
    caption: 'Day 5 \u2014 You update CLAUDE.md. <strong>Forget the others.</strong>',
    claude:  [
      { text: '- Use named exports', cls: '' },
      { text: '- Organize by feature', cls: '' },
      { text: '- camelCase for variables', cls: '' },
      { text: '- No default exports', cls: '' },
      { text: '- Prefer async/await', cls: 'added' },
    ],
    cursor:  [
      { text: '- Use named exports', cls: '' },
      { text: '- Organize by feature', cls: '' },
      { text: '- camelCase for variables', cls: '' },
      { text: '- No default exports', cls: '' },
    ],
    gemini:  [
      { text: '- Use named exports', cls: '' },
      { text: '- Organize by feature', cls: '' },
      { text: '- camelCase for variables', cls: '' },
      { text: '- No default exports', cls: '' },
    ],
    conflicts: { claude: false, cursor: false, gemini: false },
    statuses: { claude: '\u25cf updated', cursor: '\u25cf stale', gemini: '\u25cf stale' },
  },
  {
    day: 12, progress: 40,
    caption: 'Day 12 \u2014 A teammate edits Cursor rules. <strong class="red">Contradicts Claude.</strong>',
    claude:  [
      { text: '- Use named exports', cls: '' },
      { text: '- Organize by feature', cls: '' },
      { text: '- camelCase for variables', cls: 'conflict' },
      { text: '- No default exports', cls: '' },
      { text: '- Prefer async/await', cls: '' },
    ],
    cursor:  [
      { text: '- Use named exports', cls: '' },
      { text: '- Organize by feature', cls: '' },
      { text: '- snake_case for variables', cls: 'conflict' },
      { text: '- No default exports', cls: '' },
      { text: '- Use try/catch always', cls: 'added' },
    ],
    gemini:  [
      { text: '- Use named exports', cls: '' },
      { text: '- Organize by feature', cls: '' },
      { text: '- camelCase for variables', cls: '' },
      { text: '- No default exports', cls: '' },
    ],
    conflicts: { claude: true, cursor: true, gemini: false },
    statuses: { claude: '\u26a0 conflict', cursor: '\u26a0 conflict', gemini: '\u25cf stale' },
  },
  {
    day: 20, progress: 67,
    caption: 'Day 20 \u2014 Gemini gets edited too. <strong class="red">3 different truths.</strong>',
    claude:  [
      { text: '- Use named exports', cls: '' },
      { text: '- Organize by feature', cls: 'conflict' },
      { text: '- camelCase for variables', cls: 'conflict' },
      { text: '- No default exports', cls: '' },
      { text: '- Prefer async/await', cls: '' },
    ],
    cursor:  [
      { text: '- Use named exports', cls: '' },
      { text: '- Organize by feature', cls: '' },
      { text: '- snake_case for variables', cls: 'conflict' },
      { text: '- Allow default exports', cls: 'conflict' },
      { text: '- Use try/catch always', cls: '' },
    ],
    gemini:  [
      { text: '- Use named exports', cls: 'removed' },
      { text: '- Organize by type', cls: 'conflict' },
      { text: '- camelCase for variables', cls: '' },
      { text: '- No default exports', cls: '' },
      { text: '- Prefer callbacks', cls: 'conflict' },
    ],
    conflicts: { claude: true, cursor: true, gemini: true },
    statuses: { claude: '\u26a0 conflict', cursor: '\u26a0 conflict', gemini: '\u26a0 conflict' },
  },
  {
    day: 30, progress: 100,
    caption: 'Day 30 \u2014 <strong class="red">Total chaos.</strong> Each editor gives different advice.',
    claude:  [
      { text: '- Use named exports', cls: '' },
      { text: '- Organize by feature', cls: 'conflict' },
      { text: '- camelCase for variables', cls: 'conflict' },
      { text: '- No default exports', cls: '' },
      { text: '- Prefer async/await', cls: '' },
      { text: '- Max 200 lines per file', cls: 'added' },
    ],
    cursor:  [
      { text: '- Use named exports', cls: '' },
      { text: '- Organize by feature', cls: '' },
      { text: '- snake_case for variables', cls: 'conflict' },
      { text: '- Allow default exports', cls: 'conflict' },
      { text: '- Use try/catch always', cls: '' },
      { text: '- No comments in code', cls: 'conflict' },
    ],
    gemini:  [
      { text: '- Use barrel exports', cls: 'conflict' },
      { text: '- Organize by type', cls: 'conflict' },
      { text: '- PascalCase for files', cls: 'conflict' },
      { text: '- No default exports', cls: '' },
      { text: '- Prefer callbacks', cls: 'conflict' },
      { text: '- Always add comments', cls: 'conflict' },
    ],
    conflicts: { claude: true, cursor: true, gemini: true },
    statuses: { claude: '\u2717 drifted', cursor: '\u2717 drifted', gemini: '\u2717 drifted' },
  },
];

const FIX_STATE = {
  caption: '<strong class="green">Fixed.</strong> One source. All editors in sync. <code>devw compile</code>',
  lines: [
    { text: '- Use named exports', cls: '' },
    { text: '- Organize by feature', cls: '' },
    { text: '- camelCase for variables', cls: '' },
    { text: '- No default exports', cls: '' },
    { text: '- Prefer async/await', cls: '' },
    { text: '- Max 200 lines per file', cls: '' },
  ],
  status: '\u2713 compiled',
};

let driftTimer = null;
let driftStep = 0;

function renderDriftStage(stage) {
  ['claude','cursor','gemini'].forEach(key => {
    const body = document.getElementById('db-' + key);
    const file = document.getElementById('df-' + key);
    const status = document.getElementById('ds-' + key);
    body.innerHTML = stage[key].map(l =>
      `<div class="drift-line ${l.cls}">${l.text}</div>`
    ).join('');
    file.classList.toggle('has-conflict', stage.conflicts[key]);
    file.classList.remove('synced');
    status.textContent = stage.statuses[key];
  });
  document.getElementById('driftProgress').style.width = stage.progress + '%';
  document.getElementById('driftCaption').innerHTML = stage.caption;
  document.getElementById('driftFixBtn').classList.toggle('show', stage.day >= 30);
}

function startDrift() {
  const watchBtn = document.getElementById('driftWatchBtn');
  const hint = document.getElementById('driftHint');
  const resetBtn = document.getElementById('driftResetBtn');

  watchBtn.classList.remove('active');
  watchBtn.classList.add('running');
  watchBtn.innerHTML = '<span class="btn-spinner"></span> Drifting...';
  hint.classList.remove('show');
  resetBtn.classList.remove('show');

  driftStep = 0;
  renderDriftStage(DRIFT_STAGES[0]);
  clearInterval(driftTimer);

  driftTimer = setInterval(() => {
    driftStep++;
    if (driftStep >= DRIFT_STAGES.length) {
      clearInterval(driftTimer);
      watchBtn.classList.remove('running');
      watchBtn.classList.add('active');
      watchBtn.innerHTML = '\u25b6 Watch drift';
      resetBtn.classList.add('show');
      const fixBtn = document.getElementById('driftFixBtn');
      fixBtn.classList.remove('settled');
      setTimeout(() => fixBtn.classList.add('settled'), 600);
      setTimeout(() => hint.classList.add('show'), 300);
      return;
    }
    renderDriftStage(DRIFT_STAGES[driftStep]);
  }, 2000);
}

function resetDrift() {
  clearInterval(driftTimer);
  driftStep = 0;
  renderDriftStage(DRIFT_STAGES[0]);
  document.getElementById('driftFixBtn').classList.remove('show');
  document.getElementById('driftHint').classList.remove('show');
  document.getElementById('driftResetBtn').classList.remove('show');
  document.getElementById('driftProgress').style.background = '';
  const watchBtn = document.getElementById('driftWatchBtn');
  watchBtn.classList.remove('running');
  watchBtn.classList.add('active');
  watchBtn.innerHTML = '\u25b6 Watch drift';
}

function fixDrift() {
  clearInterval(driftTimer);
  document.getElementById('driftHint').classList.remove('show');

  const watchBtn = document.getElementById('driftWatchBtn');
  watchBtn.classList.remove('running');
  watchBtn.classList.add('active');
  watchBtn.innerHTML = '\u25b6 Watch drift';

  const fixBtn = document.getElementById('driftFixBtn');
  const files = ['claude','cursor','gemini'];
  const fileEls = files.map(k => document.getElementById('df-' + k));

  fixBtn.classList.remove('settled');
  fixBtn.style.animation = 'none';
  fixBtn.innerHTML = '<span class="btn-spinner" style="border-color:var(--bg);border-top-color:rgba(0,0,0,0.3);"></span> Compiling...';
  fixBtn.style.pointerEvents = 'none';

  fileEls.forEach(el => el.classList.add('compiling'));
  document.getElementById('driftCaption').innerHTML = '<span style="color:var(--accent)">Compiling...</span>';

  setTimeout(() => {
    fileEls.forEach(el => { el.classList.remove('compiling'); el.classList.add('collapsing'); });
  }, 400);

  setTimeout(() => {
    files.forEach(key => {
      const body = document.getElementById('db-' + key);
      const file = document.getElementById('df-' + key);
      const status = document.getElementById('ds-' + key);
      body.innerHTML = FIX_STATE.lines.map((l, i) =>
        `<div class="drift-line ${l.cls}" style="--i:${i}">${l.text}</div>`
      ).join('');
      file.classList.remove('has-conflict', 'collapsing');
      status.textContent = FIX_STATE.status;
    });
  }, 800);

  setTimeout(() => {
    fileEls.forEach(el => el.classList.add('resolved'));
    document.getElementById('driftProgress').style.width = '100%';
    document.getElementById('driftProgress').style.background = 'var(--accent)';
    document.getElementById('driftCaption').innerHTML = FIX_STATE.caption;
    fixBtn.classList.remove('show');
    fixBtn.innerHTML = '\u26a1 devw compile';
    fixBtn.style.pointerEvents = '';
    fixBtn.style.animation = '';
  }, 900);

  setTimeout(() => {
    fileEls.forEach(el => { el.classList.remove('resolved'); el.classList.add('synced'); });
  }, 2500);
}

renderDriftStage(DRIFT_STAGES[0]);

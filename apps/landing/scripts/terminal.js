// ── Terminal Tabs ──
const TERM_TABS = {
  init: {
    comment: '# Initialize dev-workflows in your project',
    lines: [
      { html: '<span class="term-prompt">$</span> <span class="term-cmd">npx dev-workflows init</span>', delay: 0 },
      { html: '', delay: 400 },
      { html: '<span class="term-muted">  Detected:</span> Claude Code, Cursor, Gemini CLI', delay: 500 },
      { html: '<span class="term-muted">  Mode:</span> copy', delay: 250 },
      { html: '', delay: 300 },
      { html: '<span class="term-success">  \u2713</span> Created <span class="term-file">.dwf/config.yml</span>', delay: 350 },
      { html: '<span class="term-success">  \u2713</span> Created <span class="term-file">.dwf/rules/</span> <span class="term-muted">(5 scope files)</span>', delay: 250 },
      { html: '', delay: 300 },
      { html: '<span class="term-success">  Ready.</span> <span class="term-muted">Run</span> devw add <span class="term-muted">to browse the registry.</span>', delay: 400 },
    ]
  },
  add: {
    comment: '# Add rules from the registry',
    lines: [
      { html: '<span class="term-prompt">$</span> <span class="term-cmd">devw add</span>', delay: 0 },
      { html: '', delay: 400 },
      { html: '<span class="term-success">  \u2714</span> Choose a category: <span class="term-val">typescript</span>', delay: 500 },
      { html: '<span class="term-success">  \u2714</span> Select rules to add: <span class="term-val">strict</span> <span class="term-muted">\u2014 Strict TypeScript conventions</span>', delay: 500 },
      { html: '<span class="term-success">  \u2714</span> Install 1 rule? <span class="term-val">Yes</span>', delay: 400 },
      { html: '', delay: 300 },
      { html: '<span class="term-success">  \u2713</span> Added <span class="term-val">typescript/strict</span> <span class="term-muted">(8 rules)</span>', delay: 350 },
      { html: '<span class="term-success">  \u2713</span> Compiled for <span class="term-file">claude</span>, <span class="term-file">cursor</span>', delay: 250 },
    ]
  },
  compile: {
    comment: '# Compile rules to each editor\u2019s native format',
    lines: [
      { html: '<span class="term-prompt">$</span> <span class="term-cmd">devw compile</span>', delay: 0 },
      { html: '', delay: 400 },
      { html: '<span class="term-muted">  Compiling 3 bridges...</span>', delay: 500 },
      { html: '', delay: 200 },
      { html: '<span class="term-success">  \u2713</span> <span class="term-file">CLAUDE.md</span>                       <span class="term-muted">\u2192 12 rules</span>', delay: 300 },
      { html: '<span class="term-success">  \u2713</span> <span class="term-file">.cursor/rules/devworkflows.mdc</span>  <span class="term-muted">\u2192 12 rules</span>', delay: 300 },
      { html: '<span class="term-success">  \u2713</span> <span class="term-file">GEMINI.md</span>                       <span class="term-muted">\u2192 12 rules</span>', delay: 300 },
      { html: '', delay: 200 },
      { html: '<span class="term-success">  Done.</span> <span class="term-muted">3 files compiled in 42ms</span>', delay: 350 },
    ]
  },
  watch: {
    comment: '# Watch for changes and recompile automatically',
    lines: [
      { html: '<span class="term-prompt">$</span> <span class="term-cmd">devw watch</span>', delay: 0 },
      { html: '', delay: 400 },
      { html: '  \uD83D\uDC40 <span class="term-success">Watching .dwf/ for changes...</span>', delay: 500 },
      { html: '<span class="term-muted">  Running initial compile...</span>', delay: 350 },
      { html: '', delay: 300 },
      { html: '<span class="term-success">  \u2714</span> claude     <span class="term-muted">\u2192</span> <span class="term-file">CLAUDE.md</span>', delay: 300 },
      { html: '<span class="term-success">  \u2714</span> cursor     <span class="term-muted">\u2192</span> <span class="term-file">.cursor/rules/devworkflows.mdc</span>', delay: 250 },
      { html: '<span class="term-muted">  Done in 21ms</span>', delay: 250 },
      { html: '', delay: 400 },
      { html: '<span class="term-muted">  Waiting for changes... (Ctrl+C to stop)</span>', delay: 350 },
    ]
  },
  doctor: {
    comment: '# Validate config and diagnose issues',
    lines: [
      { html: '<span class="term-prompt">$</span> <span class="term-cmd">npx dev-workflows doctor</span>', delay: 0 },
      { html: '', delay: 400 },
      { html: '<span class="term-muted">  Checking .dwf/ structure...</span>', delay: 500 },
      { html: '', delay: 200 },
      { html: '<span class="term-success">  \u2713</span> config.yml                  <strong>valid</strong>', delay: 300 },
      { html: '<span class="term-success">  \u2713</span> rules.yml                   <strong>valid</strong>', delay: 250 },
      { html: '<span class="term-success">  \u2713</span> 2 pulled rules              <span class="term-success">ok</span>', delay: 250 },
      { html: '<span class="term-warn">  \u26a0</span> CLAUDE.md                   <span class="term-warn"><strong>stale</strong> (recompile needed)</span>', delay: 350 },
      { html: '<span class="term-success">  \u2713</span> .cursor/rules               <span class="term-success">up to date</span>', delay: 250 },
      { html: '<span class="term-success">  \u2713</span> GEMINI.md                   <span class="term-success">up to date</span>', delay: 250 },
      { html: '', delay: 300 },
      { html: '  <span class="term-warn">1 warning.</span> Run <span class="term-cmd">devw compile</span> to fix.', delay: 350 },
    ]
  },
  list: {
    comment: '# List rules or tools',
    lines: [
      { html: '<span class="term-prompt">$</span> <span class="term-cmd">devw list rules</span>', delay: 0 },
      { html: '', delay: 400 },
      { html: '  <span class="term-muted">SCOPE</span>          <span class="term-muted">ID</span>                         <span class="term-muted">SEVERITY</span>', delay: 300 },
      { html: '  <span class="term-muted">\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500</span>', delay: 100 },
      { html: '  conventions    <span class="term-val">ts-strict-no-any</span>           <span class="term-warn">error</span>', delay: 200 },
      { html: '  conventions    <span class="term-val">ts-strict-explicit-returns</span>  <span class="term-muted">warning</span>', delay: 150 },
      { html: '  conventions    <span class="term-val">ts-strict-no-enums</span>         <span class="term-muted">warning</span>', delay: 150 },
      { html: '  conventions    <span class="term-val">ts-strict-no-non-null</span>      <span class="term-warn">error</span>', delay: 150 },
      { html: '  architecture   <span class="term-val">named-exports</span>              <span class="term-warn">error</span>', delay: 150 },
      { html: '  conventions    <span class="term-val">feature-structure</span>           <span class="term-warn">error</span>', delay: 150 },
      { html: '', delay: 200 },
      { html: '  <span class="term-muted">6 rules across 2 scopes</span>', delay: 300 },
    ]
  },
  remove: {
    comment: '# Remove a pulled rule',
    lines: [
      { html: '<span class="term-prompt">$</span> <span class="term-cmd">devw remove typescript/strict</span>', delay: 0 },
      { html: '', delay: 400 },
      { html: '<span class="term-success">  \u2713</span> Removed <span class="term-val">typescript/strict</span>', delay: 350 },
      { html: '<span class="term-success">  \u2713</span> Compiled for <span class="term-file">claude</span>, <span class="term-file">cursor</span>', delay: 250 },
    ]
  }
};

let termTimers = [];
let currentTermTab = null;

function clearTermTimers() {
  termTimers.forEach(t => clearTimeout(t));
  termTimers = [];
}

function switchTermTab(tab, btnEl) {
  trackEvent('terminal_tab', { command: tab });
  // Update active tab
  document.querySelectorAll('.term-tab').forEach(t => t.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');

  // Cancel any running animation
  clearTermTimers();

  // Play the tab
  currentTermTab = tab;
  const body = document.getElementById('termBody');
  const data = TERM_TABS[tab];
  body.innerHTML = '';

  // Add comment line immediately
  const commentDiv = document.createElement('div');
  commentDiv.className = 'term-line vis';
  commentDiv.innerHTML = '<span class="term-comment">' + data.comment + '</span>';
  body.appendChild(commentDiv);

  // Animate lines
  let i = 0;
  function addLine() {
    if (i >= data.lines.length || currentTermTab !== tab) return;
    const line = data.lines[i];
    const div = document.createElement('div');
    div.className = 'term-line';
    div.innerHTML = line.html || '&nbsp;';
    body.appendChild(div);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => div.classList.add('vis'));
    });
    i++;
    if (i < data.lines.length) {
      const nextDelay = data.lines[i].delay;
      termTimers.push(setTimeout(addLine, nextDelay));
    } else {
      // Add cursor to last line
      termTimers.push(setTimeout(() => {
        const last = body.lastElementChild;
        if (last && currentTermTab === tab) {
          const cursor = document.createElement('div');
          cursor.className = 'term-line vis';
          cursor.innerHTML = '<span class="term-prompt">$</span> <span class="term-cursor"></span>';
          body.appendChild(cursor);
        }
      }, 300));
    }
  }
  termTimers.push(setTimeout(addLine, 150));
}

// Init first tab
switchTermTab('init', document.querySelector('.term-tab'));

import { useEffect, useRef } from 'react';

/* ── CSS ────────────────────────────────────────────────────────────── */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@300;400;500;600&display=swap');

:root {
  --lh-bg: #0a0a0f;
  --lh-bg-card: #12121a;
  --lh-bg-card-hover: #18182a;
  --lh-border: #1e1e2e;
  --lh-border-accent: #2a2a3e;
  --lh-text: #e0e0e8;
  --lh-text-muted: #6b6b80;
  --lh-text-dim: #4a4a5e;
  --lh-accent-green: #22d37e;
  --lh-accent-green-dim: rgba(34, 211, 126, 0.12);
  --lh-accent-blue: #3b82f6;
  --lh-accent-blue-dim: rgba(59, 130, 246, 0.1);
  --lh-accent-purple: #a855f7;
  --lh-accent-purple-dim: rgba(168, 85, 247, 0.1);
  --lh-accent-amber: #f59e0b;
  --lh-accent-cyan: #06b6d4;
  --lh-accent-rose: #f43f5e;
  --lh-radius: 10px;
}

.landing-wrapper {
  background: var(--lh-bg);
  color: var(--lh-text);
  font-family: 'IBM Plex Mono', monospace;
  min-height: 100vh;
  overflow-x: hidden;
}

.landing-canvas {
  max-width: 820px;
  margin: 0 auto;
  padding: 60px 32px 80px;
  position: relative;
}

/* ── Header ── */
.lh-header {
  text-align: center;
  margin-bottom: 64px;
  position: relative;
  opacity: 0;
  transform: translateY(20px);
  transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}
.lh-header.visible { opacity: 1; transform: translateY(0); }

.lh-header::after {
  content: '';
  position: absolute;
  bottom: -32px;
  left: 50%;
  transform: translateX(-50%);
  width: 60px;
  height: 1px;
  background: var(--lh-border-accent);
}

.lh-logo-mark {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  font-weight: 500;
  color: var(--lh-accent-green);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 20px;
  padding: 6px 14px;
  border: 1px solid rgba(34, 211, 126, 0.2);
  border-radius: 20px;
  background: var(--lh-accent-green-dim);
}

.lh-logo-mark .dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--lh-accent-green);
  animation: lh-pulse 2s ease-in-out infinite;
}

@keyframes lh-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

.lh-header h1 {
  font-family: 'JetBrains Mono', monospace;
  font-size: 28px; font-weight: 700;
  color: var(--lh-text); letter-spacing: -0.02em; margin-bottom: 10px;
}
.lh-header h1 span { color: var(--lh-accent-green); }

.lh-header p {
  font-size: 13px; color: var(--lh-text-muted);
  line-height: 1.6; max-width: 500px; margin: 0 auto;
}

/* ── Flow connector ── */
.lh-flow-connector {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0;
  position: relative;
  height: 80px;
  opacity: 0;
  transition: opacity 0.3s;
}
.lh-flow-connector.visible { opacity: 1; }

.lh-flow-pipe {
  width: 2px; height: 50px;
  background: var(--lh-border);
  position: relative;
  overflow: hidden;
  border-radius: 1px;
}

.lh-flow-pipe-fill {
  position: absolute; top: 0; left: 0;
  width: 100%; height: 0%;
  border-radius: 1px;
}

.lh-connector--1 .lh-flow-pipe-fill {
  background: linear-gradient(to bottom, var(--lh-accent-green), var(--lh-accent-blue));
  box-shadow: 0 0 8px var(--lh-accent-green);
}
.lh-connector--2 .lh-flow-pipe-fill {
  background: linear-gradient(to bottom, var(--lh-accent-blue), var(--lh-accent-purple));
  box-shadow: 0 0 8px var(--lh-accent-blue);
}

.lh-flow-particle {
  position: absolute;
  width: 6px; height: 6px;
  border-radius: 50%;
  left: 50%; transform: translateX(-50%);
  opacity: 0;
  pointer-events: none;
}

.lh-connector--1 .lh-flow-particle {
  background: var(--lh-accent-green);
  box-shadow: 0 0 12px var(--lh-accent-green), 0 0 24px rgba(34, 211, 126, 0.3);
}
.lh-connector--2 .lh-flow-particle {
  background: var(--lh-accent-blue);
  box-shadow: 0 0 12px var(--lh-accent-blue), 0 0 24px rgba(59, 130, 246, 0.3);
}

.lh-flow-arrow {
  width: 0; height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  margin-top: 4px;
  opacity: 0; transform: scale(0);
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.lh-connector--1 .lh-flow-arrow { border-top: 8px solid var(--lh-accent-blue); }
.lh-connector--2 .lh-flow-arrow { border-top: 8px solid var(--lh-accent-purple); }
.lh-flow-arrow.visible { opacity: 1; transform: scale(1); }

.lh-flow-label {
  font-size: 10px; color: var(--lh-text-dim);
  letter-spacing: 0.12em; text-transform: uppercase;
  margin-top: 2px; opacity: 0; transition: opacity 0.4s;
}
.lh-flow-label.visible { opacity: 1; }

/* ── Block shared ── */
.lh-block {
  border: 1px solid var(--lh-border);
  border-radius: var(--lh-radius);
  background: var(--lh-bg-card);
  position: relative; overflow: hidden;
  opacity: 0;
  transform: translateY(24px) scale(0.97);
  transition: all 0.7s cubic-bezier(0.16, 1, 0.3, 1),
              box-shadow 0.4s, border-color 0.4s;
}
.lh-block.visible { opacity: 1; transform: translateY(0) scale(1); }

.lh-block--source.active-glow {
  box-shadow: 0 0 40px rgba(34, 211, 126, 0.15), 0 0 80px rgba(34, 211, 126, 0.05);
  border-color: rgba(34, 211, 126, 0.35);
}
.lh-block--compile.active-glow {
  box-shadow: 0 0 40px rgba(59, 130, 246, 0.15), 0 0 80px rgba(59, 130, 246, 0.05);
  border-color: rgba(59, 130, 246, 0.35);
}
.lh-block--output.active-glow {
  box-shadow: 0 0 40px rgba(168, 85, 247, 0.15), 0 0 80px rgba(168, 85, 247, 0.05);
  border-color: rgba(168, 85, 247, 0.35);
}

.lh-block--source.settled { box-shadow: 0 0 30px rgba(34, 211, 126, 0.08); border-color: rgba(34, 211, 126, 0.15); }
.lh-block--compile.settled { box-shadow: 0 0 30px rgba(59, 130, 246, 0.08); border-color: rgba(59, 130, 246, 0.15); }
.lh-block--output.settled { box-shadow: 0 0 30px rgba(168, 85, 247, 0.08); border-color: rgba(168, 85, 247, 0.15); }

.lh-block-header {
  display: flex; align-items: center; gap: 10px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--lh-border);
}

.lh-block-number {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px; font-weight: 600;
  width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 6px; flex-shrink: 0;
}

.lh-block-title { font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 600; }
.lh-block-subtitle { font-size: 11px; color: var(--lh-text-muted); margin-left: auto; }
.lh-block-body { padding: 20px; }

.lh-block--source .lh-block-number { background: var(--lh-accent-green-dim); color: var(--lh-accent-green); border: 1px solid rgba(34, 211, 126, 0.2); }
.lh-block--source .lh-block-title { color: var(--lh-accent-green); }

.lh-dir-tree { font-family: 'JetBrains Mono', monospace; font-size: 13px; line-height: 2; }
.lh-dir-tree .folder { color: var(--lh-accent-green); }
.lh-dir-tree .file {
  color: var(--lh-text-muted); padding-left: 24px;
  display: flex; align-items: center; gap: 8px;
  opacity: 0; transform: translateX(-12px);
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.lh-dir-tree .file.visible { opacity: 1; transform: translateX(0); }
.lh-dir-tree .file::before { content: ''; width: 12px; height: 1px; background: var(--lh-border-accent); flex-shrink: 0; }
.lh-file-icon { color: var(--lh-accent-amber); font-size: 11px; flex-shrink: 0; }

.lh-block--compile .lh-block-number { background: var(--lh-accent-blue-dim); color: var(--lh-accent-blue); border: 1px solid rgba(59, 130, 246, 0.2); }
.lh-block--compile .lh-block-title { color: var(--lh-accent-blue); }

.lh-terminal {
  background: #0d0d14; border: 1px solid var(--lh-border);
  border-radius: 8px; overflow: hidden; margin-bottom: 16px;
}
.lh-terminal-bar {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 14px; background: rgba(255,255,255,0.02);
  border-bottom: 1px solid var(--lh-border);
}
.lh-terminal-dot { width: 8px; height: 8px; border-radius: 50%; }
.lh-terminal-dot--red { background: #f43f5e; }
.lh-terminal-dot--yellow { background: #f59e0b; }
.lh-terminal-dot--green { background: #22d37e; }
.lh-terminal-title { font-size: 10px; color: var(--lh-text-dim); margin-left: 8px; }
.lh-terminal-body {
  padding: 16px; font-family: 'JetBrains Mono', monospace;
  font-size: 13px; line-height: 1.7; min-height: 160px;
}

.lh-term-line {
  opacity: 0; transform: translateY(4px);
  transition: all 0.3s ease-out; overflow: hidden;
}
.lh-term-line.visible { opacity: 1; transform: translateY(0); }

.lh-terminal-prompt { color: var(--lh-accent-green); }
.lh-terminal-cmd { color: var(--lh-text); }
.lh-terminal-flag { color: var(--lh-accent-amber); }
.lh-terminal-comment { color: var(--lh-text-dim); font-style: italic; }
.lh-terminal-success { color: var(--lh-accent-green); font-size: 12px; }

.lh-typewriter-cursor {
  display: inline-block; width: 8px; height: 15px;
  background: var(--lh-accent-green);
  margin-left: 2px; vertical-align: middle;
  animation: lh-blink 0.8s step-end infinite;
}
@keyframes lh-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

.lh-bridges { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.lh-bridge {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 12px 8px;
  background: rgba(59, 130, 246, 0.04); border: 1px solid rgba(59, 130, 246, 0.08);
  border-radius: 8px; text-align: center;
  opacity: 0; transform: scale(0.8);
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.lh-bridge.visible { opacity: 1; transform: scale(1); }
.lh-bridge-icon { font-size: 16px; }
.lh-bridge-label { font-size: 10px; color: var(--lh-text-muted); }
.lh-bridge-arrow { font-size: 10px; color: var(--lh-accent-blue); }

.lh-block--output .lh-block-number { background: var(--lh-accent-purple-dim); color: var(--lh-accent-purple); border: 1px solid rgba(168, 85, 247, 0.2); }
.lh-block--output .lh-block-title { color: var(--lh-accent-purple); }

.lh-outputs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.lh-output-card {
  background: rgba(168, 85, 247, 0.03); border: 1px solid rgba(168, 85, 247, 0.1);
  border-radius: 8px; padding: 16px 12px; text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  opacity: 0; transform: translateY(16px) scale(0.9);
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.lh-output-card.visible { opacity: 1; transform: translateY(0) scale(1); }
.lh-output-card:hover { border-color: rgba(168, 85, 247, 0.25); background: rgba(168, 85, 247, 0.06); }

.lh-output-icon {
  width: 40px; height: 40px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.lh-output-icon svg { width: 22px; height: 22px; }
.lh-output-icon--claude { background: linear-gradient(135deg, #D97757, #c4632a); }
.lh-output-icon--claude svg { fill: #fff; }
.lh-output-icon--cursor { background: linear-gradient(135deg, #2a2a2a, #111); border: 1px solid #444; }
.lh-output-icon--cursor svg { fill: #fff; }
.lh-output-icon--gemini { background: linear-gradient(135deg, #6e5fa0, #8E75B2); }
.lh-output-icon--gemini svg { fill: #fff; }

.lh-output-file { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--lh-text); word-break: break-all; line-height: 1.4; }
.lh-output-editor { font-size: 10px; color: var(--lh-text-dim); letter-spacing: 0.06em; }

.lh-modes-bar {
  display: flex; gap: 12px; margin-top: 16px; justify-content: center;
  opacity: 0; transition: opacity 0.5s;
}
.lh-modes-bar.visible { opacity: 1; }

.lh-mode-badge {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: 'JetBrains Mono', monospace; font-size: 10px;
  padding: 5px 12px; border-radius: 20px;
  border: 1px solid var(--lh-border); color: var(--lh-text-muted);
  background: rgba(255,255,255,0.02);
}
.lh-mode-badge .icon { font-size: 12px; }

.lh-presets-section {
  margin-top: 48px; opacity: 0; transform: translateY(20px);
  transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}
.lh-presets-section.visible { opacity: 1; transform: translateY(0); }

.lh-presets-connector { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.lh-presets-line { flex: 1; height: 1px; background: var(--lh-border-accent); }
.lh-presets-label {
  font-family: 'JetBrains Mono', monospace; font-size: 11px;
  color: var(--lh-text-dim); letter-spacing: 0.08em; text-transform: uppercase;
  white-space: nowrap; display: flex; align-items: center; gap: 8px;
}

.lh-presets-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.lh-preset {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px; background: var(--lh-bg-card);
  border: 1px solid var(--lh-border); border-radius: 8px;
  font-family: 'JetBrains Mono', monospace; font-size: 12px;
  color: var(--lh-text-muted); cursor: default;
  opacity: 0; transform: translateY(10px);
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.lh-preset.visible { opacity: 1; transform: translateY(0); }
.lh-preset:hover { border-color: var(--lh-border-accent); color: var(--lh-text); background: var(--lh-bg-card-hover); }

.lh-preset-dot { width: 6px; height: 6px; border-radius: 2px; flex-shrink: 0; }
.lh-preset:nth-child(1) .lh-preset-dot { background: var(--lh-accent-blue); }
.lh-preset:nth-child(2) .lh-preset-dot { background: var(--lh-accent-cyan); }
.lh-preset:nth-child(3) .lh-preset-dot { background: var(--lh-accent-amber); }
.lh-preset:nth-child(4) .lh-preset-dot { background: var(--lh-accent-rose); }
.lh-preset:nth-child(5) .lh-preset-dot { background: var(--lh-accent-purple); }
.lh-preset:nth-child(6) .lh-preset-dot { background: var(--lh-accent-green); }

.lh-presets-hint {
  text-align: center; margin-top: 12px;
  font-size: 11px; color: var(--lh-text-dim); font-style: italic;
  opacity: 0; transition: opacity 0.5s;
}
.lh-presets-hint.visible { opacity: 1; }

.lh-doctor-bar {
  margin-top: 40px; display: flex; align-items: center; justify-content: center;
  gap: 12px; padding: 14px 20px;
  background: rgba(34, 211, 126, 0.03);
  border: 1px dashed rgba(34, 211, 126, 0.15); border-radius: 8px;
  opacity: 0; transform: translateY(16px);
  transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.lh-doctor-bar.visible { opacity: 1; transform: translateY(0); }
.lh-doctor-icon { font-size: 16px; }
.lh-doctor-text { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--lh-text-muted); }
.lh-doctor-text code { color: var(--lh-accent-green); background: var(--lh-accent-green-dim); padding: 2px 6px; border-radius: 4px; }

.lh-notes { margin-top: 32px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.lh-note {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 10px 12px; background: rgba(255,255,255,0.01);
  border: 1px solid var(--lh-border); border-radius: 6px;
  font-size: 11px; color: var(--lh-text-dim); line-height: 1.5;
  opacity: 0; transform: translateY(10px);
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.lh-note.visible { opacity: 1; transform: translateY(0); }
.lh-note-icon { flex-shrink: 0; font-size: 12px; margin-top: 1px; }
.lh-note code { color: var(--lh-text-muted); background: rgba(255,255,255,0.04); padding: 1px 4px; border-radius: 3px; font-size: 10px; }

.lh-links-bar {
  margin-top: 40px;
  display: flex;
  justify-content: center;
  gap: 24px;
}

.lh-link-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  color: var(--lh-text-dim);
  padding: 12px 20px;
  border-radius: 10px;
  border: 1px solid transparent;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  opacity: 0;
  transform: translateY(12px);
}
.lh-link-icon.visible {
  opacity: 1;
  transform: translateY(0);
}

.lh-link-icon svg {
  width: 22px; height: 22px;
  fill: var(--lh-text-dim);
  transition: fill 0.25s, transform 0.25s;
}

.lh-link-icon span {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  transition: color 0.25s;
}

.lh-link-icon:hover {
  border-color: var(--lh-border-accent);
  background: rgba(255,255,255,0.02);
}
.lh-link-icon:hover svg { transform: scale(1.15); }

.lh-link-icon[data-link="0"]:hover svg { fill: #e0e0e8; }
.lh-link-icon[data-link="0"]:hover span { color: #e0e0e8; }
.lh-link-icon[data-link="1"]:hover svg { fill: #CB3837; }
.lh-link-icon[data-link="1"]:hover span { color: #CB3837; }
.lh-link-icon[data-link="2"]:hover svg { fill: var(--lh-accent-green); }
.lh-link-icon[data-link="2"]:hover span { color: var(--lh-accent-green); }

.lh-footer {
  margin-top: 24px; text-align: center;
  padding-top: 24px; border-top: 1px solid var(--lh-border);
  opacity: 0; transition: opacity 0.5s;
}
.lh-footer.visible { opacity: 1; }
.lh-footer-text { font-size: 11px; color: var(--lh-text-dim); letter-spacing: 0.04em; }

.lh-replay-btn {
  position: fixed; bottom: 24px; right: 24px;
  display: flex; align-items: center; gap: 8px;
  padding: 10px 18px; background: var(--lh-bg-card);
  border: 1px solid var(--lh-border-accent); border-radius: 8px;
  color: var(--lh-text-muted); font-family: 'JetBrains Mono', monospace;
  font-size: 12px; cursor: pointer;
  transition: all 0.2s; z-index: 100;
  opacity: 0; pointer-events: none;
}
.lh-replay-btn.visible { opacity: 1; pointer-events: auto; }
.lh-replay-btn:hover { border-color: var(--lh-accent-green); color: var(--lh-accent-green); background: var(--lh-accent-green-dim); }

@media (max-width: 640px) {
  .landing-canvas { padding: 40px 16px 60px; }
  .lh-header h1 { font-size: 22px; }
  .lh-outputs { grid-template-columns: 1fr; gap: 10px; }
  .lh-bridges { grid-template-columns: 1fr; }
  .lh-presets-grid { grid-template-columns: repeat(2, 1fr); }
  .lh-notes { grid-template-columns: 1fr; }
}
`;

/* ── Terminal lines data ────────────────────────────────────────────── */

const TERMINAL_LINES = [
  { html: '<span class="lh-terminal-prompt">$</span> <span class="lh-terminal-cmd">npx dev-workflows compile</span>', typewrite: true },
  { html: '<span class="lh-terminal-comment"># --mode=copy  \u2192 generates files</span>', delay: 100 },
  { html: '<span class="lh-terminal-comment"># --mode=link  \u2192 creates symlinks</span>', delay: 50 },
  { spacer: true },
  { html: '<span class="lh-terminal-prompt">$</span> <span class="lh-terminal-cmd">npx dev-workflows compile</span> <span class="lh-terminal-flag">--mode=copy</span>', typewrite: true },
  { spacer: true },
  { html: '<span class="lh-terminal-success">\u2713 CLAUDE.md generated</span>', delay: 200 },
  { html: '<span class="lh-terminal-success">\u2713 .cursor/rules/devworkflows.mdc generated</span>', delay: 200 },
  { html: '<span class="lh-terminal-success">\u2713 GEMINI.md generated</span>', delay: 200 },
];

/* ── Animation helpers ──────────────────────────────────────────────── */

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function animatePipe(pipeEl, duration) {
  return new Promise((resolve) => {
    let start = null;
    (function step(ts) {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      pipeEl.style.height = (p * 100) + '%';
      p < 1 ? requestAnimationFrame(step) : resolve();
    })(performance.now());
  });
}

function animateParticle(particleEl, pipeContainer, duration) {
  return new Promise((resolve) => {
    const h = pipeContainer.offsetHeight;
    const top = pipeContainer.offsetTop;
    particleEl.style.opacity = '1';
    let start = null;
    (function step(ts) {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      particleEl.style.top = (top + eased * h - 3) + 'px';
      if (p < 1) { requestAnimationFrame(step); }
      else { particleEl.style.opacity = '0'; resolve(); }
    })(performance.now());
  });
}

function mapTextToHtml(html, textIdx) {
  let ti = 0, inTag = false;
  for (let i = 0; i < html.length; i++) {
    if (html[i] === '<') { inTag = true; continue; }
    if (html[i] === '>') { inTag = false; continue; }
    if (!inTag) { if (ti === textIdx) return i; ti++; }
  }
  return html.length;
}

async function typewriteLine(container, htmlContent, speed = 18) {
  const temp = document.createElement('div');
  temp.innerHTML = htmlContent;
  const plainText = temp.textContent;

  const lineEl = document.createElement('div');
  lineEl.className = 'lh-term-line visible';
  container.appendChild(lineEl);

  for (let i = 0; i <= plainText.length; i++) {
    const htmlIdx = mapTextToHtml(htmlContent, i);
    lineEl.innerHTML = htmlContent.substring(0, htmlIdx) + '<span class="lh-typewriter-cursor"></span>';
    await wait(speed);
  }
  lineEl.innerHTML = htmlContent;
}

function addTermLine(container, html) {
  const el = document.createElement('div');
  el.className = 'lh-term-line';
  el.innerHTML = html;
  container.appendChild(el);
  void el.offsetHeight;
  el.classList.add('visible');
}

/* ── Component ──────────────────────────────────────────────────────── */

export const LandingHero = () => {
  const rootRef = useRef(null);
  const runningRef = useRef(false);

  const $ = (sel) => rootRef.current?.querySelector(sel);
  const $$ = (sel) => rootRef.current?.querySelectorAll(sel) ?? [];

  const resetAll = () => {
    rootRef.current?.querySelectorAll('.visible, .active-glow, .settled').forEach((el) => {
      el.classList.remove('visible', 'active-glow', 'settled');
    });
    const pipe1 = $('#pipe1');
    const pipe2 = $('#pipe2');
    if (pipe1) pipe1.style.height = '0%';
    if (pipe2) pipe2.style.height = '0%';
    ['particle1', 'particle2'].forEach((id) => {
      const el = $('#' + id);
      if (el) { el.style.opacity = '0'; el.style.top = '0'; }
    });
    const termBody = $('#terminal-body');
    if (termBody) termBody.innerHTML = '';
  };

  const runAnimation = async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    const replayBtn = $('#replay-btn');
    if (replayBtn) replayBtn.classList.remove('visible');
    resetAll();
    await wait(300);

    // Header
    $('#header')?.classList.add('visible');
    await wait(600);

    // Block 1
    const b1 = $('#block1');
    b1?.classList.add('visible');
    await wait(300);
    b1?.classList.add('active-glow');
    for (const f of $$('.lh-dir-tree .file')) {
      f.classList.add('visible');
      await wait(120);
    }
    await wait(400);
    b1?.classList.remove('active-glow');
    b1?.classList.add('settled');

    // Connector 1
    $('#connector1')?.classList.add('visible');
    await wait(100);
    await Promise.all([
      animatePipe($('#pipe1'), 500),
      animateParticle($('#particle1'), $('#connector1 .lh-flow-pipe'), 600),
    ]);
    $('#arrow1')?.classList.add('visible');
    $('#label1')?.classList.add('visible');
    await wait(200);

    // Block 2
    const b2 = $('#block2');
    b2?.classList.add('visible');
    await wait(300);
    b2?.classList.add('active-glow');

    const termBody = $('#terminal-body');
    if (termBody) {
      for (const line of TERMINAL_LINES) {
        if (line.spacer) {
          const s = document.createElement('div');
          s.style.height = '6px';
          termBody.appendChild(s);
          continue;
        }
        if (line.typewrite) {
          await typewriteLine(termBody, line.html, 18);
          await wait(200);
        } else {
          await wait(line.delay || 100);
          addTermLine(termBody, line.html);
        }
      }
    }
    await wait(300);

    for (const b of $$('.lh-bridge')) {
      b.classList.add('visible');
      await wait(150);
    }
    await wait(400);
    b2?.classList.remove('active-glow');
    b2?.classList.add('settled');

    // Connector 2
    $('#connector2')?.classList.add('visible');
    await wait(100);
    await Promise.all([
      animatePipe($('#pipe2'), 500),
      animateParticle($('#particle2'), $('#connector2 .lh-flow-pipe'), 600),
    ]);
    $('#arrow2')?.classList.add('visible');
    $('#label2')?.classList.add('visible');
    await wait(200);

    // Block 3
    const b3 = $('#block3');
    b3?.classList.add('visible');
    await wait(300);
    b3?.classList.add('active-glow');
    for (const o of $$('.lh-output-card')) {
      o.classList.add('visible');
      await wait(200);
    }
    await wait(200);
    $('#modes-bar')?.classList.add('visible');
    await wait(300);
    b3?.classList.remove('active-glow');
    b3?.classList.add('settled');

    // Presets
    $('#presets-section')?.classList.add('visible');
    await wait(300);
    for (const p of $$('.lh-preset')) {
      p.classList.add('visible');
      await wait(80);
    }
    await wait(200);
    $('#presets-hint')?.classList.add('visible');

    // Doctor + notes + links + footer
    await wait(300);
    $('#doctor-bar')?.classList.add('visible');
    await wait(300);
    for (const n of $$('.lh-note')) {
      n.classList.add('visible');
      await wait(100);
    }
    await wait(300);
    for (const l of $$('.lh-link-icon')) {
      l.classList.add('visible');
      await wait(120);
    }
    await wait(200);
    $('#footer')?.classList.add('visible');

    await wait(500);
    if (replayBtn) replayBtn.classList.add('visible');
    runningRef.current = false;
  };

  const handleReplay = () => {
    if (runningRef.current) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(runAnimation, 400);
  };

  useEffect(() => {
    const style = document.createElement('style');
    style.setAttribute('data-landing-hero', '');
    style.textContent = CSS;
    document.head.appendChild(style);

    const timer = setTimeout(runAnimation, 300);

    return () => {
      clearTimeout(timer);
      style.remove();
    };
  }, []);

  return (
    <div ref={rootRef} className="landing-wrapper">
      <div className="landing-canvas">

        {/* ── Header ── */}
        <div className="lh-header" id="header">
          <div className="lh-logo-mark"><span className="dot"></span> dev-workflows</div>
          <h1>Write once, <span>run everywhere</span></h1>
          <p>A single source of truth for your development rules. Compile to any AI editor.</p>
        </div>

        {/* ── Block 1: Source ── */}
        <div className="lh-block lh-block--source" id="block1">
          <div className="lh-block-header">
            <div className="lh-block-number">1</div>
            <div className="lh-block-title">Source of Truth</div>
            <div className="lh-block-subtitle">.dwf/rules/</div>
          </div>
          <div className="lh-block-body">
            <div className="lh-dir-tree">
              <div className="folder">{'\uD83D\uDCC1'} .dwf/rules/</div>
              <div className="file"><span className="lh-file-icon">{'\u2699'}</span> architecture.yml</div>
              <div className="file"><span className="lh-file-icon">{'\uD83D\uDCD0'}</span> conventions.yml</div>
              <div className="file"><span className="lh-file-icon">{'\uD83D\uDD12'}</span> security.yml</div>
              <div className="file"><span className="lh-file-icon">{'\uD83E\uDDEA'}</span> testing.yml</div>
              <div className="file"><span className="lh-file-icon">{'\uD83D\uDD04'}</span> workflow.yml</div>
            </div>
          </div>
        </div>

        {/* ── Connector 1 ── */}
        <div className="lh-flow-connector lh-connector--1" id="connector1">
          <div className="lh-flow-pipe"><div className="lh-flow-pipe-fill" id="pipe1"></div></div>
          <div className="lh-flow-particle" id="particle1"></div>
          <div className="lh-flow-arrow" id="arrow1"></div>
          <div className="lh-flow-label" id="label1">yaml → compile</div>
        </div>

        {/* ── Block 2: Compile ── */}
        <div className="lh-block lh-block--compile" id="block2">
          <div className="lh-block-header">
            <div className="lh-block-number">2</div>
            <div className="lh-block-title">Compile</div>
            <div className="lh-block-subtitle">bridge / adapter</div>
          </div>
          <div className="lh-block-body">
            <div className="lh-terminal">
              <div className="lh-terminal-bar">
                <span className="lh-terminal-dot lh-terminal-dot--red"></span>
                <span className="lh-terminal-dot lh-terminal-dot--yellow"></span>
                <span className="lh-terminal-dot lh-terminal-dot--green"></span>
                <span className="lh-terminal-title">terminal</span>
              </div>
              <div className="lh-terminal-body" id="terminal-body"></div>
            </div>
            <div className="lh-bridges">
              <div className="lh-bridge"><div className="lh-bridge-icon">{'\uD83D\uDD0C'}</div><div className="lh-bridge-label">Bridge</div><div className="lh-bridge-arrow">{'\u2192'} Claude</div></div>
              <div className="lh-bridge"><div className="lh-bridge-icon">{'\uD83D\uDD0C'}</div><div className="lh-bridge-label">Bridge</div><div className="lh-bridge-arrow">{'\u2192'} Cursor</div></div>
              <div className="lh-bridge"><div className="lh-bridge-icon">{'\uD83D\uDD0C'}</div><div className="lh-bridge-label">Bridge</div><div className="lh-bridge-arrow">{'\u2192'} Gemini</div></div>
            </div>
          </div>
        </div>

        {/* ── Connector 2 ── */}
        <div className="lh-flow-connector lh-connector--2" id="connector2">
          <div className="lh-flow-pipe"><div className="lh-flow-pipe-fill" id="pipe2"></div></div>
          <div className="lh-flow-particle" id="particle2"></div>
          <div className="lh-flow-arrow" id="arrow2"></div>
          <div className="lh-flow-label" id="label2">output × 3</div>
        </div>

        {/* ── Block 3: Output ── */}
        <div className="lh-block lh-block--output" id="block3">
          <div className="lh-block-header">
            <div className="lh-block-number">3</div>
            <div className="lh-block-title">Output</div>
            <div className="lh-block-subtitle">editor-specific files</div>
          </div>
          <div className="lh-block-body">
            <div className="lh-outputs">
              <div className="lh-output-card">
                <div className="lh-output-icon lh-output-icon--claude">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" /></svg>
                </div>
                <div className="lh-output-file">CLAUDE.md</div>
                <div className="lh-output-editor">Claude Code</div>
              </div>
              <div className="lh-output-card">
                <div className="lh-output-icon lh-output-icon--cursor">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23" /></svg>
                </div>
                <div className="lh-output-file">.cursor/rules/<wbr />devworkflows.mdc</div>
                <div className="lh-output-editor">Cursor</div>
              </div>
              <div className="lh-output-card">
                <div className="lh-output-icon lh-output-icon--gemini">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81" /></svg>
                </div>
                <div className="lh-output-file">GEMINI.md</div>
                <div className="lh-output-editor">Gemini CLI</div>
              </div>
            </div>
            <div className="lh-modes-bar" id="modes-bar">
              <span className="lh-mode-badge"><span className="icon">{'\uD83D\uDCC4'}</span> copy mode</span>
              <span className="lh-mode-badge"><span className="icon">{'\uD83D\uDD17'}</span> link mode</span>
              <span className="lh-mode-badge"><span className="icon">{'\uD83C\uDFF7\uFE0F'}</span> BEGIN/END markers</span>
            </div>
          </div>
        </div>

        {/* ── Presets ── */}
        <div className="lh-presets-section" id="presets-section">
          <div className="lh-presets-connector">
            <div className="lh-presets-line"></div>
            <div className="lh-presets-label"><span>{'\uD83E\uDDE9'}</span> Precooked Presets {'\u2192'} plug into .dwf/rules/</div>
            <div className="lh-presets-line"></div>
          </div>
          <div className="lh-presets-grid">
            <div className="lh-preset"><span className="lh-preset-dot"></span>typescript-strict</div>
            <div className="lh-preset"><span className="lh-preset-dot"></span>react-conventions</div>
            <div className="lh-preset"><span className="lh-preset-dot"></span>nextjs-approuter</div>
            <div className="lh-preset"><span className="lh-preset-dot"></span>tailwind</div>
            <div className="lh-preset"><span className="lh-preset-dot"></span>testing-basics</div>
            <div className="lh-preset"><span className="lh-preset-dot"></span>supabase-rls</div>
          </div>
          <div className="lh-presets-hint" id="presets-hint">npx dev-workflows add typescript-strict</div>
        </div>

        {/* ── Doctor ── */}
        <div className="lh-doctor-bar" id="doctor-bar">
          <span className="lh-doctor-icon">{'\uD83E\uDE7A'}</span>
          <span className="lh-doctor-text"><code>devw doctor</code> — validates source and outputs are in sync</span>
        </div>

        {/* ── Notes ── */}
        <div className="lh-notes">
          <div className="lh-note"><span className="lh-note-icon">{'\uD83D\uDCCC'}</span> Bridges only <strong>translate</strong> format — no new logic added</div>
          <div className="lh-note"><span className="lh-note-icon">{'\uD83D\uDCCC'}</span> Manual content protected by <code>BEGIN/END</code> markers</div>
          <div className="lh-note"><span className="lh-note-icon">{'\uD83D\uDCCC'}</span> Config dir: <code>.dwf/</code> — YAML source format</div>
          <div className="lh-note"><span className="lh-note-icon">{'\uD83D\uDCCC'}</span> <code>--mode=link</code> creates symlinks for auto-sync</div>
        </div>

        {/* ── Links ── */}
        <div className="lh-links-bar" id="links-bar">
          <a href="https://github.com/gpolanco/dev-workflows" className="lh-link-icon" title="GitHub" data-link="0">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>
            <span>GitHub</span>
          </a>
          <a href="https://www.npmjs.com/package/dev-workflows" className="lh-link-icon" title="npm" data-link="1">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113z" /></svg>
            <span>npm</span>
          </a>
          <a href="/quickstart" className="lh-link-icon" title="Docs" data-link="2">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 2l5 5h-5V4zM6 20V4h5v7h7v9H6zm2-6h8v1.5H8V14zm0-3h8v1.5H8V11zm0 6h5v1.5H8V17z" /></svg>
            <span>Docs</span>
          </a>
        </div>

        {/* ── Footer ── */}
        <div className="lh-footer" id="footer">
          <div className="lh-footer-text">dev-workflows · Write rules once, ship to every AI editor</div>
        </div>

      </div>

      <button className="lh-replay-btn" id="replay-btn" onClick={handleReplay}>↻ Replay</button>
    </div>
  );
};

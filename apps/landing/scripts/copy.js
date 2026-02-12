// ── Copy install command ──
function copyInstall(el) {
  navigator.clipboard.writeText('npx dev-workflows init');
  trackEvent('copy_command', { command: 'npx dev-workflows init', location: 'hero' });
  const orig = el.textContent || el.innerText;
  if (el.classList.contains('btn-ghost')) {
    const origHTML = el.innerHTML;
    el.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Copied!';
    setTimeout(() => { el.innerHTML = origHTML; }, 1500);
  }
}

function copyBlock(btn, text) {
  navigator.clipboard.writeText(text);
  trackEvent('copy_command', { command: text, location: 'registry' });
  btn.classList.add('copied');
  setTimeout(() => btn.classList.remove('copied'), 1500);
}

function copyCta(el) {
  navigator.clipboard.writeText('npx dev-workflows init');
  trackEvent('copy_command', { command: 'npx dev-workflows init', location: 'cta_bottom' });
  el.classList.add('copied');
  setTimeout(() => el.classList.remove('copied'), 1500);
}

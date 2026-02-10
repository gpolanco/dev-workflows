// ── Analytics: GA4 event helper ──
function trackEvent(event, params) {
  if (typeof gtag === 'function') {
    gtag('event', event, params);
  }
}

// ── Scroll depth tracking ──
const scrollTracked = {};
const scrollObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting && !scrollTracked[e.target.id]) {
      scrollTracked[e.target.id] = true;
      trackEvent('section_view', { section: e.target.id });
    }
  });
}, { threshold: 0.3 });

document.querySelectorAll('section[id]').forEach(s => scrollObs.observe(s));

// ── Playground edit tracking (debounced) ──
let editTimer;
const sourceEditor = document.getElementById('sourceEditor');
if (sourceEditor) {
  sourceEditor.addEventListener('input', function() {
    clearTimeout(editTimer);
    editTimer = setTimeout(() => {
      trackEvent('playground_edit', { action: 'yaml_edited' });
    }, 2000);
  });
}

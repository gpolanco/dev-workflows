// ── Scroll reveal ──
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('vis'); });
}, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

// ── Compile Flow animation (auto-start after hero entrance) ──
const cfVisual = document.getElementById('cf-visual');
setTimeout(() => {
  cfVisual.classList.add('animate');
  const targets = cfVisual.querySelectorAll('.cf-target');
  targets.forEach((t, i) => {
    setTimeout(() => t.classList.add('visible'), 300 + i * 250);
  });
}, 800);

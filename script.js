/* ─────────────────────────────────────────
   Shina - Global Scripts
   ───────────────────────────────────────── */

// ── CUSTOM CURSOR (used on all pages) ────
const cursor = document.getElementById('cursor')
cursor.innerHTML = '♥';

document.addEventListener('mousemove', (e) => {
  cursor.style.left = e.clientX + 'px'
  cursor.style.top = e.clientY + 'px'

  // Move tooltip if it exists (index page only)
  const tooltip = document.getElementById('tooltip')
  if (!tooltip) return

  const ttW = tooltip.offsetWidth
  const ttH = tooltip.offsetHeight
  let tx = e.clientX + 36
  let ty = e.clientY - ttH / 2

  // Flip left if near right edge
  if (tx + ttW > window.innerWidth - 20) tx = e.clientX - ttW - 36
  // Keep within vertical bounds
  if (ty < 10) ty = 10
  if (ty + ttH > window.innerHeight - 10) ty = window.innerHeight - ttH - 10

  tooltip.style.left = tx + 'px'
  tooltip.style.top = ty + 'px'
})

const portraitFrame = document.getElementById('portraitFrame');
const portraitVid = portraitFrame?.querySelector('.portrait-vid');

if (portraitFrame && portraitVid) {
  portraitFrame.addEventListener('mouseenter', () => {
    portraitVid.currentTime = 0;
    portraitVid.play();
  });
  portraitFrame.addEventListener('mouseleave', () => {
    portraitVid.pause();
  });
}


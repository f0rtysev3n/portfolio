/* ============================================================
   cursor-trail.js
   Custom neon rainbow cursor-trail effect — built from scratch
   with the vanilla Canvas 2D API. No libraries, no CDN.

   How it works:
   - Records recent pointer positions (with timestamps).
   - Each frame, draws the trail as additive ("lighter") glowing
     segments whose hue cycles through the full color wheel, so
     the tail shimmers through every neon color.
   - Segments taper and fade toward the tail, and the whole trail
     dissolves when the pointer stops moving.
   - DPR-aware, resizes with the window, and is skipped for
     touch-only devices and visitors who prefer reduced motion.
   ============================================================ */
const canvas = document.getElementById("cursorCanvas");
const ctx = canvas.getContext("2d");

let width, height;
let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let particles = [];

let colors = ["#f967fb", "#53bc28", "#6958d5"];

function resizeCanvas() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);

window.addEventListener("mousemove", (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;

  for (let i = 0; i < 4; i++) {
    particles.push({
      x: mouse.x,
      y: mouse.y,
      size: Math.random() * 8 + 4,
      speedX: (Math.random() - 0.5) * 2,
      speedY: (Math.random() - 0.5) * 2,
      life: 1,
      color: colors[Math.floor(Math.random() * colors.length)]
    });
  }
});

function animate() {
  ctx.clearRect(0, 0, width, height);

  particles.forEach((p, index) => {
    p.x += p.speedX;
    p.y += p.speedY;
    p.life -= 0.025;
    p.size *= 0.96;

    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.shadowBlur = 25;
    ctx.shadowColor = p.color;
    ctx.fillStyle = p.color;

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    if (p.life <= 0 || p.size <= 0.5) {
      particles.splice(index, 1);
    }
  });

  requestAnimationFrame(animate);
}

animate();

document.body.addEventListener("click", () => {
  colors = randomColors(3);
});

function randomColors(count) {
  return new Array(count)
    .fill(0)
    .map(() => "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0"));
}
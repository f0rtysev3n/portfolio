/* =====================================================================
   Neon Tubes Cursor — original Canvas implementation
   ---------------------------------------------------------------------
   Three glowing tubes weave and intertwine as they trail the pointer,
   converging at the cursor. Colors continuously cycle through the full
   spectrum, and every click randomizes the palette.
   Pure 2D canvas: no external libraries, lightweight, GitHub-Pages safe.
   ===================================================================== */
(function () {
	"use strict";

	var canvas = document.getElementById("cursor-trail");
	if (!canvas) return;

	// Respect accessibility + only run for real mouse pointers (not touch).
	if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
	if (window.matchMedia && !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

	var ctx = canvas.getContext("2d");
	if (!ctx) return;

	var dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
	var W = 0, H = 0;

	function resize() {
		W = window.innerWidth;
		H = window.innerHeight;
		canvas.width = Math.round(W * dpr);
		canvas.height = Math.round(H * dpr);
		canvas.style.width = W + "px";
		canvas.style.height = H + "px";
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}
	resize();
	window.addEventListener("resize", resize);

	/* ---------- Trail buffer ---------- */
	var points = [];            // { x, y, t }
	var MAX_POINTS = 70;        // tail length (resolution)
	var LIFE = 1100;            // ms before a point fully fades
	var lastX = null, lastY = null;

	function addPoint(x, y) {
		var now = performance.now();
		// Interpolate on fast moves so the tubes stay smooth and continuous.
		if (lastX !== null) {
			var dx = x - lastX, dy = y - lastY;
			var dist = Math.sqrt(dx * dx + dy * dy);
			var steps = Math.min(14, Math.floor(dist / 8));
			for (var s = 1; s <= steps; s++) {
				points.push({ x: lastX + (dx * s) / steps, y: lastY + (dy * s) / steps, t: now });
			}
		}
		points.push({ x: x, y: y, t: now });
		lastX = x;
		lastY = y;
		if (points.length > MAX_POINTS) points.splice(0, points.length - MAX_POINTS);
	}

	window.addEventListener("pointermove", function (e) {
		addPoint(e.clientX, e.clientY);
	}, { passive: true });

	/* ---------- Color state ---------- */
	// Three base hues spaced across the wheel; a global shift makes them
	// cycle through every color over time.
	var tubeHues = [195, 285, 330];
	var hueShift = 0;

	function randomizeHues() {
		for (var i = 0; i < tubeHues.length; i++) {
			tubeHues[i] = Math.floor(Math.random() * 360);
		}
	}
	// Click anywhere randomizes the palette (mirrors the reference behavior).
	window.addEventListener("pointerdown", randomizeHues, { passive: true });

	/* ---------- Render ---------- */
	var TUBES = 3;
	var BASE_WIDTH = 16;        // head thickness
	var MAX_AMP = 16;           // how far tubes weave apart at the tail
	var WAVES = 2.2;            // number of weave cycles along the trail
	var SPEED = 0.0042;         // weave animation speed
	var TWO_PI = Math.PI * 2;

	// width multiplier, lightness %, base alpha
	var PASSES = [
		{ w: 2.8, light: 55, alpha: 0.14 },  // soft outer glow
		{ w: 1.3, light: 60, alpha: 0.45 },  // tube body
		{ w: 0.5, light: 90, alpha: 0.95 }   // bright glossy core
	];

	function render() {
		ctx.clearRect(0, 0, W, H);

		var now = performance.now();
		while (points.length && now - points[0].t > LIFE) points.shift();

		if (points.length > 1) {
			hueShift = (hueShift + 0.35) % 360;

			ctx.globalCompositeOperation = "lighter"; // additive => neon glow
			ctx.lineCap = "round";
			ctx.lineJoin = "round";

			var len = points.length;

			for (var k = 0; k < TUBES; k++) {
				var hue = (tubeHues[k] + hueShift) % 360;
				var phaseOffset = (k * TWO_PI) / TUBES;

				for (var p = 0; p < PASSES.length; p++) {
					var pass = PASSES[p];

					for (var i = 1; i < len; i++) {
						var a0 = points[i - 1];
						var a1 = points[i];

						var along = i / (len - 1);            // 0 = tail, 1 = head
						var age = (now - a1.t) / LIFE;
						if (age > 1) age = 1;
						var fade = 1 - age;
						if (fade <= 0) continue;

						// Perpendicular to the local direction of travel.
						var tx = a1.x - a0.x, ty = a1.y - a0.y;
						var tl = Math.sqrt(tx * tx + ty * ty) || 1;
						var nx = -ty / tl, ny = tx / tl;

						// Weave amplitude shrinks to 0 at the head so all
						// tubes converge exactly on the cursor.
						var amp = MAX_AMP * (1 - along);
						var ph0 = ((i - 1) / len) * WAVES * TWO_PI + now * SPEED + phaseOffset;
						var ph1 = (i / len) * WAVES * TWO_PI + now * SPEED + phaseOffset;
						var o0 = Math.sin(ph0) * amp;
						var o1 = Math.sin(ph1) * amp;

						var x0 = a0.x + nx * o0, y0 = a0.y + ny * o0;
						var x1 = a1.x + nx * o1, y1 = a1.y + ny * o1;

						var width = BASE_WIDTH * (0.22 + 0.78 * along) * pass.w * fade;
						if (width < 0.35) continue;

						ctx.beginPath();
						ctx.moveTo(x0, y0);
						ctx.lineTo(x1, y1);
						ctx.lineWidth = width;
						ctx.strokeStyle = "hsla(" + hue + ", 100%, " + pass.light + "%, " + (pass.alpha * fade) + ")";
						ctx.stroke();
					}
				}
			}

			// Bright head orb where the tubes meet the cursor.
			var head = points[len - 1];
			var headHue = (tubeHues[0] + hueShift) % 360;
			ctx.beginPath();
			ctx.shadowColor = "hsla(" + headHue + ", 100%, 70%, 1)";
			ctx.shadowBlur = 40;
			ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
			ctx.arc(head.x, head.y, 7, 0, TWO_PI);
			ctx.fill();
			ctx.shadowBlur = 0;
		}

		ctx.globalCompositeOperation = "source-over";
		requestAnimationFrame(render);
	}

	requestAnimationFrame(render);
})();

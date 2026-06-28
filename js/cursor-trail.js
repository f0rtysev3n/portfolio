/* =====================================================================
   Tubes Cursor — original Canvas implementation (soft / comfortable)
   ---------------------------------------------------------------------
   A single smooth, glossy tube flows behind the pointer. It uses
   cylinder-style shading (darker edges + lighter centre) for a 3D look,
   a gentle soft glow, muted saturation, and a slow color flow so it is
   never harsh or uncomfortable to look at. Click softly shifts the hue.
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
	var MAX_POINTS = 64;        // tail length (resolution)
	var LIFE = 850;             // ms before a point fully fades
	var lastX = null, lastY = null;

	function addPoint(x, y) {
		var now = performance.now();
		// Interpolate on fast moves so the tube stays smooth and continuous.
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
	// A single base hue drifts slowly so the tube gently flows through the
	// spectrum. Saturation is kept muted for comfort. Click nudges the hue.
	var baseHue = 205;          // calm cyan/blue start
	var SAT = 70;               // muted saturation (not neon)
	var HUE_SPREAD = 60;        // subtle multi-color gradient along the tube

	window.addEventListener("pointerdown", function () {
		baseHue = (baseHue + 70 + Math.random() * 80) % 360;
	}, { passive: true });

	/* ---------- Render ---------- */
	var BASE_WIDTH = 22;        // head thickness
	var TWO_PI = Math.PI * 2;

	// Cylinder shading: dark rim -> mid body -> soft highlight centre.
	// width multiplier, lightness %, alpha. Drawn with normal blending so
	// overlaps never blow out to white.
	var PASSES = [
		{ w: 1.00, light: 34, alpha: 0.55 },  // outer rim (gives depth)
		{ w: 0.66, light: 50, alpha: 0.60 },  // tube body
		{ w: 0.30, light: 66, alpha: 0.50 }   // soft inner sheen
	];

	function render() {
		ctx.clearRect(0, 0, W, H);

		var now = performance.now();
		while (points.length && now - points[0].t > LIFE) points.shift();

		if (points.length > 1) {
			baseHue = (baseHue + 0.22) % 360; // slow, gentle color flow

			ctx.globalCompositeOperation = "source-over"; // no additive glare
			ctx.lineCap = "round";
			ctx.lineJoin = "round";

			var len = points.length;

			for (var p = 0; p < PASSES.length; p++) {
				var pass = PASSES[p];

				// One soft shadow on the body pass only = gentle glow, low cost.
				if (p === 1) {
					ctx.shadowColor = "hsla(" + Math.round(baseHue) + ", " + SAT + "%, 50%, 0.45)";
					ctx.shadowBlur = 14;
				} else {
					ctx.shadowBlur = 0;
				}

				for (var i = 1; i < len; i++) {
					var a0 = points[i - 1];
					var a1 = points[i];

					var along = i / (len - 1);        // 0 = tail, 1 = head
					var age = (now - a1.t) / LIFE;
					if (age > 1) age = 1;
					var fade = 1 - age;
					if (fade <= 0) continue;

					var width = BASE_WIDTH * (0.28 + 0.72 * along) * pass.w * fade;
					if (width < 0.4) continue;

					// Subtle hue gradient along the length (calmer than full rainbow).
					var segHue = (baseHue + (1 - along) * HUE_SPREAD) % 360;

					ctx.beginPath();
					ctx.moveTo(a0.x, a0.y);
					ctx.lineTo(a1.x, a1.y);
					ctx.lineWidth = width;
					ctx.strokeStyle = "hsla(" + Math.round(segHue) + ", " + SAT + "%, " + pass.light + "%, " + (pass.alpha * fade) + ")";
					ctx.stroke();
				}
			}

			ctx.shadowBlur = 0;
		}

		requestAnimationFrame(render);
	}

	requestAnimationFrame(render);
})();

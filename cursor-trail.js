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
(function () {
	"use strict";

	var canvas = document.getElementById("cursor-trail");
	if (!canvas) return;

	var mq = window.matchMedia;
	var reduceMotion = mq && mq("(prefers-reduced-motion: reduce)").matches;
	var finePointer = mq && mq("(hover: hover) and (pointer: fine)").matches;
	// A cursor tail only makes sense with a real pointer that can hover.
	if (reduceMotion || !finePointer) return;

	var ctx = canvas.getContext("2d");
	var w = 0, h = 0, dpr = 1;

	function resize() {
		dpr = Math.min(window.devicePixelRatio || 1, 2);
		w = window.innerWidth;
		h = window.innerHeight;
		canvas.width = Math.floor(w * dpr);
		canvas.height = Math.floor(h * dpr);
		canvas.style.width = w + "px";
		canvas.style.height = h + "px";
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}
	resize();
	window.addEventListener("resize", resize);

	var points = [];           // { x, y, t }
	var MAX_POINTS = 24;       // trail resolution
	var LIFE = 520;            // ms before a point fades out
	var hue = 0;               // global hue, advances every frame
	var lastX = null, lastY = null;

	function addPoint(x, y) {
		var now = performance.now();
		// Interpolate extra points on fast moves so the line stays smooth.
		if (lastX !== null) {
			var dx = x - lastX, dy = y - lastY;
			var dist = Math.sqrt(dx * dx + dy * dy);
			var steps = Math.min(6, Math.floor(dist / 16));
			for (var i = 1; i <= steps; i++) {
				points.push({
					x: lastX + (dx * i) / (steps + 1),
					y: lastY + (dy * i) / (steps + 1),
					t: now
				});
			}
		}
		points.push({ x: x, y: y, t: now });
		lastX = x;
		lastY = y;
		if (points.length > MAX_POINTS) {
			points.splice(0, points.length - MAX_POINTS);
		}
	}

	window.addEventListener(
		"pointermove",
		function (e) { addPoint(e.clientX, e.clientY); },
		{ passive: true }
	);

	// Forget the trail when the cursor leaves / the tab loses focus.
	function clearTrail() { points.length = 0; lastX = lastY = null; }
	window.addEventListener("blur", clearTrail);
	document.addEventListener("mouseleave", clearTrail);

	// Soft-wide glow first, then progressively tighter, brighter cores.
	var PASSES = [
		{ width: 20, blur: 30, alpha: 0.30 },
		{ width: 9,  blur: 18, alpha: 0.55 },
		{ width: 3.5, blur: 10, alpha: 0.95 }
	];

	function render() {
		var now = performance.now();
		while (points.length && now - points[0].t > LIFE) points.shift();

		ctx.clearRect(0, 0, w, h);

		if (points.length > 1) {
			hue = (hue + 6) % 360;
			ctx.globalCompositeOperation = "lighter";
			ctx.lineJoin = "round";
			ctx.lineCap = "round";

			for (var p = 0; p < PASSES.length; p++) {
				var pass = PASSES[p];
				for (var i = 1; i < points.length; i++) {
					var a = points[i - 1], b = points[i];
					var t = i / (points.length - 1);          // 0 = tail, 1 = head
					var fade = (now - b.t) / LIFE;
					fade = 1 - (fade < 0 ? 0 : fade > 1 ? 1 : fade);
					var segHue = (hue + (1 - t) * 200) % 360;  // full-spectrum spread
					var color = "hsla(" + segHue + ", 100%, 60%, ";

					ctx.strokeStyle = color + (pass.alpha * fade) + ")";
					ctx.shadowColor = color + fade + ")";
					ctx.shadowBlur = pass.blur;
					ctx.lineWidth = pass.width * t * fade + 0.4;

					ctx.beginPath();
					ctx.moveTo(a.x, a.y);
					ctx.lineTo(b.x, b.y);
					ctx.stroke();
				}
			}

			// Bright neon head.
			var head = points[points.length - 1];
			ctx.beginPath();
			ctx.fillStyle = "hsla(" + hue + ", 100%, 72%, 0.95)";
			ctx.shadowColor = "hsla(" + hue + ", 100%, 60%, 1)";
			ctx.shadowBlur = 26;
			ctx.arc(head.x, head.y, 3.5, 0, Math.PI * 2);
			ctx.fill();

			ctx.globalCompositeOperation = "source-over";
			ctx.shadowBlur = 0;
		}

		requestAnimationFrame(render);
	}

	requestAnimationFrame(render);
})();

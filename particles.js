/* ============================================================
   particles.js
   Self-contained animated particle network drawn on a canvas
   (vanilla replacement for particles.js). Connects nearby
   nodes with lines for a subtle "network" aesthetic.
   Pauses when the tab is hidden or reduced motion is on.
   ============================================================ */
(function () {
	"use strict";

	var canvas = document.getElementById("particles");
	if (!canvas) return;

	if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
		return; // keep things still for users who prefer reduced motion
	}

	var ctx = canvas.getContext("2d");
	var particles = [];
	var width = 0;
	var height = 0;
	var dpr = Math.min(window.devicePixelRatio || 1, 2);
	var rafId = null;
	var ACCENT = "0, 180, 255";

	function count() {
		// Scale particle count to viewport, capped for performance.
		return Math.min(Math.floor((width * height) / 16000), 90);
	}

	function resize() {
		width = window.innerWidth;
		height = window.innerHeight;
		canvas.width = width * dpr;
		canvas.height = height * dpr;
		canvas.style.width = width + "px";
		canvas.style.height = height + "px";
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		init();
	}

	function init() {
		particles = [];
		var n = count();
		for (var i = 0; i < n; i++) {
			particles.push({
				x: Math.random() * width,
				y: Math.random() * height,
				vx: (Math.random() - 0.5) * 0.35,
				vy: (Math.random() - 0.5) * 0.35,
				r: Math.random() * 1.8 + 0.6
			});
		}
	}

	function draw() {
		ctx.clearRect(0, 0, width, height);

		for (var i = 0; i < particles.length; i++) {
			var p = particles[i];
			p.x += p.vx;
			p.y += p.vy;

			if (p.x < 0 || p.x > width) p.vx *= -1;
			if (p.y < 0 || p.y > height) p.vy *= -1;

			ctx.beginPath();
			ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
			ctx.fillStyle = "rgba(" + ACCENT + ", 0.6)";
			ctx.fill();

			// Connect to nearby particles.
			for (var j = i + 1; j < particles.length; j++) {
				var q = particles[j];
				var dx = p.x - q.x;
				var dy = p.y - q.y;
				var dist = dx * dx + dy * dy;
				if (dist < 16000) {
					var alpha = (1 - dist / 16000) * 0.18;
					ctx.beginPath();
					ctx.moveTo(p.x, p.y);
					ctx.lineTo(q.x, q.y);
					ctx.strokeStyle = "rgba(" + ACCENT + ", " + alpha + ")";
					ctx.lineWidth = 1;
					ctx.stroke();
				}
			}
		}
		rafId = window.requestAnimationFrame(draw);
	}

	function play() {
		if (!rafId) draw();
	}
	function pause() {
		if (rafId) {
			window.cancelAnimationFrame(rafId);
			rafId = null;
		}
	}

	document.addEventListener("visibilitychange", function () {
		if (document.hidden) pause();
		else play();
	});

	var resizeTimer;
	window.addEventListener("resize", function () {
		window.clearTimeout(resizeTimer);
		resizeTimer = window.setTimeout(resize, 200);
	});

	resize();
	play();
})();

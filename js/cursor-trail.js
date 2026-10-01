/* =====================================================================
   Spider Cursor — Canvas implementation
   ---------------------------------------------------------------------
   A small spider body follows the pointer. Its 8 two-segment legs use
   inverse kinematics and "step" onto the edges of nearby page elements
   (links, headings, paragraphs, images...). Elements that a foot is
   holding on to get a thin cyan outline.
   Pure 2D canvas, no libraries. Drop-in replacement: uses the same
   <canvas id="cursor-trail"> element as before.
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

	// Make sure the canvas overlays the page and never blocks clicks.
	canvas.style.position = "fixed";
	canvas.style.left = "0";
	canvas.style.top = "0";
	canvas.style.pointerEvents = "none";
	canvas.style.zIndex = "2147483000";

	/* ---------- Settings (tweak these) ---------- */
	var LEG_COUNT   = 8;
	var SEG1        = 46;      // upper leg length (px)
	var SEG2        = 58;      // lower leg length (px)
	var REACH       = SEG1 + SEG2;
	var MIN_REACH   = 0.50;    // closest a foot is placed (fraction of REACH)
	var MAX_REACH   = 0.92;    // farthest a foot is placed
	var STEP_TIME   = 150;     // ms per leg step
	var FOLLOW      = 11;      // body follow speed (higher = snappier)
	var SNAP_DIST   = 70;      // how far a foot will snap to an element edge
	var SELECTOR    = "a, button, h1, h2, h3, h4, h5, h6, p, li, img, input, textarea, label, code, pre, td, th, summary";

	var COL_LINE  = "#5ccfff"; // cyan legs / outlines
	var COL_JOINT = "#ff4f81"; // pink joints
	var COL_BODY  = "#8fe3ff";

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
		refreshTargets();
	}

	/* ---------- Page element targets (stored in PAGE coordinates) ---------- */
	var targets = [];
	var lastRefresh = 0;

	function refreshTargets() {
		lastRefresh = performance.now();
		var sx = window.scrollX, sy = window.scrollY;
		var list = document.querySelectorAll(SELECTOR);
		var out = [];
		for (var i = 0; i < list.length && out.length < 400; i++) {
			var el = list[i];
			var r = el.getBoundingClientRect();
			if (r.width < 10 || r.height < 8) continue;
			if (r.bottom < -100 || r.top > H + 100 || r.right < -100 || r.left > W + 100) continue;
			if (r.width > W * 0.9 && r.height > H * 0.6) continue; // skip huge wrappers
			out.push({ el: el, x: r.left + sx, y: r.top + sy, w: r.width, h: r.height });
		}
		targets = out;
	}

	// Nearest point on a rect's outline to (px, py).
	function nearestOnEdge(t, px, py) {
		var cx = Math.max(t.x, Math.min(px, t.x + t.w));
		var cy = Math.max(t.y, Math.min(py, t.y + t.h));
		if (cx === px && cy === py) {
			// inside: push to the closest edge
			var dl = px - t.x, dr = t.x + t.w - px, dt = py - t.y, db = t.y + t.h - py;
			var m = Math.min(dl, dr, dt, db);
			if (m === dl) cx = t.x;
			else if (m === dr) cx = t.x + t.w;
			else if (m === dt) cy = t.y;
			else cy = t.y + t.h;
		}
		return { x: cx, y: cy };
	}

	/* ---------- Spider state ---------- */
	var mouse = { x: 0, y: 0, has: false };
	var body = { x: 0, y: 0 };
	var legs = [];

	for (var i = 0; i < LEG_COUNT; i++) {
		legs.push({
			ang: (i / LEG_COUNT) * Math.PI * 2 + Math.PI / LEG_COUNT,
			side: i % 2 === 0 ? 1 : -1,   // knee bend direction
			fx: 0, fy: 0,                 // foot (page coords)
			sx: 0, sy: 0,                 // step start
			tx: 0, ty: 0,                 // step target
			t: 0, stepping: false,
			target: null                  // element being held
		});
	}

	window.addEventListener("pointermove", function (e) {
		mouse.x = e.clientX;
		mouse.y = e.clientY;
		if (!mouse.has) {
			mouse.has = true;
			body.x = e.clientX;
			body.y = e.clientY;
			var sx = window.scrollX, sy = window.scrollY;
			for (var i = 0; i < legs.length; i++) {
				var l = legs[i];
				l.fx = body.x + sx + Math.cos(l.ang) * REACH * 0.6;
				l.fy = body.y + sy + Math.sin(l.ang) * REACH * 0.6;
			}
		}
	}, { passive: true });

	document.addEventListener("mouseleave", function () { mouse.has = false; });
	window.addEventListener("scroll", refreshTargets, { passive: true });
	window.addEventListener("resize", resize);

	// Choose where a leg should step next.
	function pickFoot(leg, bx, by) {
		var dist = REACH * (MIN_REACH + Math.random() * (MAX_REACH - MIN_REACH));
		var ang = leg.ang + (Math.random() - 0.5) * 0.7;
		var ix = bx + Math.cos(ang) * dist;
		var iy = by + Math.sin(ang) * dist;

		var best = null, bestD = SNAP_DIST, bestP = null;
		for (var i = 0; i < targets.length; i++) {
			var p = nearestOnEdge(targets[i], ix, iy);
			var d = Math.hypot(p.x - ix, p.y - iy);
			if (d >= bestD) continue;
			// the snapped point must still be within comfortable reach
			var rd = Math.hypot(p.x - bx, p.y - by);
			if (rd > REACH * 0.97 || rd < REACH * 0.25) continue;
			best = targets[i]; bestD = d; bestP = p;
		}
		if (best) return { x: bestP.x, y: bestP.y, target: best };
		return { x: ix, y: iy, target: null };
	}

	/* ---------- Drawing ---------- */
	function drawRect(t, sx, sy) {
		ctx.strokeStyle = COL_LINE;
		ctx.lineWidth = 1.5;
		ctx.strokeRect(Math.round(t.x - sx) - 2.5, Math.round(t.y - sy) - 2.5, t.w + 5, t.h + 5);
	}

	function dot(x, y, r, color) {
		ctx.beginPath();
		ctx.arc(x, y, r, 0, Math.PI * 2);
		ctx.fillStyle = color;
		ctx.fill();
	}

	var last = performance.now();

	function frame(now) {
		var dt = Math.min(0.05, (now - last) / 1000);
		last = now;

		ctx.clearRect(0, 0, W, H);

		if (!mouse.has) { requestAnimationFrame(frame); return; }

		if (now - lastRefresh > 300) refreshTargets();

		var sx = window.scrollX, sy = window.scrollY;

		// Body eases toward the pointer.
		var k = 1 - Math.exp(-FOLLOW * dt);
		body.x += (mouse.x - body.x) * k;
		body.y += (mouse.y - body.y) * k;

		var bxp = body.x + sx, byp = body.y + sy; // body in page coords

		// Update legs
		var anyStepping = 0;
		for (var i = 0; i < legs.length; i++) if (legs[i].stepping) anyStepping++;

		for (var i = 0; i < legs.length; i++) {
			var leg = legs[i];

			if (leg.stepping) {
				leg.t += (dt * 1000) / STEP_TIME;
				if (leg.t >= 1) {
					leg.t = 1;
					leg.stepping = false;
				}
				var e = 1 - Math.pow(1 - leg.t, 3); // ease-out
				leg.fx = leg.sx + (leg.tx - leg.sx) * e;
				leg.fy = leg.sy + (leg.ty - leg.sy) * e;
			} else {
				var d = Math.hypot(leg.fx - bxp, leg.fy - byp);
				var tooFar = d > REACH * 0.98;
				var tooClose = d < REACH * 0.2;
				// Limit simultaneous steps so the spider keeps its footing.
				if ((tooFar || tooClose) && anyStepping < 3) {
					var f = pickFoot(leg, bxp, byp);
					leg.sx = leg.fx; leg.sy = leg.fy;
					leg.tx = f.x;    leg.ty = f.y;
					leg.target = f.target;
					leg.t = 0;
					leg.stepping = true;
					anyStepping++;
				}
			}
		}

		// Highlight elements being held by a foot.
		var drawn = [];
		for (var i = 0; i < legs.length; i++) {
			var tg = legs[i].target;
			if (tg && !legs[i].stepping && drawn.indexOf(tg) === -1) {
				drawn.push(tg);
				drawRect(tg, sx, sy);
			}
		}

		// Legs
		ctx.lineCap = "round";
		ctx.lineJoin = "round";
		ctx.lineWidth = 1.6;
		ctx.strokeStyle = COL_LINE;

		for (var i = 0; i < legs.length; i++) {
			var leg = legs[i];
			var fx = leg.fx - sx, fy = leg.fy - sy;

			var dx = fx - body.x, dy = fy - body.y;
			var d = Math.hypot(dx, dy) || 0.0001;
			var dc = Math.min(d, REACH - 0.5);

			// Two-bone IK
			var a = (SEG1 * SEG1 - SEG2 * SEG2 + dc * dc) / (2 * dc);
			var h = Math.sqrt(Math.max(0, SEG1 * SEG1 - a * a));
			var ux = dx / d, uy = dy / d;
			var kx = body.x + ux * a + (-uy) * h * leg.side;
			var ky = body.y + uy * a + (ux) * h * leg.side;

			// If the foot is beyond reach, the leg is pulled straight.
			var ex = d > REACH ? body.x + ux * REACH : fx;
			var ey = d > REACH ? body.y + uy * REACH : fy;

			ctx.beginPath();
			ctx.moveTo(body.x, body.y);
			ctx.lineTo(kx, ky);
			ctx.lineTo(ex, ey);
			ctx.stroke();

			dot(kx, ky, 2.2, COL_JOINT);
			dot(ex, ey, 3, COL_JOINT);
		}

		// Body (with a soft glow)
		ctx.save();
		ctx.shadowColor = COL_LINE;
		ctx.shadowBlur = 12;
		dot(body.x, body.y, 5.5, COL_BODY);
		ctx.restore();
		dot(body.x, body.y, 2.2, "#0b1a24");

		requestAnimationFrame(frame);
	}

	resize();
	requestAnimationFrame(frame);
})();

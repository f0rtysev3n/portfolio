/* =====================================================================
   Spider Cursor v2: Canvas implementation
   ---------------------------------------------------------------------
   Drop-in replacement: uses the same <canvas id="cursor-trail"> as before.

   A spider follows the pointer. Its legs use inverse kinematics and step
   onto the edges of nearby page elements, which get outlined + labelled.

   Motion     : body bob + tilt toward heading, arcing leg lift, speed-based
                gait (scurry when fast), idle twitching, falls asleep,
                tapered legs, fade in/out.
   Interaction: hover reaction on links/buttons, click "pounce" + ripple +
                hue shift, silk web trail, dangles on a thread near the top
                edge, labels on grabbed elements, per-element-type colors.
   Visuals    : light/dark auto-detect, slow hue drift, oval body with eyes
                that track the pointer, soft shadow.
   Performance: pauses when tab hidden, stops when pointer leaves,
                Intersection/Resize/Mutation observers instead of polling,
                skips fixed/sticky UI and [data-no-spider], adaptive quality.
   Controls   : on/off toggle button (remembered), Konami-code spider swarm,
                rare surprise friend.

   Everything is configurable in CFG below.
   ===================================================================== */
(function () {
	"use strict";

	/* ---------- Settings (tweak these) ---------- */
	var CFG = {
		respectReducedMotion: true, // false = run even if the OS has "reduce motion" turned on
		mouseOnly: true,            // false = run even if the browser doesn't report a mouse/trackpad
		legs: 8,                 // legs on the main spider (even number)
		seg1: 46,                // upper leg length (px)
		seg2: 58,                // lower leg length (px)
		minReach: 0.50,          // closest a foot is placed (fraction of full reach)
		maxReach: 0.92,          // farthest a foot is placed
		stepTimeSlow: 170,       // ms per leg step when moving slowly
		stepTimeFast: 65,        // ms per leg step when scurrying
		follow: 11,              // follow speed of friend/swarm spiders (higher = snappier)
		mainFollow: 6,           // follow speed of the main spider (lower = lazier, trails more)
		followDistance: 90,      // px the spider keeps away from the cursor (0 = sit on the cursor)
		snapDist: 70,            // how far a foot will snap to an element edge
		legLift: 14,             // how high a leg lifts while stepping (px)
		selector: "a, button, h1, h2, h3, h4, h5, h6, p, li, img, input, textarea, select, label, code, pre, td, th, summary",
		maxTracked: 1500,        // max page elements the spider keeps track of

		startHue: 195,           // 195 = cyan. Legs/body use this, joints use the complement
		hueDrift: 2,             // degrees per second of slow color drift (0 = fixed color)

		webTrail: true,          // fading silk strand behind the spider
		webLife: 1600,           // ms the strand lasts
		labels: true,            // small text labels on grabbed elements
		hangZone: 70,            // px from the top edge where the spider dangles on a thread

		idleTwitchMs: 2500,      // idle time before the spider starts twitching legs
		sleepMs: 9000,           // idle time before the spider curls up and sleeps

		easterEggChance: 0.07,   // chance per page load of a small friend spider
		swarmCount: 12,          // spiders in Konami swarm mode (up, up, down, down, left, right, left, right, B, A)

		showToggle: true,        // little on/off button in the bottom-right corner
		rememberChoice: true,    // remember on/off in localStorage
		hideNativeCursor: false  // true = hide the normal arrow (links keep their pointer)
	};

	var KIND_HUE = { link: 0, heading: 150, text: 80, code: -75, image: 110, form: -150 };

	function say(msg) {
		if (window.console && console.info) console.info("[spider-cursor] " + msg);
	}

	// Respect accessibility + only run for real mouse pointers (not touch).
	if (CFG.respectReducedMotion && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
		say("not started: your system has 'reduce motion' turned on. Set respectReducedMotion: false in CFG to override.");
		return;
	}
	if (CFG.mouseOnly && window.matchMedia && !window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
		say("not started: browser does not report a mouse/trackpad (hover + fine pointer). Set mouseOnly: false in CFG to override.");
		return;
	}

	function boot() {
		var canvas = document.getElementById("cursor-trail");
		if (!canvas) { say("not started: no <canvas id=\"cursor-trail\"> found in the page."); return; }
		var ctx = canvas.getContext("2d");
		if (!ctx) { say("not started: canvas 2D context unavailable."); return; }

		var TWO_PI = Math.PI * 2;
		function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
		function lerp(a, b, t) { return a + (b - a) * t; }

		/* ---------- Preferences ---------- */
		var PREF_KEY = "spiderCursor:enabled";
		function loadPref() {
			if (!CFG.rememberChoice) return true;
			try { return window.localStorage.getItem(PREF_KEY) !== "0"; } catch (e) { return true; }
		}
		function savePref(v) {
			if (!CFG.rememberChoice) return;
			try { window.localStorage.setItem(PREF_KEY, v ? "1" : "0"); } catch (e) { /* ignore */ }
		}
		var enabled = loadPref();

		/* ---------- Device capability ---------- */
		var lowQ = !!((navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) ||
			(navigator.deviceMemory && navigator.deviceMemory <= 2));
		var LEGS = lowQ ? 6 : CFG.legs;

		/* ---------- Canvas ---------- */
		canvas.style.position = "fixed";
		canvas.style.left = "0";
		canvas.style.top = "0";
		canvas.style.pointerEvents = "none";
		canvas.style.zIndex = "2147483000";

		var dpr = 1, W = 0, H = 0;
		function resize() {
			dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
			W = window.innerWidth;
			H = window.innerHeight;
			canvas.width = Math.round(W * dpr);
			canvas.height = Math.round(H * dpr);
			canvas.style.width = W + "px";
			canvas.style.height = H + "px";
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			dirty = true;
		}

		/* ---------- Shared state ---------- */
		var mouse = { x: 0, y: 0, inside: false };
		var lastMoveAt = performance.now();
		function poke() { lastMoveAt = performance.now(); }

		var alpha = 0;                 // global fade
		var hue = CFG.startHue, hueTarget = CFG.startHue;
		var hover = 0, hoverTarget = false, lastHoverCheck = 0;
		var hang = 0;
		var isDark = true, lastThemeCheck = -9999;
		var running = false, rafId = 0, last = 0;
		var ema = 16.7, slowAcc = 0;
		var trail = [], ripples = [];
		var F = { sx: 0, sy: 0, idle: 0, hover: 0, hang: 0, alpha: 0, dark: true };

		/* ---------- Theme (light / dark auto-detect) ---------- */
		var darkMQ = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
		function parseColor(str) {
			var m = /rgba?\(([^)]+)\)/.exec(str || "");
			if (!m) return null;
			var parts = m[1].split(/[\s,\/]+/).filter(Boolean);
			if (parts.length < 3) return null;
			var a = 1;
			if (parts.length > 3) {
				a = parseFloat(parts[3]);
				if (String(parts[3]).indexOf("%") !== -1) a /= 100;
			}
			return { r: parseFloat(parts[0]), g: parseFloat(parts[1]), b: parseFloat(parts[2]), a: a };
		}
		function detectDark() {
			var els = [document.body, document.documentElement];
			for (var i = 0; i < els.length; i++) {
				if (!els[i]) continue;
				var c = parseColor(getComputedStyle(els[i]).backgroundColor);
				if (c && c.a > 0.5) return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) < 140;
			}
			return darkMQ ? darkMQ.matches : true;
		}
		if (darkMQ) {
			var onTheme = function () { lastThemeCheck = -9999; };
			if (darkMQ.addEventListener) darkMQ.addEventListener("change", onTheme);
			else if (darkMQ.addListener) darkMQ.addListener(onTheme);
		}
		isDark = detectDark();

		/* ---------- Palette helpers ---------- */
		function hsl(h, s, l, a) {
			h = ((h % 360) + 360) % 360;
			h = Math.round(h);
			return a === undefined
				? "hsl(" + h + "," + s + "%," + l + "%)"
				: "hsla(" + h + "," + s + "%," + l + "%," + a + ")";
		}
		function palette(h, dark) {
			return {
				line:  hsl(h, 95, dark ? 64 : 34),
				joint: hsl(h + 150, 100, dark ? 62 : 46),
				body:  hsl(h, 85, dark ? 76 : 30),
				glow:  hsl(h, 100, dark ? 60 : 45, 0.7),
				rim:   dark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)",
				web:   dark ? "255,255,255" : "20,30,40"
			};
		}
		function rr(x, y, w, h, r) {
			ctx.beginPath();
			ctx.moveTo(x + r, y);
			ctx.arcTo(x + w, y, x + w, y + h, r);
			ctx.arcTo(x + w, y + h, x, y + h, r);
			ctx.arcTo(x, y + h, x, y, r);
			ctx.arcTo(x, y, x + w, y, r);
			ctx.closePath();
		}
		function dot(x, y, r, color) {
			ctx.beginPath();
			ctx.arc(x, y, r, 0, TWO_PI);
			ctx.fillStyle = color;
			ctx.fill();
		}

		/* =================================================================
		   Page element tracking (Intersection / Resize / Mutation observers)
		   ================================================================= */
		var tracked = new Map();      // element -> record
		var targets = [];             // visible rects in PAGE coordinates
		var dirty = true, lastRebuild = -9999;
		var fixedCache = new WeakMap();

		var io = null, ro = null, mo = null;
		if ("IntersectionObserver" in window) {
			io = new IntersectionObserver(function (entries) {
				for (var i = 0; i < entries.length; i++) {
					var rec = tracked.get(entries[i].target);
					if (rec) rec.visible = entries[i].isIntersecting;
				}
				dirty = true;
			}, { rootMargin: "120px" });
		}
		if ("ResizeObserver" in window) {
			ro = new ResizeObserver(function () { dirty = true; });
		}

		// True if the element lives inside a fixed/sticky container (navbars, cookie banners...).
		function inFixed(el) {
			var chain = [], n = el, res = false;
			while (n && n !== document.documentElement) {
				if (fixedCache.has(n)) { res = fixedCache.get(n); break; }
				chain.push(n);
				var pos = getComputedStyle(n).position;
				if (pos === "fixed" || pos === "sticky") { res = true; break; }
				n = n.parentElement;
			}
			for (var i = 0; i < chain.length; i++) fixedCache.set(chain[i], res);
			return res;
		}

		function kindOf(el) {
			var t = el.tagName;
			if (t === "A" || t === "BUTTON" || t === "SUMMARY") return "link";
			if (/^H[1-6]$/.test(t)) return "heading";
			if (t === "IMG") return "image";
			if (t === "INPUT" || t === "TEXTAREA" || t === "SELECT") return "form";
			if (t === "CODE" || t === "PRE") return "code";
			return "text";
		}

		var toggleBtn = null;
		function track(el) {
			if (tracked.has(el) || tracked.size >= CFG.maxTracked) return;
			if (el === canvas || el === toggleBtn) return;
			if (el.closest && el.closest("[data-no-spider]")) return;
			if (inFixed(el)) return;
			var rec = { el: el, kind: kindOf(el), visible: !io, label: null };
			tracked.set(el, rec);
			if (io) io.observe(el);
			if (ro) ro.observe(el);
		}

		function scan(root) {
			if (!root || root.nodeType !== 1) return;
			if (root.matches && root.matches(CFG.selector)) track(root);
			if (!root.querySelectorAll) return;
			var list = root.querySelectorAll(CFG.selector);
			for (var i = 0; i < list.length; i++) track(list[i]);
		}

		function rebuildTargets(now) {
			dirty = false;
			lastRebuild = now;
			var sx = window.pageXOffset, sy = window.pageYOffset;
			var out = [], dead = [];
			tracked.forEach(function (rec, el) {
				if (!el.isConnected) { dead.push(el); return; }
				if (!rec.visible) return;
				var r = el.getBoundingClientRect();
				if (r.width < 10 || r.height < 8) return;
				if (r.width > W * 0.9 && r.height > H * 0.6) return;   // skip giant wrappers
				if (r.bottom < -150 || r.top > H + 150 || r.right < -150 || r.left > W + 150) return;
				out.push({ rec: rec, x: r.left + sx, y: r.top + sy, w: r.width, h: r.height });
			});
			for (var i = 0; i < dead.length; i++) {
				tracked.delete(dead[i]);
				if (io) io.unobserve(dead[i]);
				if (ro) ro.unobserve(dead[i]);
			}
			targets = out.length > 500 ? out.slice(0, 500) : out;
		}

		// Nearest point on a rect's outline to (px, py).
		function nearestOnEdge(t, px, py) {
			var cx = Math.max(t.x, Math.min(px, t.x + t.w));
			var cy = Math.max(t.y, Math.min(py, t.y + t.h));
			if (cx === px && cy === py) {
				var dl = px - t.x, dr = t.x + t.w - px, dt = py - t.y, db = t.y + t.h - py;
				var m = Math.min(dl, dr, dt, db);
				if (m === dl) cx = t.x;
				else if (m === dr) cx = t.x + t.w;
				else if (m === dt) cy = t.y;
				else cy = t.y + t.h;
			}
			return { x: cx, y: cy };
		}

		function labelFor(rec) {
			if (rec.label !== null) return rec.label;
			var el = rec.el, txt = "";
			try {
				txt = el.getAttribute("aria-label") ||
					(el.tagName === "IMG" ? el.getAttribute("alt") : "") ||
					el.getAttribute("title") ||
					el.getAttribute("placeholder") ||
					el.textContent || "";
			} catch (e) { txt = ""; }
			txt = String(txt).replace(/\s+/g, " ").trim();
			if (txt.length > 26) txt = txt.slice(0, 25) + "\u2026";
			var tag = String(el.tagName || "").toLowerCase();
			rec.label = txt ? tag + " \u00b7 " + txt : tag;
			return rec.label;
		}

		/* =================================================================
		   Spider
		   ================================================================= */
		function Spider(o) {
			this.main = !!o.main;
			this.s = o.scale || 1;
			this.hueOff = o.hueOff || 0;
			this.follow = o.follow;
			this.k = o.k || CFG.follow;
			this.sleepDelay = o.sleepDelay || 0;
			this.seg1 = CFG.seg1 * this.s;
			this.seg2 = CFG.seg2 * this.s;
			this.reach = this.seg1 + this.seg2;

			this.x = 0; this.y = 0;
			this.vx = 0; this.vy = 0;
			this.speed = 0; this.sn = 0;
			this.heading = 0;
			this.bobPhase = Math.random() * 6;
			this.reachScale = 1;
			this.sleepT = 0;
			this.pounce = 0;
			this.nextTwitch = 0;
			this.nextBlink = 0; this.blinkUntil = 0;
			this.lookAt = { x: 0, y: 0 };
			this.rot = 0;

			var n = o.legs || LEGS;
			var m = Math.max(2, Math.floor(n / 2));
			this.legs = [];
			for (var k = 0; k < m; k++) {
				var f = m > 1 ? k / (m - 1) : 0.5;
				var a = (40 + f * 105) * Math.PI / 180;
				for (var side = 0; side < 2; side++) {
					this.legs.push({
						ang: side === 0 ? a : -a,       // leg direction relative to heading
						along: 3.6 - f * 7.2,           // where the leg attaches along the body
						lat: side === 0 ? 1 : -1,       // which side of the body
						bend: 1,                        // knee bend direction (with hysteresis)
						fx: 0, fy: 0,                   // foot position (page coords)
						sx: 0, sy: 0, tx: 0, ty: 0,     // step start / target
						t: 1, dur: 150, stepping: false,
						target: null,
						pendingAt: 0, pendingKind: ""
					});
				}
			}
		}

		Spider.prototype.place = function (sx, sy) {
			var cosH = Math.cos(this.heading), sinH = Math.sin(this.heading);
			var bxp = this.x + sx, byp = this.y + sy, R = this.reach * this.reachScale;
			for (var i = 0; i < this.legs.length; i++) {
				var leg = this.legs[i];
				var rx = bxp + cosH * leg.along * this.s, ry = byp + sinH * leg.along * this.s;
				var a = this.heading + leg.ang;
				leg.fx = rx + Math.cos(a) * R * 0.65;
				leg.fy = ry + Math.sin(a) * R * 0.65;
				leg.stepping = false; leg.t = 1; leg.target = null; leg.pendingAt = 0;
			}
		};

		Spider.prototype.startStep = function (leg, rx, ry, R, kind, dur) {
			var dist;
			if (kind === "spread") dist = R * (0.9 + Math.random() * 0.07);
			else dist = R * (CFG.minReach + Math.random() * (CFG.maxReach - CFG.minReach)) * (1 + 0.1 * this.sn);
			dist = Math.min(dist, R * 0.96);

			var ang = this.heading + leg.ang + (Math.random() - 0.5) * 0.6;
			var ix = rx + Math.cos(ang) * dist + this.vx * 0.06 * this.sn;
			var iy = ry + Math.sin(ang) * dist + this.vy * 0.06 * this.sn;
			var dx = ix - rx, dy = iy - ry, dd = Math.hypot(dx, dy) || 1;
			if (dd > R * 0.96) { ix = rx + dx / dd * R * 0.96; iy = ry + dy / dd * R * 0.96; }

			var snap = CFG.snapDist * Math.max(0.6, this.s);
			var best = null, bestD = snap, bx = 0, by = 0;
			for (var i = 0; i < targets.length; i++) {
				var t = targets[i];
				if (ix < t.x - snap || ix > t.x + t.w + snap || iy < t.y - snap || iy > t.y + t.h + snap) continue;
				var p = nearestOnEdge(t, ix, iy);
				var d = Math.hypot(p.x - ix, p.y - iy);
				if (d >= bestD) continue;
				var rd = Math.hypot(p.x - rx, p.y - ry);
				if (rd > R * 0.97 || rd < R * 0.25) continue;
				best = t; bestD = d; bx = p.x; by = p.y;
			}

			leg.sx = leg.fx; leg.sy = leg.fy;
			if (best) { leg.tx = bx; leg.ty = by; leg.target = best; }
			else { leg.tx = ix; leg.ty = iy; leg.target = null; }
			leg.t = 0; leg.dur = dur; leg.stepping = true;
		};

		Spider.prototype.update = function (dt, now) {
			var tgt = this.follow(now);
			this.lookAt = this.main ? mouse : tgt;

			// Follow
			var px = this.x, py = this.y;
			var kk = 1 - Math.exp(-this.k * dt);
			this.x += (tgt.x - this.x) * kk;
			this.y += (tgt.y - this.y) * kk;
			var kv = 1 - Math.exp(-12 * dt);
			this.vx += ((this.x - px) / dt - this.vx) * kv;
			this.vy += ((this.y - py) / dt - this.vy) * kv;
			this.speed = Math.hypot(this.vx, this.vy);
			this.sn = clamp(this.speed / 1400, 0, 1);

			var hov = this.main ? F.hover : 0;
			var hg = this.main ? F.hang : 0;

			// Heading (tilt toward the direction of travel; face down when dangling)
			var want = this.heading;
			if (hg > 0.5) want = Math.PI / 2;
			else if (this.speed > 40) want = Math.atan2(this.vy, this.vx);
			else if (this.main) want = Math.atan2(mouse.y - this.y, mouse.x - this.x);   // waiting: face the cursor
			var d = want - this.heading;
			d = Math.atan2(Math.sin(d), Math.cos(d));
			this.heading += d * (1 - Math.exp(-10 * dt));

			// Sleep + stance
			var asleep = F.idle > CFG.sleepMs + this.sleepDelay;
			this.sleepT += ((asleep ? 1 : 0) - this.sleepT) * (1 - Math.exp(-(asleep ? 2.5 : 12) * dt));
			var rt = (1 - 0.55 * this.sleepT) * (1 - 0.16 * hov) * (1 - 0.10 * hg);
			this.reachScale += (rt - this.reachScale) * (1 - Math.exp(-8 * dt));
			this.pounce *= Math.exp(-7 * dt);
			this.bobPhase += dt * (5 + this.sn * 12);

			// Legs
			var s = this.s;
			var cosH = Math.cos(this.heading), sinH = Math.sin(this.heading);
			var bxp = this.x + F.sx, byp = this.y + F.sy;
			var R = this.reach * this.reachScale;
			var n = this.legs.length;
			var stepTime = lerp(CFG.stepTimeSlow, CFG.stepTimeFast, this.sn) * (1 + 0.6 * this.sleepT);
			var maxStep = Math.max(2, Math.floor(n / 2.6)) + (this.sn > 0.5 ? 2 : 0);
			var stepping = 0, i, leg;

			for (i = 0; i < n; i++) {
				leg = this.legs[i];
				if (!leg.stepping) continue;
				leg.t += dt * 1000 / leg.dur;
				if (leg.t >= 1) { leg.t = 1; leg.stepping = false; }
				var e = 1 - Math.pow(1 - leg.t, 3);
				leg.fx = leg.sx + (leg.tx - leg.sx) * e;
				leg.fy = leg.sy + (leg.ty - leg.sy) * e;
				if (leg.stepping) stepping++;
			}

			for (var q = 0; q < n; q++) {
				leg = this.legs[(q + this.rot) % n];
				if (leg.stepping) continue;
				var rx = bxp + cosH * leg.along * s, ry = byp + sinH * leg.along * s;

				if (leg.pendingAt && now >= leg.pendingAt) {
					this.startStep(leg, rx, ry, R, leg.pendingKind, stepTime * 0.9);
					if (leg.pendingKind === "spread") { leg.pendingAt = now + 300; leg.pendingKind = "snap"; }
					else leg.pendingAt = 0;
					stepping++;
					continue;
				}

				var dist = Math.hypot(leg.fx - rx, leg.fy - ry);
				if ((dist > R * 0.98 || dist < R * 0.2) && stepping < maxStep) {
					this.startStep(leg, rx, ry, R, "walk", stepTime);
					stepping++;
				}
			}
			this.rot = (this.rot + 1) % n;

			// Idle twitch: wiggle one leg now and then
			if (F.idle < CFG.idleTwitchMs) {
				this.nextTwitch = now + 1200 + Math.random() * 1500;
			} else if (now > this.nextTwitch && stepping === 0) {
				leg = this.legs[Math.floor(Math.random() * n)];
				var rx2 = bxp + cosH * leg.along * s, ry2 = byp + sinH * leg.along * s;
				var jx = leg.fx + (Math.random() - 0.5) * 26 * s;
				var jy = leg.fy + (Math.random() - 0.5) * 26 * s;
				var jd = Math.hypot(jx - rx2, jy - ry2);
				if (jd < R * 0.95 && jd > R * 0.22) {
					leg.sx = leg.fx; leg.sy = leg.fy;
					leg.tx = jx; leg.ty = jy;
					leg.t = 0; leg.dur = 130; leg.stepping = true;
				}
				this.nextTwitch = now + (this.sleepT > 0.5 ? 2600 : 1200) + Math.random() * 2200;
			}
		};

		Spider.prototype.draw = function (now, P) {
			var s = this.s, sp = Math.max(0.6, s);
			var bscale = s * (1 + 0.3 * this.pounce);

			// Body bob + breathing
			var amp = 1.4 * s * clamp(this.speed / 250, 0, 1);
			var bob = Math.sin(this.bobPhase) * amp + Math.sin(now * 0.003) * 0.5 * s;
			var bx = this.x, by = this.y + bob;
			var cosH = Math.cos(this.heading), sinH = Math.sin(this.heading);

			// Soft shadow
			if (!lowQ) {
				ctx.save();
				ctx.translate(this.x + 2 * s, this.y + 8 * s);
				ctx.scale(1, 0.4);
				var g = ctx.createRadialGradient(0, 0, 0, 0, 0, 16 * bscale);
				g.addColorStop(0, F.dark ? "rgba(0,0,0,0.38)" : "rgba(0,0,0,0.26)");
				g.addColorStop(1, "rgba(0,0,0,0)");
				ctx.fillStyle = g;
				ctx.beginPath();
				ctx.arc(0, 0, 16 * bscale, 0, TWO_PI);
				ctx.fill();
				ctx.restore();
			}

			// Legs (tapered: thick near the body, thin at the foot)
			ctx.lineCap = "round";
			ctx.lineJoin = "round";
			ctx.strokeStyle = P.line;
			var minD = Math.abs(this.seg2 - this.seg1) + 1;
			for (var i = 0; i < this.legs.length; i++) {
				var leg = this.legs[i];
				var rx = bx + cosH * leg.along * s, ry = by + sinH * leg.along * s;
				var lift = leg.stepping ? Math.sin(Math.PI * leg.t) * CFG.legLift * s * (0.7 + 0.5 * this.sn) : 0;
				var fx = leg.fx - F.sx, fy = leg.fy - F.sy - lift;

				var dx = fx - rx, dy = fy - ry;
				var d = Math.hypot(dx, dy) || 0.0001;
				var dc = clamp(d, minD, this.reach - 0.5);
				var ux = dx / d, uy = dy / d;

				// Two-bone IK
				var a = (this.seg1 * this.seg1 - this.seg2 * this.seg2 + dc * dc) / (2 * dc);
				var h = Math.sqrt(Math.max(0, this.seg1 * this.seg1 - a * a));
				var pxp = -uy, pyp = ux;
				// Keep knees pointing outward (flip only when clearly wrong, avoids flicker)
				var dotv = pxp * (-sinH * leg.lat) + pyp * (cosH * leg.lat);
				if (dotv * leg.bend < -0.35) leg.bend = -leg.bend;
				var kx = rx + ux * a + pxp * h * leg.bend;
				var ky = ry + uy * a + pyp * h * leg.bend;

				var ex = d > this.reach ? rx + ux * this.reach : fx;
				var ey = d > this.reach ? ry + uy * this.reach : fy;

				ctx.lineWidth = 2.5 * sp;
				ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(kx, ky); ctx.stroke();
				ctx.lineWidth = 1.5 * sp;
				ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(ex, ey); ctx.stroke();

				dot(kx, ky, 2.1 * sp, P.joint);
				dot(ex, ey, (2.8 + (lift / (CFG.legLift * s + 0.001)) * 1.2) * sp, P.joint);
			}

			// Body: abdomen + head, rotated toward heading
			ctx.save();
			ctx.translate(bx, by);
			ctx.rotate(this.heading);
			ctx.scale(bscale, bscale);
			if (!lowQ) { ctx.shadowColor = P.glow; ctx.shadowBlur = 12; }
			ctx.fillStyle = P.body;
			ctx.beginPath(); ctx.ellipse(-6.5, 0, 7.2, 5.4, 0, 0, TWO_PI); ctx.fill();
			ctx.beginPath(); ctx.arc(2.6, 0, 4.4, 0, TWO_PI); ctx.fill();
			ctx.shadowBlur = 0;

			ctx.lineWidth = 0.9;
			ctx.strokeStyle = P.rim;
			ctx.beginPath(); ctx.ellipse(-6.5, 0, 7.2, 5.4, 0, 0, TWO_PI); ctx.stroke();
			ctx.beginPath(); ctx.arc(2.6, 0, 4.4, 0, TWO_PI); ctx.stroke();

			dot(-6.8, 0, 1.5, P.joint);            // abdomen marking

			// Eyes follow the pointer (or what the spider is chasing)
			var lx = this.lookAt.x - this.x, ly = this.lookAt.y - this.y;
			var llx = lx * cosH + ly * sinH, lly = -lx * sinH + ly * cosH;
			var ll = Math.hypot(llx, lly);
			if (ll < 4) { llx = 1; lly = 0; } else { llx /= ll; lly /= ll; }
			if (now > this.nextBlink) { this.blinkUntil = now + 120; this.nextBlink = now + 2200 + Math.random() * 3500; }
			var closed = this.sleepT > 0.5 || now < this.blinkUntil;
			for (var side = -1; side <= 1; side += 2) {
				if (closed) {
					ctx.lineWidth = 0.8;
					ctx.strokeStyle = "#0b1a24";
					ctx.beginPath(); ctx.moveTo(4.4, side * 1.9); ctx.lineTo(6.4, side * 1.9); ctx.stroke();
				} else {
					dot(5.4, side * 1.9, 1.35, "#ffffff");
					dot(5.4 + llx * 0.55, side * 1.9 + lly * 0.55, 0.7, "#0b1a24");
				}
			}
			ctx.restore();

			// Hover "latch" ring (main spider only)
			if (this.main && F.hover > 0.02) {
				var ga = ctx.globalAlpha;
				ctx.globalAlpha = ga * F.hover * 0.85;
				ctx.strokeStyle = P.joint;
				ctx.lineWidth = 1.4;
				ctx.beginPath();
				ctx.arc(bx, by, 13 * s + Math.sin(now * 0.008) * 1.2, 0, TWO_PI);
				ctx.stroke();
				ctx.globalAlpha = ga;
			}

			// Sleeping "z z"
			if (this.sleepT > 0.4) {
				var ga2 = ctx.globalAlpha;
				ctx.fillStyle = P.line;
				ctx.font = "bold " + Math.round(11 * sp) + "px ui-monospace, Menlo, Consolas, monospace";
				ctx.textBaseline = "alphabetic";
				for (var z = 0; z < 2; z++) {
					var ph = (now * 0.0007 + z * 0.5) % 1;
					ctx.globalAlpha = ga2 * (1 - ph) * this.sleepT;
					ctx.fillText("z", bx + 10 * s + ph * 8, by - 8 * s - ph * 16);
				}
				ctx.globalAlpha = ga2;
			}
		};

		/* =================================================================
		   Spiders: the main one + optional friends / swarm
		   ================================================================= */
		// The main spider chases a point that sits followDistance px from the cursor,
		// on the side where the spider already is. So it trails behind while you move
		// and settles a short distance away when you stop.
		var chase = { x: 0, y: 0 };
		var main = new Spider({
			main: true, scale: 1, k: CFG.mainFollow,
			follow: function () {
				var D = CFG.followDistance;
				var dx = main.x - mouse.x, dy = main.y - mouse.y;
				var d = Math.hypot(dx, dy);
				if (d < 1) { dx = -Math.cos(main.heading); dy = -Math.sin(main.heading); d = 1; }
				chase.x = mouse.x + dx / d * D;
				chase.y = mouse.y + dy / d * D;
				return chase;
			}
		});
		var others = [];

		function addFollower(tag, o) {
			var out = { x: 0, y: 0 };
			var phase = Math.random() * TWO_PI;
			var sp = new Spider({
				scale: o.scale, legs: o.legs, hueOff: o.hueOff, k: o.k, sleepDelay: o.sleepDelay,
				follow: function (now) {
					var a = phase + now * o.angSpeed;
					out.x = clamp(main.x + Math.cos(a) * o.radius, 10, W - 10);
					out.y = clamp(main.y + Math.sin(a) * o.radius, 10, H - 10);
					return out;
				}
			});
			sp.tag = tag;
			sp.x = main.x + (Math.random() - 0.5) * 60;
			sp.y = main.y + (Math.random() - 0.5) * 60;
			sp.place(window.pageXOffset, window.pageYOffset);
			others.push(sp);
		}

		function toggleSwarm() {
			if (!enabled) return;
			var had = false, keep = [];
			for (var i = 0; i < others.length; i++) {
				if (others[i].tag === "swarm") had = true; else keep.push(others[i]);
			}
			others = keep;
			if (had) return;
			var count = lowQ ? 4 : CFG.swarmCount;
			for (var j = 0; j < count; j++) {
				addFollower("swarm", {
					scale: 0.38 + Math.random() * 0.32,
					legs: 8,
					hueOff: j * 47,
					radius: 45 + Math.random() * 140,
					angSpeed: (0.0004 + Math.random() * 0.0012) * (Math.random() < 0.5 ? -1 : 1),
					k: 3 + Math.random() * 4,
					sleepDelay: Math.random() * 2500
				});
			}
			ensureRunning();
		}

		if (Math.random() < CFG.easterEggChance) {
			addFollower("friend", { scale: 0.55, legs: LEGS, hueOff: 140, radius: 60, angSpeed: 0.0009, k: 5, sleepDelay: 800 });
		}

		function snapAll() {
			var sx = window.pageXOffset, sy = window.pageYOffset;
			main.x = mouse.x; main.y = mouse.y;
			main.vx = 0; main.vy = 0;
			main.place(sx, sy);
			for (var i = 0; i < others.length; i++) {
				others[i].x = clamp(mouse.x + (Math.random() - 0.5) * 80, 10, W - 10);
				others[i].y = clamp(mouse.y + (Math.random() - 0.5) * 80, 10, H - 10);
				others[i].place(sx, sy);
			}
			trail.length = 0;
		}

		/* =================================================================
		   Web trail, held-element outlines + labels, thread, ripples
		   ================================================================= */
		function updateWeb(now, sx, sy) {
			if (!CFG.webTrail || lowQ) { if (trail.length) trail.length = 0; return; }
			var px = main.x + sx, py = main.y + sy;
			var l = trail[trail.length - 1];
			if (!l || Math.hypot(px - l.x, py - l.y) > 5) {
				trail.push({ x: px, y: py, t: now });
				if (trail.length > 110) trail.shift();
			}
			while (trail.length && now - trail[0].t > CFG.webLife) trail.shift();
		}

		function drawWeb(now, P, sx, sy) {
			if (trail.length < 2) return;
			ctx.lineWidth = 1;
			ctx.lineCap = "round";
			var ga = ctx.globalAlpha;
			for (var i = 1; i < trail.length; i++) {
				var age = (now - trail[i].t) / CFG.webLife;
				if (age >= 1) continue;
				ctx.globalAlpha = ga * (1 - age) * 0.45;
				ctx.strokeStyle = "rgb(" + P.web + ")";
				ctx.beginPath();
				ctx.moveTo(trail[i - 1].x - sx, trail[i - 1].y - sy);
				ctx.lineTo(trail[i].x - sx, trail[i].y - sy);
				ctx.stroke();
			}
			ctx.globalAlpha = ga;
		}

		function drawHeld(now) {
			var held = [], seen = [], i;
			for (i = 0; i < main.legs.length; i++) {
				var leg = main.legs[i];
				if (!leg.target || leg.stepping) continue;
				var rec = leg.target.rec;
				if (seen.indexOf(rec) !== -1 || !rec.el.isConnected) continue;
				seen.push(rec);
				var r = rec.el.getBoundingClientRect();
				if (r.width <= 0 || r.height <= 0) continue;
				var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
				held.push({ rec: rec, r: r, d: Math.hypot(cx - main.x, cy - main.y) });
			}
			if (!held.length) return;

			var lw = 1.4 + 0.8 * F.hover;
			for (i = 0; i < held.length; i++) {
				var hr = held[i].r, kh = hue + KIND_HUE[held[i].rec.kind];
				rr(hr.left - 2.5, hr.top - 2.5, hr.width + 5, hr.height + 5, 4);
				ctx.fillStyle = hsl(kh, 95, F.dark ? 66 : 38, 0.07);
				ctx.fill();
				ctx.lineWidth = lw;
				ctx.strokeStyle = hsl(kh, 95, F.dark ? 66 : 38);
				ctx.stroke();
			}

			if (!CFG.labels || lowQ) return;
			held.sort(function (a, b) { return a.d - b.d; });
			ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
			ctx.textBaseline = "middle";
			var count = Math.min(3, held.length);
			for (i = 0; i < count; i++) {
				var it = held[i], text = labelFor(it.rec);
				var w = ctx.measureText(text).width + 12, h = 17;
				var lx = clamp(it.r.left - 2.5, 4, Math.max(4, W - w - 4));
				var ly = it.r.top - 2.5 - h - 3;
				if (ly < 4) ly = it.r.bottom + 5.5;
				var col = hsl(hue + KIND_HUE[it.rec.kind], 95, F.dark ? 66 : 38);
				rr(lx, ly, w, h, 4);
				ctx.fillStyle = F.dark ? "rgba(8,12,18,0.84)" : "rgba(255,255,255,0.92)";
				ctx.fill();
				ctx.lineWidth = 1;
				ctx.strokeStyle = col;
				ctx.stroke();
				ctx.fillStyle = F.dark ? "#e8f6ff" : "#10222e";
				ctx.fillText(text, lx + 6, ly + h / 2 + 0.5);
			}
		}

		function drawThread(now, P) {
			if (F.hang < 0.02) return;
			var by = main.y;
			var sway = Math.sin(now * 0.0018) * 2.4 * F.hang;
			var ga = ctx.globalAlpha;
			ctx.globalAlpha = ga * 0.7 * F.hang;
			ctx.strokeStyle = "rgb(" + P.web + ")";
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(main.x, -2);
			ctx.quadraticCurveTo(main.x + sway, by * 0.5, main.x, by - 3);
			ctx.stroke();
			ctx.globalAlpha = ga;
		}

		function drawRipples(now, P, sx, sy) {
			var ga = ctx.globalAlpha;
			for (var i = ripples.length - 1; i >= 0; i--) {
				var age = (now - ripples[i].t) / 450;
				if (age >= 1) { ripples.splice(i, 1); continue; }
				ctx.globalAlpha = ga * (1 - age) * 0.6;
				ctx.strokeStyle = P.line;
				ctx.lineWidth = 1.5;
				ctx.beginPath();
				ctx.arc(ripples[i].x - sx, ripples[i].y - sy, 6 + age * 46, 0, TWO_PI);
				ctx.stroke();
			}
			ctx.globalAlpha = ga;
		}

		/* =================================================================
		   Hover detection
		   ================================================================= */
		function isInteractiveAt(x, y) {
			var el = document.elementFromPoint(x, y);
			if (!el) return false;
			if (el.closest && el.closest("a[href], button, input, select, textarea, summary, label, [role='button'], [role='link'], [onclick]")) return true;
			try { return getComputedStyle(el).cursor === "pointer"; } catch (e) { return false; }
		}

		/* =================================================================
		   Main loop
		   ================================================================= */
		function setLowQuality() {
			lowQ = true;
			trail.length = 0;
		}

		function frame(now) {
			if (!running) return;
			var rawDt = now - last;
			last = now;
			var dt = clamp(rawDt / 1000, 0.001, 0.05);

			// Adaptive quality: drop the fancy stuff if frames get slow.
			if (rawDt < 100) {
				ema += (rawDt - ema) * 0.05;
				if (!lowQ) {
					if (ema > 36) { slowAcc += rawDt; if (slowAcc > 2500) setLowQuality(); }
					else slowAcc = Math.max(0, slowAcc - rawDt);
				}
			}

			// Fade in/out
			alpha += ((mouse.inside ? 1 : 0) - alpha) * (1 - Math.exp(-7 * dt));
			if (!mouse.inside && alpha < 0.01) {
				alpha = 0;
				ctx.clearRect(0, 0, W, H);
				running = false;
				return;
			}

			// Theme + page elements
			if (now - lastThemeCheck > 1500) { isDark = detectDark(); lastThemeCheck = now; }
			if ((dirty && now - lastRebuild > 150) || now - lastRebuild > 2000) rebuildTargets(now);

			// Hover
			if (mouse.inside && now - lastHoverCheck > 90) {
				lastHoverCheck = now;
				hoverTarget = isInteractiveAt(mouse.x, mouse.y);
			}
			hover += ((mouse.inside && hoverTarget ? 1 : 0) - hover) * (1 - Math.exp(-12 * dt));

			// Dangle from the top edge
			var hangTarget = clamp(1 - main.y / CFG.hangZone, 0, 1);
			hang += (hangTarget - hang) * (1 - Math.exp(-10 * dt));

			// Color drift
			hueTarget += CFG.hueDrift * dt;
			hue += (hueTarget - hue) * (1 - Math.exp(-6 * dt));

			F.sx = window.pageXOffset; F.sy = window.pageYOffset;
			F.idle = now - lastMoveAt;
			F.hover = hover; F.hang = hang; F.alpha = alpha; F.dark = isDark;

			// Update
			main.update(dt, now);
			for (var i = 0; i < others.length; i++) others[i].update(dt, now);
			updateWeb(now, F.sx, F.sy);

			// Draw
			ctx.clearRect(0, 0, W, H);
			ctx.globalAlpha = alpha;
			ctx.shadowBlur = 0;
			var P0 = palette(hue, isDark);

			if (!lowQ && CFG.webTrail) drawWeb(now, P0, F.sx, F.sy);
			for (i = 0; i < others.length; i++) others[i].draw(now, palette(hue + others[i].hueOff, isDark));
			drawHeld(now);
			drawThread(now, P0);
			main.draw(now, P0);
			drawRipples(now, P0, F.sx, F.sy);

			ctx.globalAlpha = 1;
			rafId = requestAnimationFrame(frame);
		}

		function ensureRunning() {
			if (running || !enabled || document.hidden) return;
			if (!mouse.inside && alpha < 0.01) return;
			running = true;
			last = performance.now();
			rafId = requestAnimationFrame(frame);
		}

		/* ---------- On/off + toggle button ---------- */
		var hoverBtn = false;
		function refreshButton() {
			if (!toggleBtn) return;
			toggleBtn.setAttribute("aria-pressed", String(enabled));
			toggleBtn.title = enabled ? "Spider cursor: on (click to turn off)" : "Spider cursor: off (click to turn on)";
			toggleBtn.style.opacity = hoverBtn ? "1" : (enabled ? "0.85" : "0.5");
			toggleBtn.style.filter = enabled ? "none" : "grayscale(1)";
		}

		function applyCursorClass(on) {
			if (CFG.hideNativeCursor) document.documentElement.classList.toggle("spider-cursor-on", on);
		}

		function setEnabled(v) {
			enabled = v;
			savePref(v);
			refreshButton();
			if (v) {
				canvas.style.display = "";
				applyCursorClass(true);
				if (mouse.inside && alpha < 0.05) snapAll();
				ensureRunning();
			} else {
				running = false;
				cancelAnimationFrame(rafId);
				alpha = 0;
				ctx.clearRect(0, 0, W, H);
				canvas.style.display = "none";
				applyCursorClass(false);
			}
		}

		function makeToggle() {
			var b = document.createElement("button");
			b.type = "button";
			b.setAttribute("data-no-spider", "");
			b.setAttribute("aria-label", "Toggle spider cursor");
			b.textContent = "\uD83D\uDD77\uFE0F";
			// !important so site CSS (button resets, transforms, etc.) can't hide or move it.
			b.style.cssText = "position:fixed !important;right:16px !important;bottom:16px !important;left:auto !important;top:auto !important;" +
				"width:40px !important;height:40px !important;margin:0 !important;padding:0 !important;" +
				"border-radius:50% !important;border:1px solid rgba(160,160,160,.6) !important;" +
				"background:rgba(18,22,28,.85) !important;color:#fff !important;font-size:20px !important;line-height:1 !important;" +
				"cursor:pointer !important;z-index:2147483647 !important;visibility:visible !important;" +
				"display:flex !important;align-items:center !important;justify-content:center !important;" +
				"transition:opacity .2s,filter .2s;";
			b.addEventListener("click", function () { setEnabled(!enabled); });
			b.addEventListener("mouseenter", function () { hoverBtn = true; refreshButton(); });
			b.addEventListener("mouseleave", function () { hoverBtn = false; refreshButton(); });
			b.addEventListener("focus", function () { hoverBtn = true; refreshButton(); });
			b.addEventListener("blur", function () { hoverBtn = false; refreshButton(); });
			// Attached to <html>, not <body>: a transform/filter on <body> would break position:fixed.
			document.documentElement.appendChild(b);
			toggleBtn = b;
			refreshButton();
		}

		// Handy from the browser console: spiderCursor.toggle(), .enable(), .disable()
		window.spiderCursor = {
			enable: function () { setEnabled(true); },
			disable: function () { setEnabled(false); },
			toggle: function () { setEnabled(!enabled); }
		};

		/* ---------- Events ---------- */
		window.addEventListener("pointermove", function (e) {
			mouse.x = e.clientX;
			mouse.y = e.clientY;
			poke();
			if (!enabled) return;
			if (!mouse.inside) {
				mouse.inside = true;
				if (alpha < 0.05) snapAll();
			}
			ensureRunning();
		}, { passive: true });

		document.documentElement.addEventListener("mouseleave", function () { mouse.inside = false; });

		window.addEventListener("pointerdown", function (e) {
			poke();
			if (!enabled || !mouse.inside) return;
			if (e.target && e.target.closest && e.target.closest("[data-no-spider]")) return;
			var now = performance.now();
			hueTarget += 70 + Math.random() * 80;       // click shifts the color
			main.pounce = 1;                            // body squash
			ripples.push({ x: e.clientX + window.pageXOffset, y: e.clientY + window.pageYOffset, t: now });
			if (ripples.length > 6) ripples.shift();
			for (var i = 0; i < main.legs.length; i++) {  // legs spread, then snap back
				main.legs[i].pendingAt = now + i * 18;
				main.legs[i].pendingKind = "spread";
			}
		}, { passive: true });

		window.addEventListener("scroll", poke, { passive: true });
		window.addEventListener("resize", resize);

		document.addEventListener("visibilitychange", function () {
			if (document.hidden) { running = false; cancelAnimationFrame(rafId); }
			else ensureRunning();
		});

		var KONAMI = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"].join();
		var kbuf = [];
		document.addEventListener("keydown", function (e) {
			var t = e.target;
			if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
			kbuf.push(String(e.key).toLowerCase());
			if (kbuf.length > 10) kbuf.shift();
			if (kbuf.join() === KONAMI) { kbuf = []; toggleSwarm(); }
		});

		/* ---------- Start ---------- */
		if (CFG.hideNativeCursor) {
			var st = document.createElement("style");
			st.textContent = ".spider-cursor-on, .spider-cursor-on body { cursor: none; }";
			document.head.appendChild(st);
		}

		resize();
		if (CFG.showToggle) makeToggle();
		scan(document.body);

		if ("MutationObserver" in window) {
			mo = new MutationObserver(function (muts) {
				for (var i = 0; i < muts.length; i++) {
					if (muts[i].type !== "childList") continue;
					for (var j = 0; j < muts[i].addedNodes.length; j++) scan(muts[i].addedNodes[j]);
				}
				dirty = true;
			});
			mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden"] });
		}
		window.addEventListener("load", function () { dirty = true; });
		if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { dirty = true; });

		rebuildTargets(performance.now());

		if (!enabled) canvas.style.display = "none";
		else applyCursorClass(true);

		say("v2 started" + (enabled ? "" : " (currently switched off, click the spider button to turn it on)") + ". Move the mouse over the page.");
	}

	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
	else boot();
})();

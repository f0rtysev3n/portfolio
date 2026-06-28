/* ============================================================
   counter.js
   Animated number counters. Each [data-counter] element counts
   up to its data-target value the first time it scrolls into
   view. Supports prefixes/suffixes via data-suffix.
   ============================================================ */
(function () {
	"use strict";

	function animateCounter(el) {
		var target = parseFloat(el.getAttribute("data-target")) || 0;
		var suffix = el.getAttribute("data-suffix") || "";
		var duration = 1600;
		var startTime = null;

		// Reduced motion: jump straight to the final value.
		if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			el.textContent = target + suffix;
			return;
		}

		function step(now) {
			if (!startTime) startTime = now;
			var progress = Math.min((now - startTime) / duration, 1);
			// easeOutCubic for a natural deceleration
			var eased = 1 - Math.pow(1 - progress, 3);
			var value = target * eased;
			var display = target % 1 === 0 ? Math.floor(value) : value.toFixed(1);
			el.textContent = display + suffix;
			if (progress < 1) {
				window.requestAnimationFrame(step);
			} else {
				el.textContent = target + suffix;
			}
		}
		window.requestAnimationFrame(step);
	}

	document.addEventListener("DOMContentLoaded", function () {
		var counters = document.querySelectorAll("[data-counter]");
		if (!counters.length) return;

		if (!("IntersectionObserver" in window)) {
			counters.forEach(animateCounter);
			return;
		}

		var observer = new IntersectionObserver(function (entries, obs) {
			entries.forEach(function (entry) {
				if (entry.isIntersecting) {
					animateCounter(entry.target);
					obs.unobserve(entry.target);
				}
			});
		}, { threshold: 0.5 });

		counters.forEach(function (c) { observer.observe(c); });
	});
})();

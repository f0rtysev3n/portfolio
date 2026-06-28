/* ============================================================
   scroll.js
   Scroll-reveal (AOS-style) using IntersectionObserver, the
   scroll-progress indicator bar, sticky-nav state, and
   animated skill meters. All vanilla, no dependencies.
   ============================================================ */
(function () {
	"use strict";

	var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	/* ---------- Scroll reveal ---------- */
	function initReveal() {
		var items = document.querySelectorAll("[data-reveal]");
		if (!items.length) return;

		if (reduceMotion || !("IntersectionObserver" in window)) {
			items.forEach(function (el) { el.classList.add("is-visible"); });
			return;
		}

		var observer = new IntersectionObserver(function (entries, obs) {
			entries.forEach(function (entry) {
				if (entry.isIntersecting) {
					entry.target.classList.add("is-visible");
					obs.unobserve(entry.target);
				}
			});
		}, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

		items.forEach(function (el) { observer.observe(el); });
	}

	/* ---------- Skill meters ---------- */
	function initMeters() {
		var meters = document.querySelectorAll(".skill-meter__fill");
		if (!meters.length) return;

		function fill(el) {
			el.style.width = (el.getAttribute("data-level") || "0") + "%";
		}

		if (!("IntersectionObserver" in window)) {
			meters.forEach(fill);
			return;
		}

		var observer = new IntersectionObserver(function (entries, obs) {
			entries.forEach(function (entry) {
				if (entry.isIntersecting) {
					fill(entry.target);
					obs.unobserve(entry.target);
				}
			});
		}, { threshold: 0.4 });

		meters.forEach(function (m) { observer.observe(m); });
	}

	/* ---------- Scroll progress + sticky nav ---------- */
	function initScrollState() {
		var progress = document.querySelector("[data-scroll-progress]");
		var nav = document.querySelector("[data-nav]");
		var ticking = false;

		function update() {
			var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
			var docHeight = document.documentElement.scrollHeight - window.innerHeight;
			var pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
			if (progress) progress.style.width = pct + "%";
			if (nav) nav.classList.toggle("is-scrolled", scrollTop > 20);
			ticking = false;
		}

		window.addEventListener("scroll", function () {
			if (!ticking) {
				window.requestAnimationFrame(update);
				ticking = true;
			}
		}, { passive: true });

		update();
	}

	document.addEventListener("DOMContentLoaded", function () {
		initReveal();
		initMeters();
		initScrollState();
	});
})();

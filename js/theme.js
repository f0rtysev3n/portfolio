/* ============================================================
   theme.js
   Light/dark theme toggle with localStorage persistence and
   system-preference fallback. Runs immediately to avoid FOUC.
   ============================================================ */
(function () {
	"use strict";

	var STORAGE_KEY = "ka-portfolio-theme";
	var root = document.documentElement;

	/** Resolve the initial theme: stored > system preference > dark. */
	function getInitialTheme() {
		var stored = null;
		try {
			stored = localStorage.getItem(STORAGE_KEY);
		} catch (e) {
			/* localStorage may be blocked; ignore */
		}
		if (stored === "light" || stored === "dark") return stored;
		if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
			return "light";
		}
		return "dark";
	}

	function applyTheme(theme) {
		if (theme === "light") {
			root.setAttribute("data-theme", "light");
		} else {
			root.removeAttribute("data-theme");
		}
	}

	// Apply ASAP (script is loaded in <head> with defer-like behaviour via being early).
	var current = getInitialTheme();
	applyTheme(current);

	// Wire up the toggle button once the DOM is ready.
	document.addEventListener("DOMContentLoaded", function () {
		var toggle = document.querySelector("[data-theme-toggle]");
		if (!toggle) return;

		toggle.setAttribute("aria-pressed", String(current === "light"));

		toggle.addEventListener("click", function () {
			current = current === "light" ? "dark" : "light";
			applyTheme(current);
			toggle.setAttribute("aria-pressed", String(current === "light"));
			try {
				localStorage.setItem(STORAGE_KEY, current);
			} catch (e) {
				/* ignore persistence errors */
			}
		});
	});
})();

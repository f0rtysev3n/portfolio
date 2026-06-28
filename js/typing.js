/* ============================================================
   typing.js
   Lightweight typewriter effect (vanilla replacement for
   Typed.js). Cycles through phrases from the target's
   data-words attribute (JSON array). Pauses on reduced motion.
   ============================================================ */
(function () {
	"use strict";

	function startTyping(el) {
		var words;
		try {
			words = JSON.parse(el.getAttribute("data-words") || "[]");
		} catch (e) {
			words = [];
		}
		if (!words.length) return;

		// Respect reduced-motion: show the first word statically.
		if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			el.textContent = words[0];
			return;
		}

		var typeSpeed = 75;
		var deleteSpeed = 40;
		var holdTime = 1600;
		var wordIndex = 0;
		var charIndex = 0;
		var deleting = false;

		function tick() {
			var word = words[wordIndex];
			if (deleting) {
				charIndex--;
			} else {
				charIndex++;
			}
			el.textContent = word.substring(0, charIndex);

			var delay = deleting ? deleteSpeed : typeSpeed;

			if (!deleting && charIndex === word.length) {
				delay = holdTime;
				deleting = true;
			} else if (deleting && charIndex === 0) {
				deleting = false;
				wordIndex = (wordIndex + 1) % words.length;
				delay = 400;
			}
			window.setTimeout(tick, delay);
		}

		tick();
	}

	document.addEventListener("DOMContentLoaded", function () {
		var targets = document.querySelectorAll("[data-words]");
		targets.forEach(startTyping);
	});
})();

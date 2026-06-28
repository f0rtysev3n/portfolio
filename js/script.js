/* ============================================================
   script.js
   Main entry script: page loader, mobile nav drawer, active
   link highlighting, mouse spotlight, button ripples, contact
   form validation, and footer year. Other behaviours live in
   their dedicated modules (theme/typing/particles/counter/scroll).
   ============================================================ */
(function () {
	"use strict";

	/* ---------- Page loader ---------- */
	window.addEventListener("load", function () {
		var loader = document.querySelector("[data-loader]");
		if (loader) {
			window.setTimeout(function () {
				loader.classList.add("is-hidden");
			}, 350);
		}
	});

	document.addEventListener("DOMContentLoaded", function () {
		initNav();
		initActiveLink();
		initSpotlight();
		initRipples();
		initContactForm();
		initFooterYear();
	});

	/* ---------- Mobile nav drawer ---------- */
	function initNav() {
		var toggle = document.querySelector("[data-nav-toggle]");
		var menu = document.querySelector("[data-nav-menu]");
		if (!toggle || !menu) return;

		function closeMenu() {
			menu.classList.remove("is-open");
			toggle.classList.remove("is-open");
			toggle.setAttribute("aria-expanded", "false");
		}

		toggle.addEventListener("click", function () {
			var open = menu.classList.toggle("is-open");
			toggle.classList.toggle("is-open", open);
			toggle.setAttribute("aria-expanded", String(open));
		});

		// Close when a link is clicked.
		menu.querySelectorAll("a").forEach(function (link) {
			link.addEventListener("click", closeMenu);
		});

		// Close on Escape.
		document.addEventListener("keydown", function (e) {
			if (e.key === "Escape") closeMenu();
		});

		// Close when clicking outside the drawer.
		document.addEventListener("click", function (e) {
			if (!menu.classList.contains("is-open")) return;
			if (menu.contains(e.target) || toggle.contains(e.target)) return;
			closeMenu();
		});
	}

	/* ---------- Active link highlighting ---------- */
	function initActiveLink() {
		var links = document.querySelectorAll("[data-nav-menu] a.nav__link");
		var path = window.location.pathname.split("/").pop() || "index.html";
		links.forEach(function (link) {
			var href = link.getAttribute("href");
			if (href === path || (path === "" && href === "index.html")) {
				link.classList.add("is-active");
				link.setAttribute("aria-current", "page");
			}
		});
	}

	/* ---------- Mouse spotlight ---------- */
	function initSpotlight() {
		var spotlight = document.querySelector("[data-spotlight]");
		if (!spotlight) return;
		if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return;

		window.addEventListener("pointermove", function (e) {
			spotlight.style.setProperty("--mx", e.clientX + "px");
			spotlight.style.setProperty("--my", e.clientY + "px");
		}, { passive: true });
	}

	/* ---------- Button ripple effect ---------- */
	function initRipples() {
		var buttons = document.querySelectorAll(".btn");
		buttons.forEach(function (btn) {
			btn.addEventListener("click", function (e) {
				var rect = btn.getBoundingClientRect();
				var size = Math.max(rect.width, rect.height);
				var ripple = document.createElement("span");
				ripple.className = "ripple";
				ripple.style.width = ripple.style.height = size + "px";
				ripple.style.left = (e.clientX - rect.left - size / 2) + "px";
				ripple.style.top = (e.clientY - rect.top - size / 2) + "px";
				btn.appendChild(ripple);
				window.setTimeout(function () { ripple.remove(); }, 600);
			});
		});
	}

	/* ---------- Contact form (client-side validation) ---------- */
	function initContactForm() {
		var form = document.querySelector("[data-contact-form]");
		if (!form) return;
		var status = form.querySelector("[data-form-status]");

		function setStatus(message, ok) {
			if (!status) return;
			status.textContent = message;
			status.className = "form-status is-visible " + (ok ? "form-status--ok" : "form-status--err");
		}

		form.addEventListener("submit", function (e) {
			e.preventDefault();
			var name = form.querySelector("#name");
			var email = form.querySelector("#email");
			var message = form.querySelector("#message");
			var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

			if (!name.value.trim() || !email.value.trim() || !message.value.trim()) {
				setStatus("Please fill in all required fields.", false);
				return;
			}
			if (!emailRe.test(email.value.trim())) {
				setStatus("Please enter a valid email address.", false);
				return;
			}

			// Send to the form's endpoint (FormSubmit) via AJAX so the
			// visitor stays on the page and sees an inline status message.
			var endpoint = form.getAttribute("action");
			var submitBtn = form.querySelector("button[type='submit']");
			var firstName = name.value.trim().split(" ")[0];
			if (!endpoint) {
				setStatus("Thanks, " + firstName + "! (Form endpoint not configured yet.)", true);
				form.reset();
				return;
			}
			if (submitBtn) { submitBtn.disabled = true; }
			setStatus("Sending your message\u2026", true);
			fetch(endpoint, {
				method: "POST",
				headers: { "Accept": "application/json" },
				body: new FormData(form)
			})
				.then(function (res) {
					if (res.ok) {
						setStatus("Thanks, " + firstName + "! Your message has been sent \u2014 I'll get back to you soon.", true);
						form.reset();
					} else {
						setStatus("Sorry, something went wrong. Please email me directly at K4shafali@gmail.com.", false);
					}
				})
				.catch(function () {
					setStatus("Network error. Please email me directly at K4shafali@gmail.com.", false);
				})
				.finally(function () { if (submitBtn) { submitBtn.disabled = false; } });
		});
	}

	/* ---------- Footer year ---------- */
	function initFooterYear() {
		var el = document.querySelector("[data-year]");
		if (el) el.textContent = new Date().getFullYear();
	}
})();

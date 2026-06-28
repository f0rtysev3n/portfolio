# Kashaf Ali — Cybersecurity & Network Engineer Portfolio

A modern, production-ready, multi-page personal portfolio website for **Kashaf Ali**, a Network Engineer, Network Security Engineer, Cybersecurity Professional, and SOC Analyst. Built with semantic HTML5, modular CSS, and vanilla JavaScript — no frameworks, no build step — and optimized for **GitHub Pages**.

![Tech](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![Tech](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![Tech](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)
![Pages](https://img.shields.io/badge/GitHub%20Pages-ready-2ea44f)

---

## 📌 Overview

This portfolio is designed to feel like a **premium cybersecurity portfolio** rather than a generic template. It features a dark, glassmorphic, cybersecurity-inspired aesthetic with smooth animations, a particle network background, an animated typing hero, animated counters, and a fully responsive layout that works flawlessly across desktop, laptop, tablet, and mobile.

**Live pages:** Home · About · Experience · Projects · Skills · Certifications · Contact · 404 · Privacy Policy

---

## ✨ Features

- **9 fully built pages** with a shared sticky navigation and footer.
- **Dark / light theme toggle** with `localStorage` persistence and system-preference detection.
- **Animated hero** with a vanilla typewriter effect cycling through roles.
- **Particle network background** drawn on `<canvas>` (pure JS, pauses when tab is hidden / on reduced motion).
- **Scroll-reveal animations** via `IntersectionObserver` with staggered delays.
- **Animated statistics counters** and **animated skill progress bars**.
- **Mouse spotlight**, **button ripple**, **hover lift**, **glow** and **floating** micro-interactions.
- **Scroll progress indicator** and a tasteful **loading animation**.
- **Vertical animated experience timeline** and **premium project / certification cards**.
- **Accessible**: semantic HTML5, ARIA labels, keyboard navigation, skip link, focus styles, and reduced-motion support.
- **SEO-ready**: meta titles/descriptions/keywords, Open Graph, Twitter Cards, JSON-LD structured data, canonical URLs, `robots.txt`, and `sitemap.xml`.
- **Performance-minded**: deferred JavaScript, modular CSS, system + Google fonts with preconnect, and no heavy frameworks.

---

## 🟦 Tech Stack

| Layer | Technology |
|------------|--------------------------------------------|
| Markup     | HTML5 (semantic)                           |
| Styling    | CSS3 (custom properties, grid, flexbox)    |
| Behavior   | Vanilla JavaScript (ES5-safe, modular)     |
| Icons      | Font Awesome 6 (CDN)                        |
| Fonts      | Google Fonts — Poppins, Inter, JetBrains Mono |

> The typing, particles, and scroll-reveal effects are implemented from scratch in vanilla JS (lightweight replacements for Typed.js / Particles.js / AOS) so the site stays fast and dependency-free.

---

## 📁 Folder Structure

```
portfolio/
├─ index.html            # Home
├─ about.html            # About
├─ experience.html       # Experience timeline
├─ projects.html         # Projects + architecture
├─ skills.html           # Categorized skills + progress bars
├─ certifications.html   # Certifications
├─ contact.html          # Contact form + details
├─ 404.html              # Custom not-found page
├─ privacy.html          # Privacy policy
├─ README.md
├─ robots.txt
├─ sitemap.xml
├─ .nojekyll             # Ensures GitHub Pages serves all files as-is
├─ css/
│  ├─ variables.css      # Design tokens (colors, spacing, radius, theme)
│  ├─ style.css          # Core component & layout styles
│  ├─ animations.css     # Keyframes & animation utilities
│  └─ responsive.css     # Breakpoints & print styles
├─ js/
│  ├─ theme.js           # Theme toggle + persistence
│  ├─ typing.js          # Hero typewriter effect
│  ├─ particles.js       # Canvas particle network
│  ├─ counter.js         # Animated number counters
│  ├─ scroll.js          # Scroll reveal, progress bar, skill meters
│  └─ script.js          # Nav, ripple, loader, form, spotlight
└─ assets/
   ├─ images/            # Screenshots, OG cover, etc.
   ├─ icons/             # favicon.svg and icons
   ├─ certificates/      # Certificate images / PDFs
   ├─ resume/            # Kashaf-Ali-Resume.pdf
   ├─ logos/             # Company / tech logos
   └─ backgrounds/       # Background imagery
```

---

## 🚀 Deployment (GitHub Pages)

1. **Create a repository** on GitHub (e.g. `portfolio` or `your-username.github.io`).
2. **Upload** all files in this `portfolio/` folder to the repository root (or push via Git):
   ```bash
   git init
   git add .
   git commit -m "Initial portfolio commit"
   git branch -M main
   git remote add origin https://github.com/your-username/portfolio.git
   git push -u origin main
   ```
3. In the repo, go to **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to *Deploy from a branch*, choose **main** branch and **/(root)** folder, then **Save**.
5. Wait ~1 minute. Your site will be live at:
   `https://your-username.github.io/portfolio/`

> A `.nojekyll` file is included so GitHub Pages serves every file (including those starting with `_`) without Jekyll processing.

---

## 🛠️ Customization

- **Personal details / placeholders:** Replace these throughout the HTML files before going live:
  - Email: `your.email@example.com`
  - Phone: `+91 00000 00000`
  - GitHub: `https://github.com/username`
  - LinkedIn: `https://linkedin.com/in/username`
  - Canonical / OG / sitemap URLs: replace `https://username.github.io/portfolio/` with your real URL.
- **Resume:** Replace `assets/resume/Kashaf-Ali-Resume.pdf` with your latest resume (keep the filename or update the links).
- **Colors:** Edit the design tokens in `css/variables.css` (`--color-bg`, `--color-accent`, etc.).
- **Fonts:** Swap the Google Fonts `<link>` and the `--font-*` variables in `variables.css`.
- **Content:** Update experience, projects, skills, and certifications directly in their respective HTML files.
- **Contact form:** The form is front-end only. To receive submissions, point it at a service such as [Formspree](https://formspree.io/):
  ```html
  <form action="https://formspree.io/f/your-id" method="POST" data-contact-form>
  ```
  and remove the `e.preventDefault()` demo handling in `js/script.js` if you want a native POST.
- **Social preview:** Add an `assets/images/og-cover.png` (1200×630) for rich link previews.

---

## ♿ Accessibility

- Semantic landmarks (`header`, `main`, `nav`, `footer`, `section`, `article`).
- Skip-to-content link, visible focus states, and keyboard-operable navigation.
- ARIA labels on icon-only controls and `aria-current` on the active nav link.
- Respects `prefers-reduced-motion` — heavy animations are disabled automatically.

---

## 📄 License

Released under the **MIT License**. You are free to use, modify, and distribute this project with attribution. See below.

```
MIT License

Copyright (c) 2025 Kashaf Ali

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

*Designed & built for Kashaf Ali — Building Secure Networks. Protecting Digital Infrastructure.*

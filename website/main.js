/* Subtitles MD - landing site interactions.
   Vanilla, dependency-free. Progressive enhancement only:
   the page is fully usable and readable without this file. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- mobile navigation ---------------- */
  var toggle = document.querySelector(".nav__toggle");
  var menu = document.getElementById("nav-menu");

  function closeMenu() {
    if (!menu) return;
    menu.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
  }

  function openMenu() {
    menu.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close menu");
  }

  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      if (menu.classList.contains("is-open")) closeMenu();
      else openMenu();
    });
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) closeMenu();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menu.classList.contains("is-open")) {
        closeMenu();
        toggle.focus();
      }
    });
    document.addEventListener("click", function (e) {
      if (
        menu.classList.contains("is-open") &&
        !menu.contains(e.target) &&
        !toggle.contains(e.target)
      ) {
        closeMenu();
      }
    });
  }

  /* ---------------- sticky header shadow ---------------- */
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () {
      if (window.scrollY > 8) header.classList.add("is-scrolled");
      else header.classList.remove("is-scrolled");
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------------- scroll reveal ---------------- */
  var revealEls = Array.prototype.slice.call(document.querySelectorAll("[data-reveal]"));
  window.__revealReady = true;

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach(function (el) {
      el.classList.add("is-visible");
    });
  } else {
    var io = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.08 }
    );
    revealEls.forEach(function (el) {
      io.observe(el);
    });
  }

  /* ---------------- active section link ---------------- */
  var links = Array.prototype.slice.call(document.querySelectorAll(".nav__links a[href^='#']"));
  var sections = links
    .map(function (link) {
      var id = link.getAttribute("href").slice(1);
      var el = document.getElementById(id);
      return el ? { link: link, el: el } : null;
    })
    .filter(Boolean);

  if (sections.length && "IntersectionObserver" in window) {
    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          links.forEach(function (l) {
            l.classList.remove("is-active");
          });
          var match = sections.filter(function (s) {
            return s.el === entry.target;
          })[0];
          if (match) match.link.classList.add("is-active");
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );
    sections.forEach(function (s) {
      spy.observe(s.el);
    });
  }
})();

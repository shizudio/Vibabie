/* ============================================================
   Shizudio — v2 "The Living Catalogue"
   Plain (non-module) script.
   Three jobs: lamp toggle · time-of-day light shift · room overlay.
   ============================================================ */
(function () {
  "use strict";

  var root = document.documentElement;
  var body = document.body;

  /* ---------- 1. Lamp toggle (dark mode) ---------- */
  var lamp = document.getElementById("lampToggle");

  function syncLampLabel() {
    var dark = root.getAttribute("data-theme") === "dark";
    // Label states the ACTION: light on -> "Lamp off" (turn it off / go dark).
    lamp.textContent = dark ? "Lamp on" : "Lamp off";
    lamp.setAttribute("aria-pressed", dark ? "true" : "false");
  }

  if (lamp) {
    syncLampLabel(); // reconcile with theme applied pre-paint
    lamp.addEventListener("click", function () {
      var dark = root.getAttribute("data-theme") === "dark";
      if (dark) {
        root.removeAttribute("data-theme");
      } else {
        root.setAttribute("data-theme", "dark");
      }
      try {
        localStorage.setItem("v2-theme", dark ? "light" : "dark");
      } catch (e) {}
      syncLampLabel();
    });
  }

  /* ---------- 2. Time-of-day light shift ---------- */
  // 5-8 dawn · 8-17 day · 17-21 dusk · else night
  function applyLight() {
    var h = new Date().getHours();
    var phase;
    if (h >= 5 && h < 8) phase = "light-dawn";
    else if (h >= 8 && h < 17) phase = "light-day";
    else if (h >= 17 && h < 21) phase = "light-dusk";
    else phase = "light-night";
    body.classList.remove(
      "light-dawn",
      "light-day",
      "light-dusk",
      "light-night"
    );
    body.classList.add(phase);
  }
  applyLight();

  /* ---------- 3. Room overlay (click to enter) ---------- */
  var trigger = document.getElementById("roomTrigger");
  var overlay = document.getElementById("roomOverlay");
  var closeBtn = document.getElementById("roomClose");
  var scroller = document.getElementById("roomScroll");

  function centerScroll() {
    if (!scroller) return;
    // Center the horizontally-scrollable room once, on open.
    scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2;
  }

  function openRoom() {
    if (!overlay) return;
    overlay.hidden = false;
    body.style.overflow = "hidden"; // lock page scroll while open
    // wait a frame so layout is measured before centering
    requestAnimationFrame(centerScroll);
    if (closeBtn) closeBtn.focus();
  }

  function closeRoom() {
    if (!overlay) return;
    overlay.hidden = true;
    body.style.overflow = ""; // unlock page scroll
    if (trigger) trigger.focus();
  }

  if (trigger) trigger.addEventListener("click", openRoom);
  if (closeBtn) closeBtn.addEventListener("click", closeRoom);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlay && !overlay.hidden) {
      closeRoom();
    }
  });
})();

/**
 * ASCII Dashboard Application Controller
 * Coordinates system profile HUD, energy market analytics, tab routing, and auto-cycle for ambient displays.
 */
(function () {
  "use strict";

  let activeView = "profile"; // 'profile' | 'energy'
  let autoCycleTimer = null;
  let isAutoCycling = false;
  const AUTO_CYCLE_INTERVAL_MS = 25000; // 25 seconds per view on ambient phone screens

  function switchView(viewName) {
    activeView = viewName;

    const viewProfile = document.getElementById("view-profile");
    const viewEnergy = document.getElementById("view-energy");
    const tabProfile = document.getElementById("tab-profile");
    const tabEnergy = document.getElementById("tab-energy");
    const cardEl = document.querySelector(".card");

    if (viewName === "energy") {
      if (viewProfile) viewProfile.style.display = "none";
      if (viewEnergy) viewEnergy.style.display = "block";
      if (tabProfile) tabProfile.classList.remove("active");
      if (tabEnergy) tabEnergy.classList.add("active");
      if (cardEl) cardEl.setAttribute("data-view", "energy");
    } else {
      if (viewEnergy) viewEnergy.style.display = "none";
      if (viewProfile) viewProfile.style.display = "block";
      if (tabEnergy) tabEnergy.classList.remove("active");
      if (tabProfile) tabProfile.classList.add("active");
      if (cardEl) cardEl.setAttribute("data-view", "profile");
    }
  }

  function updateAutoCycleBtn() {
    const btn = document.getElementById("btn-auto-cycle");
    if (!btn) return;
    const txt = isAutoCycling
      ? (window.I18n ? window.I18n.t("auto_cycle_on") : "[AUTO: ON (25s)]")
      : (window.I18n ? window.I18n.t("auto_cycle_off") : "[AUTO: OFF]");
    btn.textContent = txt;
    if (isAutoCycling) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  }

  function toggleAutoCycle() {
    isAutoCycling = !isAutoCycling;
    updateAutoCycleBtn();

    if (isAutoCycling) {
      autoCycleTimer = setInterval(() => {
        switchView(activeView === "profile" ? "energy" : "profile");
      }, AUTO_CYCLE_INTERVAL_MS);
    } else {
      if (autoCycleTimer) {
        clearInterval(autoCycleTimer);
        autoCycleTimer = null;
      }
    }
  }

  function initTabs() {
    const tabProfile = document.getElementById("tab-profile");
    const tabEnergy = document.getElementById("tab-energy");
    const btnGotoEnergy = document.getElementById("btn-goto-energy");
    const btnAutoCycle = document.getElementById("btn-auto-cycle");
    const btnLang = document.getElementById("btn-lang-toggle");

    if (tabProfile) {
      tabProfile.addEventListener("click", () => switchView("profile"));
    }
    if (tabEnergy) {
      tabEnergy.addEventListener("click", () => switchView("energy"));
    }
    if (btnGotoEnergy) {
      btnGotoEnergy.addEventListener("click", () => switchView("energy"));
    }
    if (btnAutoCycle) {
      btnAutoCycle.addEventListener("click", toggleAutoCycle);
    }
    if (btnLang) {
      btnLang.addEventListener("click", () => {
        if (window.I18n) window.I18n.toggleLang();
      });
    }

    // Keyboard Shortcuts
    window.addEventListener("keydown", (e) => {
      // Ignore if typing in input fields
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      const key = e.key.toLowerCase();
      if (key === "1" || key === "p") {
        switchView("profile");
      } else if (key === "2" || key === "e") {
        switchView("energy");
      } else if (key === "tab") {
        e.preventDefault();
        switchView(activeView === "profile" ? "energy" : "profile");
      } else if (key === "w" || key === "m") {
        if (window.EnergyDashboard && activeView === "energy") {
          window.EnergyDashboard.cycleEvolution();
        }
      } else if (key === "d" || key === "f") {
        if (window.EnergyDashboard && activeView === "energy") {
          window.EnergyDashboard.cyclePrediction();
        }
      } else if (key === "r") {
        if (window.EnergyDashboard) {
          window.EnergyDashboard.refresh();
        }
      } else if (key === "a") {
        toggleAutoCycle();
      } else if (key === "l") {
        if (window.I18n) window.I18n.toggleLang();
      }
    });
  }

  function initClock() {
    const timeElement = document.getElementById("time");
    if (!timeElement) return;

    let lastQuarter = Math.floor(new Date().getMinutes() / 15);
    let lastHour = new Date().getHours();

    function updateTime() {
      const now = new Date();
      timeElement.textContent = now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });

      const currentQuarter = Math.floor(now.getMinutes() / 15);
      const currentHour = now.getHours();

      // Automatically refresh energy metrics when the 15-minute interval or hour rolls over
      if (currentQuarter !== lastQuarter || currentHour !== lastHour) {
        lastQuarter = currentQuarter;
        lastHour = currentHour;
        if (window.EnergyDashboard && typeof window.EnergyDashboard.refresh === "function") {
          window.EnergyDashboard.refresh(true);
        }
      }
    }

    updateTime();
    setInterval(updateTime, 1000);
  }

  function initApp() {
    // 1. Initialize background ASCII plasma
    const canvas = document.getElementById("plasma");
    if (canvas && typeof window.AsciiPlasma === "function") {
      new window.AsciiPlasma(canvas, {
        color: "#00aaff",
        backgroundColor: "#020508",
        targetFps: 20
      });
    }

    // 2. Initialize live clock
    initClock();

    // 3. Initialize tabs and controls
    initTabs();

    // 4. Initialize Internationalization (i18n)
    if (window.I18n) {
      window.I18n.updateDOM();
      window.I18n.onChange(() => {
        updateAutoCycleBtn();
      });
    }

    // 5. Initialize Portugal electricity dashboard
    if (window.EnergyDashboard && typeof window.EnergyDashboard.init === "function") {
      window.EnergyDashboard.init();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
  } else {
    initApp();
  }
})();

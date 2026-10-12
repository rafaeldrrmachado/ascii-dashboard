/**
 * ASCII Dashboard Application Controller
 * Coordinates system profile HUD, energy market analytics, tab routing, and auto-cycle for ambient displays.
 */
(function () {
  "use strict";

  const VIEWS = ["profile", "energy", "erse"];
  let activeView = "profile"; // 'profile' | 'energy' | 'erse'
  let autoCycleTimer = null;
  let isAutoCycling = false;
  const AUTO_CYCLE_INTERVAL_MS = 25000; // 25 seconds per view on ambient displays

  function switchView(viewName) {
    if (!VIEWS.includes(viewName)) return;
    activeView = viewName;

    const viewProfile = document.getElementById("view-profile");
    const viewEnergy = document.getElementById("view-energy");
    const viewErse = document.getElementById("view-erse");
    const tabProfile = document.getElementById("tab-profile");
    const tabEnergy = document.getElementById("tab-energy");
    const tabErse = document.getElementById("tab-erse");
    const cardEl = document.querySelector(".card");

    // Hide all view panels
    if (viewProfile) viewProfile.style.display = "none";
    if (viewEnergy) viewEnergy.style.display = "none";
    if (viewErse) viewErse.style.display = "none";

    // Deactivate all tab buttons
    if (tabProfile) tabProfile.classList.remove("active");
    if (tabEnergy) tabEnergy.classList.remove("active");
    if (tabErse) tabErse.classList.remove("active");

    // Activate selected view
    if (viewName === "profile") {
      if (viewProfile) viewProfile.style.display = "block";
      if (tabProfile) tabProfile.classList.add("active");
    } else if (viewName === "energy") {
      if (viewEnergy) viewEnergy.style.display = "block";
      if (tabEnergy) tabEnergy.classList.add("active");
    } else if (viewName === "erse") {
      if (viewErse) viewErse.style.display = "block";
      if (tabErse) tabErse.classList.add("active");
    }

    if (cardEl) cardEl.setAttribute("data-view", viewName);
  }

  function cycleNextView() {
    const currentIndex = VIEWS.indexOf(activeView);
    const nextIndex = (currentIndex + 1) % VIEWS.length;
    switchView(VIEWS[nextIndex]);
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
        cycleNextView();
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
    const tabErse = document.getElementById("tab-erse");
    const btnGotoEnergy = document.getElementById("btn-goto-energy");
    const btnAutoCycle = document.getElementById("btn-auto-cycle");
    const btnLang = document.getElementById("btn-lang-toggle");

    if (tabProfile) {
      tabProfile.addEventListener("click", () => switchView("profile"));
    }
    if (tabEnergy) {
      tabEnergy.addEventListener("click", () => switchView("energy"));
    }
    if (tabErse) {
      tabErse.addEventListener("click", () => switchView("erse"));
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
      } else if (key === "3" || key === "c") {
        switchView("erse");
      } else if (key === "tab") {
        e.preventDefault();
        cycleNextView();
      } else if (key === "w" || key === "m") {
        if (window.EnergyDashboard && activeView === "energy") {
          window.EnergyDashboard.cycleEvolution();
        }
      } else if (key === "d" || key === "f") {
        if (window.EnergyDashboard && activeView === "energy") {
          window.EnergyDashboard.cyclePrediction();
        }
      } else if (key === "r") {
        if (window.EnergyDashboard && activeView === "energy") {
          window.EnergyDashboard.refresh();
        } else if (window.ErseSimulator && activeView === "erse") {
          window.ErseSimulator.update();
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

    // 6. Initialize ERSE retail tariff comparator
    if (window.ErseSimulator && typeof window.ErseSimulator.init === "function") {
      window.ErseSimulator.init();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
  } else {
    initApp();
  }
})();

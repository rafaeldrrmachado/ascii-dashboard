/**
 * Cyber-Terminal Internationalization (i18n) Engine
 * Seamless dual-language support (English / Portuguese) with persistent preferences.
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "terminal_lang_pref";

  const DICTIONARY = {
    en: {
      // Header & Navigation
      tab_profile: "[ 1: PROFILE ]",
      tab_energy: "[ 2: ENERGY MIBEL-PT ]",
      auto_cycle_off: "[AUTO: OFF]",
      auto_cycle_on: "[AUTO: ON (25s)]",
      lang_btn: "[LANG: EN]",
      lang_title: "Swap language (EN / PT) [Key: L]",
      auto_cycle_title: "Toggle Auto-cycle between views for ambient display [Key: A]",

      // Profile View
      dashboard: "Dashboard",
      time: "Time",
      weather: "Weather",
      weather_val: "22°C / CLEAR",
      energy: "Energy",
      view_grid: "[VIEW GRID ↵]",
      status: "Status",
      status_online: "ONLINE",
      profile_loading: "LOADING...",

      // Energy View - Banner
      source_omie: "MIBEL :: PORTUGAL (OMIE OFFICIAL)",
      source_ree: "MIBEL :: PENINSULAR (REE PROXY)",
      badge_cheap: "CHEAP",
      badge_normal: "NORMAL",
      badge_high: "HIGH",
      badge_peak: "PEAK",
      today_min: "TODAY MIN",
      today_avg: "AVG",
      today_max: "MAX",

      // Energy View - Evolution
      price_evolution: "Price Evolution",
      label_24h: "24-HOUR (LAST 24H)",
      label_week: "7-DAY (WEEK)",
      label_month: "30-DAY (MONTH)",
      mode_title_24h: "LAST 24H",
      mode_title_week: "7-DAY",
      mode_title_month: "30-DAY",
      hud_placeholder: "[ TELEMETRY: HOVER/TAP GRAPH FOR DATA ]",
      period_avg: "PERIOD AVG",
      min: "MIN",
      max: "MAX",
      peak: "PEAK",
      shift_24h: "24H SHIFT",
      trend: "TREND",
      no_history: "NO HISTORICAL DATA AVAILABLE",
      no_telemetry: "NO TELEMETRY AVAILABLE",

      // Energy View - Prediction
      price_prediction: "Price Prediction",
      label_tomorrow: "TOMORROW (DAY-AHEAD)",
      label_outlook: "7-DAY OUTLOOK",
      solar_valley: "SOLAR VALLEY (CHEAP)",
      day_ahead_avg: "DAY-AHEAD AVG",
      forecast_7d_avg: "7-DAY FORECAST AVG",
      projected_low: "PROJECTED LOW",
      rec_optimal: "OPTIMAL CONSUMPTION",
      rec_solar_valley_tag: "Solar Valley",
      rec_avoid: "Avoid intensive appliance use during peak rates",
      rec_lowest_day: "PROJECTED LOWEST DAY",
      rec_weekend_info: "Industrial load reduction yields ~35% lower wholesale rates on weekends.",
      tomorrow_tag: "TOMORROW",

      // Footer & Sync
      syncing: "[SYNCING...]",
      sync_prefix: "SYNCED",
      sync_badge_label: "[SYNC: AUTO (15M)]",
      hotkey_hint: "[Keys: 1/2 View · W Evolution · D/F Forecast · R Refresh · A Auto · L Lang]",
      refresh_btn: "[REFRESH ↻]",

      // Date Names
      months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    },

    pt: {
      // Header & Navigation
      tab_profile: "[ 1: PERFIL ]",
      tab_energy: "[ 2: ENERGIA MIBEL-PT ]",
      auto_cycle_off: "[AUTO: DESL]",
      auto_cycle_on: "[AUTO: LIG (25s)]",
      lang_btn: "[LANG: PT]",
      lang_title: "Mudar idioma (PT / EN) [Tecla: L]",
      auto_cycle_title: "Alternar rotação automática de ecrãs [Tecla: A]",

      // Profile View
      dashboard: "Painel de Controlo",
      time: "Hora",
      weather: "Meteorologia",
      weather_val: "22°C / LIMPO",
      energy: "Energia",
      view_grid: "[VER REDE ↵]",
      status: "Estado",
      status_online: "ONLINE",
      profile_loading: "A CARREGAR...",

      // Energy View - Banner
      source_omie: "MIBEL :: PORTUGAL (OFICIAL OMIE)",
      source_ree: "MIBEL :: PENINSULAR (PROXY REE)",
      badge_cheap: "BARATO",
      badge_normal: "NORMAL",
      badge_high: "ALTO",
      badge_peak: "PONTA",
      today_min: "MÍN HOJE",
      today_avg: "MÉDIA",
      today_max: "MÁX",

      // Energy View - Evolution
      price_evolution: "Evolução de Preço",
      label_24h: "24 HORAS (ÚLTIMAS 24H)",
      label_week: "7 DIAS (SEMANA)",
      label_month: "30 DIAS (MÊS)",
      mode_title_24h: "ÚLTIMAS 24H",
      mode_title_week: "7 DIAS",
      mode_title_month: "30 DIAS",
      hud_placeholder: "[ TELEMETRIA: PASSE/TOQUE NO GRÁFICO ]",
      period_avg: "MÉDIA DO PERÍODO",
      min: "MÍN",
      max: "MÁX",
      peak: "PICO",
      shift_24h: "VARIAÇÃO 24H",
      trend: "TENDÊNCIA",
      no_history: "SEM HISTÓRICO DISPONÍVEL",
      no_telemetry: "SEM TELEMETRIA DISPONÍVEL",

      // Energy View - Prediction
      price_prediction: "Previsão de Preço",
      label_tomorrow: "AMANHÃ (DIÁRIO)",
      label_outlook: "PREVISÃO A 7 DIAS",
      solar_valley: "VALE SOLAR (ECONÓMICO)",
      day_ahead_avg: "MÉDIA DIÁRIA",
      forecast_7d_avg: "MÉDIA PREVISTA (7D)",
      projected_low: "MÍNIMA PREVISTA",
      rec_optimal: "CONSUMO IDEAL",
      rec_solar_valley_tag: "Vale Solar",
      rec_avoid: "Evite aparelhos de alto consumo durante as horas de ponta",
      rec_lowest_day: "DIA MAIS ECONÓMICO PREVISTO",
      rec_weekend_info: "A redução do consumo industrial resulta em tarifas ~35% mais baixas ao fim de semana.",
      tomorrow_tag: "AMANHÃ",

      // Footer & Sync
      syncing: "[A SINCRONIZAR...]",
      sync_prefix: "SINC",
      sync_badge_label: "[SINC: AUTO (15M)]",
      hotkey_hint: "[Teclas: 1/2 Ver · W Evolução · D/F Previsão · R Atualizar · A Auto · L Idioma]",
      refresh_btn: "[ATUALIZAR ↻]",

      // Date Names
      months: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
      weekdays: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
    }
  };

  let currentLang = "en";
  const listeners = [];

  // Initialize language preference
  function initLang() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "pt" || saved === "en") {
        currentLang = saved;
        return;
      }
    } catch (_) {}

    // Auto-detect Portuguese from browser locale if no manual choice was stored
    if (typeof navigator !== "undefined" && navigator.language && navigator.language.toLowerCase().startsWith("pt")) {
      currentLang = "pt";
    } else {
      currentLang = "en";
    }
  }

  function getLang() {
    return currentLang;
  }

  function t(key) {
    const dict = DICTIONARY[currentLang] || DICTIONARY.en;
    if (dict && dict[key] !== undefined) {
      return dict[key];
    }
    return (DICTIONARY.en && DICTIONARY.en[key]) || key;
  }

  function getMonths() {
    return DICTIONARY[currentLang].months;
  }

  function getWeekdays() {
    return DICTIONARY[currentLang].weekdays;
  }

  function setLang(lang) {
    if (lang !== "en" && lang !== "pt") return;
    currentLang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (_) {}

    updateDOM();

    // Notify registered modules
    listeners.forEach((fn) => {
      try {
        fn(currentLang);
      } catch (e) {
        console.warn("i18n listener error:", e);
      }
    });
  }

  function toggleLang() {
    setLang(currentLang === "en" ? "pt" : "en");
  }

  function onChange(fn) {
    if (typeof fn === "function") {
      listeners.push(fn);
    }
  }

  function updateDOM() {
    // 1. Update HTML document lang attribute
    document.documentElement.lang = currentLang;

    // 2. Update Terminal Card data-lang attribute for CSS pseudo-element headers
    const cardEl = document.querySelector(".card");
    if (cardEl) {
      cardEl.setAttribute("data-lang", currentLang);
    }

    // 3. Update Language toggle button
    const btnLang = document.getElementById("btn-lang-toggle");
    if (btnLang) {
      btnLang.textContent = t("lang_btn");
      btnLang.title = t("lang_title");
    }

    // 4. Update elements with data-i18n attribute
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const translation = t(key);
      if (translation) {
        el.textContent = translation;
      }
    });

    // 5. Update elements with data-i18n-title attribute
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      const translation = t(key);
      if (translation) {
        el.title = translation;
      }
    });
  }

  initLang();

  global.I18n = {
    getLang,
    setLang,
    toggleLang,
    t,
    getMonths,
    getWeekdays,
    onChange,
    updateDOM
  };
})(window);


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
      tab_erse: "[ 3: ERSE COMPARATOR ]",
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

      // ERSE Retail Tariff Comparator View
      erse_title: "ERSE Electricity Comparator :: Portugal",
      erse_source_badge: "ERSE OFFICIAL TARIFF DATABASE (BTN)",
      erse_hud_best_label: "LOWEST ESTIMATED BILL",
      erse_hud_reg_label: "REGULATED BENCHMARK (TUR)",
      erse_hud_savings_label: "MAX ANNUAL SAVINGS",
      erse_power_label: "CONTRACTED POWER (kVA)",
      erse_cycle_label: "HOURLY CYCLE",
      erse_cycle_simple: "Simple (Flat)",
      erse_cycle_dual: "Bi-hourly (Peak / Off-Peak)",
      erse_consumption_label: "ESTIMATED ANNUAL CONSUMPTION",
      erse_preset_couple: "1,900 kWh (Couple)",
      erse_preset_family: "3,900 kWh (Family)",
      erse_preset_high: "5,500 kWh (High / EV)",
      erse_filter_label: "OFFER FILTER",
      erse_filter_all: "ALL OFFERS",
      erse_filter_fixed: "FIXED PRICE",
      erse_filter_indexed: "SPOT INDEXED (OMIE)",
      erse_filter_green: "100% GREEN",
      erse_leaderboard_title: "SUPPLIER RANKINGS & ESTIMATED COSTS",
      erse_monthly: "/mo",
      erse_annual: "/yr",
      erse_power_cost: "Capacity",
      erse_energy_cost: "Energy",
      erse_peak_cost: "Peak",
      erse_offpeak_cost: "Off-Peak",
      erse_savings_vs_reg: "Savings vs Regulated",
      erse_more_than_reg: "Higher than Regulated",
      erse_regulated_badge: "REGULATED BENCHMARK",
      erse_badge_fixed: "FIXED",
      erse_badge_indexed: "INDEXED OMIE",
      erse_badge_green: "100% GREEN",
      erse_official_link: "[ OFFICIAL ERSE SIMULATOR ↗ ]",
      erse_taxes_note: "* Calculated using official Portuguese residential low-voltage (BTN) taxes: VAT (6% on first 100 kWh/mo for <= 6.9 kVA, 23% remainder), CAV (2.85€), IEC (0.001€/kWh), and DGEG (0.07€).",
      taxes_included: "inc. taxes (VAT 6%/23%, CAV, IEC, DGEG)",

      // My Current Plan Custom Comparison
      my_plan_header: "MY CURRENT PLAN (COMPARE MY RATES)",
      my_plan_badge_active: "[ACTIVE]",
      my_plan_badge_inactive: "[OFF]",
      my_plan_btn_open: "[ CONFIGURE MY RATES ▾ ]",
      my_plan_btn_close: "[ HIDE CONFIGURATION ▴ ]",
      my_plan_supplier_label: "Supplier / Contract Name:",
      my_plan_tf_label: "Power Capacity (Fixed Fee €/day):",
      my_plan_tv_label: "Energy Rate (Variable Term €/kWh):",
      my_plan_tv_fv_label: "Peak / Daytime Rate (Off-Peak €/kWh):",
      my_plan_tv_v_label: "Off-Peak / Night Rate (Vazio €/kWh):",
      my_plan_apply: "[ ACTIVATE COMPARISON ✓ ]",
      my_plan_disable: "[ DISABLE ✕ ]",
      my_plan_clear: "[ CLEAR VALUES ]",
      my_plan_tip: "* Enter net rates from your invoice (before VAT/fees). Taxes and levies are calculated automatically.",
      my_plan_card_badge: "MY CURRENT PLAN",
      my_plan_card_tag: "● YOUR CURRENT CONTRACT",
      my_plan_savings_vs_mine: "Savings vs Your Plan",
      my_plan_more_than_mine: "Higher than Your Plan",
      erse_hud_my_plan_label: "MY CURRENT ESTIMATED BILL",
      erse_hud_savings_vs_mine_label: "SAVINGS VS MY PLAN",

      // Footer & Sync
      syncing: "[SYNCING...]",
      sync_prefix: "SYNCED",
      sync_badge_label: "[SYNC: AUTO (15M)]",
      hotkey_hint: "[Keys: 1/2/3 View · C Comparator · W Evol · D/F Forecast · R Refresh · A Auto · L Lang]",
      refresh_btn: "[REFRESH ↻]",

      // Date Names
      months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    },

    pt: {
      // Header & Navigation
      tab_profile: "[ 1: PERFIL ]",
      tab_energy: "[ 2: ENERGIA MIBEL-PT ]",
      tab_erse: "[ 3: COMPARADOR ERSE ]",
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

      // ERSE Retail Tariff Comparator View
      erse_title: "Comparador de Eletricidade ERSE :: Portugal",
      erse_source_badge: "BASE OFICIAL ERSE (TARIFAS BTN)",
      erse_hud_best_label: "TARIFA MAIS ECONÓMICA",
      erse_hud_reg_label: "MERCADO REGULADO (TUR)",
      erse_hud_savings_label: "POUPANÇA ANUAL MÁXIMA",
      erse_power_label: "POTÊNCIA CONTRATADA (kVA)",
      erse_cycle_label: "CICLO HORÁRIO",
      erse_cycle_simple: "Simples",
      erse_cycle_dual: "Bi-horário",
      erse_consumption_label: "CONSUMO ANUAL ESTIMADO",
      erse_preset_couple: "1 900 kWh (Casal)",
      erse_preset_family: "3 900 kWh (Família)",
      erse_preset_high: "5 500 kWh (Elevado / VE)",
      erse_filter_label: "FILTRAR OFERTAS",
      erse_filter_all: "TODAS AS OFERTAS",
      erse_filter_fixed: "PREÇO FIXO",
      erse_filter_indexed: "INDEXADO OMIE",
      erse_filter_green: "100% RENOVÁVEL",
      erse_leaderboard_title: "CLASSIFICAÇÃO DE COMERCIALIZADORES",
      erse_monthly: "/mês",
      erse_annual: "/ano",
      erse_power_cost: "Potência",
      erse_energy_cost: "Energia",
      erse_peak_cost: "Fora Vazio",
      erse_offpeak_cost: "Vazio",
      erse_savings_vs_reg: "Poupança vs Regulado",
      erse_more_than_reg: "Superior ao Regulado",
      erse_regulated_badge: "BENCHMARK REGULADO",
      erse_badge_fixed: "FIXO",
      erse_badge_indexed: "INDEXADO OMIE",
      erse_badge_green: "100% VERDE",
      erse_official_link: "[ SIMULADOR OFICIAL ERSE ↗ ]",
      erse_taxes_note: "* Calculado com impostos oficiais para baixa tensão normal (BTN): IVA (6% nos primeiros 100 kWh/mês para <= 6,9 kVA, 23% restante), CAV (2,85€), IEC (0,001€/kWh) e DGEG (0,07€).",
      taxes_included: "c/ impostos (IVA 6%/23%, CAV, IEC, DGEG)",

      // My Current Plan Custom Comparison
      my_plan_header: "O MEU PLANO ATUAL (COMPARAR TARIFAS)",
      my_plan_badge_active: "[ATIVO]",
      my_plan_badge_inactive: "[DESLIGADO]",
      my_plan_btn_open: "[ CONFIGURAR O MEU PLANO ▾ ]",
      my_plan_btn_close: "[ RECOLHER CONFIGURAÇÃO ▴ ]",
      my_plan_supplier_label: "Nome do Comercializador / Contrato:",
      my_plan_tf_label: "Potência (Termo Fixo €/dia):",
      my_plan_tv_label: "Energia (Termo Variável €/kWh):",
      my_plan_tv_fv_label: "Fora Vazio (Cheias/Ponta €/kWh):",
      my_plan_tv_v_label: "Vazio (Noite/Fim-de-semana €/kWh):",
      my_plan_apply: "[ ATIVAR COMPARAÇÃO ✓ ]",
      my_plan_disable: "[ DESATIVAR ✕ ]",
      my_plan_clear: "[ LIMPAR VALORES ]",
      my_plan_tip: "* Insira os valores líquidos da fatura (sem IVA). O simulador aplica os mesmos impostos (IVA, CAV, IEC, DGEG) automaticamente.",
      my_plan_card_badge: "MEU PLANO ATUAL",
      my_plan_card_tag: "● O SEU CONTRATO ATUAL",
      my_plan_savings_vs_mine: "Poupança vs Seu Plano",
      my_plan_more_than_mine: "Superior ao Seu Plano",
      erse_hud_my_plan_label: "CUSTO DO SEU PLANO",
      erse_hud_savings_vs_mine_label: "POUPANÇA VS MEU PLANO",

      // Footer & Sync
      syncing: "[A SINCRONIZAR...]",
      sync_prefix: "SINC",
      sync_badge_label: "[SINC: AUTO (15M)]",
      hotkey_hint: "[Teclas: 1/2/3 Ver · C Comparador · W Evol · D/F Previsão · R Atualizar · A Auto · L Idioma]",
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

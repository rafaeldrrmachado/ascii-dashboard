/**
 * ERSE Portugal Retail Electricity Comparator Module
 * Compares official low-voltage domestic (BTN) retail tariffs from ERSE (Entidade Reguladora dos Serviços Energéticos)
 * Includes official regulated market benchmark (SU Eletricidade / TUR), fixed tariffs, spot-indexed offers,
 * and user custom plan comparison ("Compare with my current prices").
 */
(function (global) {
  "use strict";

  const LOCAL_ERSE_PATH = "data/erse_tariffs.json";
  const ERSE_SIMULATOR_URL = "https://simuladorprecos.erse.pt/";
  const MY_PLAN_STORAGE_KEY = "terminal_my_electricity_plan";

  // State
  const state = {
    tariffsData: null,
    power: "3.45",       // '3.45' | '4.60' | '6.90'
    cycle: "simple",     // 'simple' | 'dual'
    annualKwh: 1900,     // Default Casal (1,900 kWh/ano)
    filter: "all",       // 'all' | 'fixed' | 'indexed' | 'green'
    isLoaded: false,
    myPlanFormOpen: false,
    myPlan: {
      enabled: false,
      supplier: "",
      tf: 0,
      tv_simple: 0,
      tv_fv: 0,
      tv_v: 0
    }
  };

  /**
   * Load saved user plan from localStorage
   */
  function loadMyPlan() {
    try {
      const saved = localStorage.getItem(MY_PLAN_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          state.myPlan = { ...state.myPlan, ...parsed };
        }
      }
    } catch (_) {}
  }

  /**
   * Save user plan to localStorage
   */
  function saveMyPlan() {
    try {
      localStorage.setItem(MY_PLAN_STORAGE_KEY, JSON.stringify(state.myPlan));
    } catch (_) {}
  }

  /**
   * Fetch ERSE tariffs JSON
   */
  async function fetchTariffs() {
    try {
      const resp = await fetch(LOCAL_ERSE_PATH + "?t=" + Date.now(), { cache: "no-store" });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status} loading ERSE tariffs`);
      }
      const data = await resp.json();
      state.tariffsData = data;
      state.isLoaded = true;
      return data;
    } catch (err) {
      console.warn("Could not fetch local ERSE tariffs:", err);
      return null;
    }
  }

  /**
   * Calculate residential electricity bill for Portugal (BTN <= 6.90 kVA)
   * Includes Portuguese VAT rules (6% on first 100 kWh/month for <= 6.9 kVA, 23% remainder),
   * CAV (Contribuição Audiovisual), DGEG fee, and IEC (Imposto Especial de Consumo).
   */
  function calculateBill(tariff, powerKva, cycleType, annualKwh) {
    if (!tariff || !tariff.rates || !tariff.rates[powerKva]) {
      return null;
    }

    const ratesForPower = tariff.rates[powerKva];
    const ratePlan = ratesForPower[cycleType];
    if (!ratePlan) {
      return null;
    }

    const monthlyKwh = annualKwh / 12;
    const daysInMonth = 30; // ERSE standard monthly billing model

    // 1. Capacity term (Termo Fixo)
    const tfDaily = Number(ratePlan.tf) || 0;
    const capacityCostMonthly = tfDaily * daysInMonth;

    // 2. Energy term (Termo Variável)
    let energyCostMonthly = 0;
    let avgTv = 0;

    if (cycleType === "simple") {
      const tv = Number(ratePlan.tv) || 0;
      energyCostMonthly = monthlyKwh * tv;
      avgTv = tv;
    } else {
      // Bi-horário standard domestic profile: 60% Fora Vazio (day/peak), 40% Vazio (night/weekend)
      const tvFv = Number(ratePlan.tv_fora_vazio) || 0;
      const tvV = Number(ratePlan.tv_vazio) || 0;
      const kwhFv = monthlyKwh * 0.60;
      const kwhV = monthlyKwh * 0.40;
      energyCostMonthly = (kwhFv * tvFv) + (kwhV * tvV);
      avgTv = monthlyKwh > 0 ? (energyCostMonthly / monthlyKwh) : 0;
    }

    // 3. Regulated taxes & levies
    const cav = 2.85; // Contribuição Audiovisual
    const dgeg = 0.07; // Taxa DGEG
    const iec = monthlyKwh * 0.001; // Imposto Especial de Consumo (0.001 €/kWh)

    // 4. VAT (IVA) calculation
    // Decreto-Lei n.º 60/2019: For contracted power <= 6.90 kVA, the first 100 kWh/month is taxed at 6%.
    // Remaining energy, capacity term, DGEG and IEC are taxed at 23%.
    // CAV is taxed at 6%.
    const reducedKwh = Math.min(monthlyKwh, 100);
    const standardKwh = Math.max(0, monthlyKwh - 100);

    const energyVat6 = (reducedKwh * avgTv) * 0.06;
    const energyVat23 = (standardKwh * avgTv) * 0.23;
    const capacityVat23 = capacityCostMonthly * 0.23;
    const leviesVat23 = (dgeg + iec) * 0.23;
    const cavVat6 = cav * 0.06;

    const totalVat = energyVat6 + energyVat23 + capacityVat23 + leviesVat23 + cavVat6;

    const subtotalNoVat = capacityCostMonthly + energyCostMonthly + cav + dgeg + iec;
    const monthlyTotal = subtotalNoVat + totalVat;
    const annualTotal = monthlyTotal * 12;

    return {
      tariff,
      tfDaily,
      capacityCostMonthly,
      energyCostMonthly,
      avgTv,
      rates: ratePlan,
      cav,
      dgeg,
      iec,
      totalVat,
      subtotalNoVat,
      monthlyTotal,
      annualTotal
    };
  }

  /**
   * Helper to format currency values
   */
  function fmtEur(val, decimals = 2) {
    if (val === null || val === undefined || isNaN(val)) return "--.--";
    return Number(val).toFixed(decimals).replace(".", ",");
  }

  function fmtKwhRate(val) {
    if (val === null || val === undefined || isNaN(val)) return "-.----";
    return Number(val).toFixed(4).replace(".", ",");
  }

  /**
   * Generate ASCII Meter Bar
   */
  function generateAsciiBar(value, minVal, maxVal, barLength = 16) {
    if (minVal === maxVal || isNaN(value)) {
      return "[" + "█".repeat(Math.floor(barLength / 2)) + "░".repeat(Math.ceil(barLength / 2)) + "]";
    }
    const range = Math.max(0.01, maxVal - minVal);
    const pct = Math.max(0, Math.min(1, (value - minVal) / range));
    const filled = Math.round(pct * barLength);
    const empty = Math.max(0, barLength - filled);
    return "[" + "█".repeat(filled) + "░".repeat(empty) + "]";
  }

  /**
   * Construct custom user plan tariff object
   */
  function createMyPlanTariff() {
    if (!state.myPlan.enabled) return null;

    const tf = Number(state.myPlan.tf) || 0;
    const tv = Number(state.myPlan.tv_simple) || 0;
    const tvFv = Number(state.myPlan.tv_fv) || 0;
    const tvV = Number(state.myPlan.tv_v) || 0;

    const t = window.I18n ? window.I18n.t : (k) => k;
    const supplierDisplay = state.myPlan.supplier.trim() || (t("my_plan_card_badge") || "O MEU PLANO");
    const planDisplay = t("my_plan_card_tag") || "Contrato Atual";

    return {
      id: "custom_my_plan",
      com_code: "MY_PLAN",
      supplier: supplierDisplay,
      plan_name: planDisplay,
      is_custom: true,
      is_regulated: false,
      is_indexed: false,
      green_energy: false,
      color: "#00e5ff",
      website: "",
      rates: {
        "3.45": {
          simple: { tf, tv },
          dual: { tf, tv_fora_vazio: tvFv, tv_vazio: tvV }
        },
        "4.60": {
          simple: { tf, tv },
          dual: { tf, tv_fora_vazio: tvFv, tv_vazio: tvV }
        },
        "6.90": {
          simple: { tf, tv },
          dual: { tf, tv_fora_vazio: tvFv, tv_vazio: tvV }
        }
      }
    };
  }

  /**
   * Filter and rank tariffs
   */
  function getRankedTariffs() {
    if (!state.tariffsData || !state.tariffsData.tariffs) {
      return { ranked: [], regulatedBill: null, myPlanBill: null, minMonthly: 0, maxMonthly: 0 };
    }

    const allTariffs = state.tariffsData.tariffs;
    let regulatedBill = null;
    let myPlanBill = null;

    // Calculate bills for all official suppliers
    const calculated = [];
    allTariffs.forEach((t) => {
      const bill = calculateBill(t, state.power, state.cycle, state.annualKwh);
      if (bill) {
        if (t.is_regulated || t.com_code === "TUR") {
          regulatedBill = bill;
        }
        calculated.push(bill);
      }
    });

    // Fallback if no TUR found explicitly
    if (!regulatedBill && calculated.length > 0) {
      regulatedBill = calculated[0];
    }

    // Include custom user plan if enabled
    const customTariff = createMyPlanTariff();
    if (customTariff) {
      myPlanBill = calculateBill(customTariff, state.power, state.cycle, state.annualKwh);
      if (myPlanBill) {
        calculated.push(myPlanBill);
      }
    }

    // Apply Filter
    let filtered = calculated.filter((b) => {
      if (b.tariff.is_custom) return true; // Always display user's own plan in the leaderboard
      if (state.filter === "fixed") return !b.tariff.is_indexed;
      if (state.filter === "indexed") return b.tariff.is_indexed;
      if (state.filter === "green") return b.tariff.green_energy;
      return true; // 'all'
    });

    // Sort by monthly total ascending (cheapest first)
    filtered.sort((a, b) => a.monthlyTotal - b.monthlyTotal);

    const minMonthly = filtered.length > 0 ? filtered[0].monthlyTotal : 0;
    const maxMonthly = filtered.length > 0 ? filtered[filtered.length - 1].monthlyTotal : 0;

    return {
      ranked: filtered,
      regulatedBill,
      myPlanBill,
      minMonthly,
      maxMonthly
    };
  }

  /**
   * Render Top Summary HUD
   */
  function renderHud(summary) {
    const elBestName = document.getElementById("erse-hud-best-name");
    const elBestVal = document.getElementById("erse-hud-best-val");
    const elRegVal = document.getElementById("erse-hud-reg-val");
    const elSavingsVal = document.getElementById("erse-hud-savings-val");
    const elSourceBadge = document.getElementById("erse-source-badge");

    const elBenchmarkTitle = document.getElementById("erse-hud-benchmark-title");
    const elBenchmarkSub = document.getElementById("erse-hud-benchmark-sub");
    const elSavingsTitle = document.getElementById("erse-hud-savings-title");
    const elSavingsSub = document.getElementById("erse-hud-savings-sub");

    const t = window.I18n ? window.I18n.t : (k) => k;

    if (elSourceBadge && state.tariffsData) {
      const updatedDate = state.tariffsData.last_updated ? state.tariffsData.last_updated.substring(0, 10) : "";
      elSourceBadge.textContent = (t("erse_source_badge") || "BASE OFICIAL ERSE") + (updatedDate ? ` · ${updatedDate}` : "");
    }

    if (!summary.ranked || summary.ranked.length === 0) {
      if (elBestName) elBestName.textContent = "--";
      if (elBestVal) elBestVal.textContent = "-- €/mês";
      if (elRegVal) elRegVal.textContent = "-- €/mês";
      if (elSavingsVal) elSavingsVal.textContent = "-- €/ano";
      return;
    }

    const best = summary.ranked[0];

    if (elBestName) {
      elBestName.textContent = `${best.tariff.supplier}`;
    }
    if (elBestVal) {
      elBestVal.textContent = `${fmtEur(best.monthlyTotal)} €${t("erse_monthly") || "/mês"}`;
    }

    // Benchmark comparison: Compare vs My Current Plan if active, otherwise vs Regulated Market (TUR)
    if (summary.myPlanBill) {
      const myPlan = summary.myPlanBill;

      if (elBenchmarkTitle) elBenchmarkTitle.textContent = t("erse_hud_my_plan_label") || "CUSTO DO SEU PLANO";
      if (elRegVal) elRegVal.textContent = `${fmtEur(myPlan.monthlyTotal)} €${t("erse_monthly") || "/mês"}`;
      if (elBenchmarkSub) elBenchmarkSub.textContent = myPlan.tariff.supplier;

      if (elSavingsTitle) elSavingsTitle.textContent = t("erse_hud_savings_vs_mine_label") || "POUPANÇA VS MEU PLANO";
      if (elSavingsSub) elSavingsSub.textContent = t("my_plan_card_tag") || "vs Seu Contrato";

      if (elSavingsVal) {
        const diffAnnual = myPlan.annualTotal - best.annualTotal;
        if (best.tariff.is_custom) {
          elSavingsVal.innerHTML = `<span class="val-positive">${fmtEur(0)} €${t("erse_annual") || "/ano"}</span>`;
          if (elSavingsSub) elSavingsSub.textContent = "Seu plano é o #1 mais barato!";
        } else if (diffAnnual > 0.5) {
          elSavingsVal.innerHTML = `<span class="val-positive">+${fmtEur(diffAnnual)} €${t("erse_annual") || "/ano"}</span>`;
        } else if (diffAnnual < -0.5) {
          elSavingsVal.innerHTML = `<span class="val-neutral">0,00 €${t("erse_annual") || "/ano"}</span>`;
        } else {
          elSavingsVal.innerHTML = `<span class="val-neutral">0,00 €${t("erse_annual") || "/ano"}</span>`;
        }
      }
    } else {
      const reg = summary.regulatedBill || best;

      if (elBenchmarkTitle) elBenchmarkTitle.textContent = t("erse_hud_reg_label") || "MERCADO REGULADO (TUR)";
      if (elRegVal) elRegVal.textContent = `${fmtEur(reg.monthlyTotal)} €${t("erse_monthly") || "/mês"}`;
      if (elBenchmarkSub) elBenchmarkSub.textContent = "SU Eletricidade";

      if (elSavingsTitle) elSavingsTitle.textContent = t("erse_hud_savings_label") || "POUPANÇA ANUAL MÁXIMA";
      if (elSavingsSub) elSavingsSub.textContent = "vs Regulado";

      if (elSavingsVal) {
        const savingsAnnual = reg.annualTotal - best.annualTotal;
        if (savingsAnnual > 0.5) {
          elSavingsVal.innerHTML = `<span class="val-positive">+${fmtEur(savingsAnnual)} €${t("erse_annual") || "/ano"}</span>`;
        } else {
          elSavingsVal.innerHTML = `<span class="val-neutral">0,00 €${t("erse_annual") || "/ano"}</span>`;
        }
      }
    }
  }

  /**
   * Render Leaderboard Cards
   */
  function renderLeaderboard(summary) {
    const container = document.getElementById("erse-leaderboard-list");
    if (!container) return;

    const t = window.I18n ? window.I18n.t : (k) => k;
    const benchmark = summary.myPlanBill || summary.regulatedBill;
    const isComparingMyPlan = Boolean(summary.myPlanBill);

    if (!summary.ranked || summary.ranked.length === 0) {
      container.innerHTML = `<div class="erse-empty-msg">[ ${t("no_history") || "NENHUMA TARIFA DISPONÍVEL COM ESTES FILTROS"} ]</div>`;
      return;
    }

    let html = "";
    summary.ranked.forEach((item, index) => {
      const rankNum = index + 1;
      const isBest = rankNum === 1;
      const isReg = item.tariff.is_regulated || item.tariff.com_code === "TUR";
      const isCustom = Boolean(item.tariff.is_custom);
      const isIndexed = item.tariff.is_indexed;
      const isGreen = item.tariff.green_energy;

      // Savings calculation relative to active benchmark (My Plan or TUR)
      let savingsHtml = "";
      if (isCustom) {
        savingsHtml = `<span class="erse-savings-tag tag-my-plan">● ${t("my_plan_card_tag") || "O SEU CONTRATO ATUAL"}</span>`;
      } else if (benchmark) {
        const diffAnnual = benchmark.annualTotal - item.annualTotal;
        const vsLabel = isComparingMyPlan
          ? (t("my_plan_savings_vs_mine") || "Poupança vs Seu Plano")
          : (t("erse_savings_vs_reg") || "Poupança vs Regulado");
        const higherLabel = isComparingMyPlan
          ? (t("my_plan_more_than_mine") || "Mais caro vs Seu Plano")
          : (t("erse_more_than_reg") || "Mais caro vs Regulado");

        if (isReg && !isComparingMyPlan) {
          savingsHtml = `<span class="erse-savings-tag tag-reg" title="${t("erse_regulated_badge")}">● ${t("erse_regulated_badge") || "BENCHMARK REGULADO"}</span>`;
        } else if (diffAnnual > 0.5) {
          savingsHtml = `<span class="erse-savings-tag tag-positive">▲ ${vsLabel}: <b>+${fmtEur(diffAnnual)} €${t("erse_annual") || "/ano"}</b></span>`;
        } else if (diffAnnual < -0.5) {
          savingsHtml = `<span class="erse-savings-tag tag-negative">▼ ${higherLabel}: <b>${fmtEur(Math.abs(diffAnnual))} €${t("erse_annual") || "/ano"}</b></span>`;
        } else {
          savingsHtml = `<span class="erse-savings-tag tag-neutral">≈ Preço equivalente</span>`;
        }
      }

      // ASCII bar
      const asciiBar = generateAsciiBar(item.monthlyTotal, summary.minMonthly, summary.maxMonthly, 14);

      // Energy rate details
      let rateDetailText = "";
      if (state.cycle === "simple") {
        rateDetailText = `<span class="rate-spec">${t("erse_power_cost") || "Potência"}: <b>${fmtKwhRate(item.tfDaily)} €/dia</b></span> · <span class="rate-spec">${t("erse_energy_cost") || "Energia"}: <b>${fmtKwhRate(item.rates.tv)} €/kWh</b></span>`;
      } else {
        rateDetailText = `<span class="rate-spec">${t("erse_power_cost") || "Potência"}: <b>${fmtKwhRate(item.tfDaily)} €/dia</b></span> · <span class="rate-spec">${t("erse_peak_cost") || "Fora Vazio"}: <b>${fmtKwhRate(item.rates.tv_fora_vazio)}</b> · ${t("erse_offpeak_cost") || "Vazio"}: <b>${fmtKwhRate(item.rates.tv_vazio)} €/kWh</b></span>`;
      }

      // Badges
      let badgesHtml = "";
      if (isCustom) {
        badgesHtml += `<span class="erse-chip-badge chip-my-plan">[ ${t("my_plan_card_badge") || "MEU PLANO"} ]</span> `;
      }
      if (isGreen) {
        badgesHtml += `<span class="erse-chip-badge chip-green" title="Energia 100% Renovável">[ ${t("erse_badge_green") || "100% VERDE"} ]</span> `;
      }
      if (isIndexed) {
        badgesHtml += `<span class="erse-chip-badge chip-indexed" title="Tarifa Indexada ao mercado diário OMIE">[ ${t("erse_badge_indexed") || "INDEXADO OMIE"} ]</span> `;
      }
      if (isReg) {
        badgesHtml += `<span class="erse-chip-badge chip-regulated" title="Tarifa Regulada por ERSE">[ ${t("erse_regulated_badge") || "REGULADO"} ]</span> `;
      }

      // Link button or custom indicator
      let linkButtonHtml = "";
      if (isCustom) {
        linkButtonHtml = `<button type="button" class="erse-ext-link btn-edit-my-plan" id="btn-edit-my-plan-card">[ EDITAR ✎ ]</button>`;
      } else {
        linkButtonHtml = `<a href="${item.tariff.website || ERSE_SIMULATOR_URL}" target="_blank" rel="noopener noreferrer" class="erse-ext-link">[${item.tariff.supplier.split(" ")[0]} ↗]</a>`;
      }

      const cardClasses = [
        "erse-card",
        isBest ? "erse-card-best" : "",
        isReg ? "erse-card-reg" : "",
        isCustom ? "erse-card-my-plan" : ""
      ].filter(Boolean).join(" ");

      html += `
        <article class="${cardClasses}" data-supplier="${item.tariff.com_code}">
          <div class="erse-card-top">
            <div class="erse-card-identity">
              <span class="erse-rank ${isCustom ? 'rank-cyan' : (isBest ? 'rank-gold' : '')}">#${rankNum}</span>
              <span class="erse-supplier-name">${item.tariff.supplier}</span>
              <span class="erse-plan-name">(${item.tariff.plan_name})</span>
            </div>
            <div class="erse-card-badges">
              ${badgesHtml}
            </div>
          </div>

          <div class="erse-card-pricing">
            <div class="erse-price-big">
              <span class="num">${fmtEur(item.monthlyTotal)}</span>
              <span class="unit">€${t("erse_monthly") || "/mês"}</span>
              <span class="annual-sub">(${fmtEur(item.annualTotal)} €${t("erse_annual") || "/ano"})</span>
            </div>
            <div class="erse-savings-slot">
              ${savingsHtml}
            </div>
          </div>

          <div class="erse-card-meter" aria-hidden="true">
            <span class="meter-bar">${asciiBar}</span>
            <span class="meter-percent">${fmtEur(item.monthlyTotal)} €/mês</span>
          </div>

          <div class="erse-card-details">
            <div class="erse-rates-line">
              ${rateDetailText}
            </div>
            <div class="erse-action-row">
              <span class="taxes-label">${t("taxes_included") || "c/ impostos (IVA 6%/23%, CAV, IEC)"}</span>
              ${linkButtonHtml}
            </div>
          </div>
        </article>
      `;
    });

    container.innerHTML = html;

    // Attach edit button on custom card
    const btnEditCard = document.getElementById("btn-edit-my-plan-card");
    if (btnEditCard) {
      btnEditCard.addEventListener("click", () => {
        setMyPlanFormOpen(true);
        const form = document.getElementById("my-plan-form");
        if (form) form.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }

  /**
   * Sync My Plan Form DOM with State
   */
  function syncMyPlanFormDOM() {
    const t = window.I18n ? window.I18n.t : (k) => k;

    const inputSupplier = document.getElementById("input-my-supplier");
    const inputTf = document.getElementById("input-my-tf");
    const inputTv = document.getElementById("input-my-tv");
    const inputTvFv = document.getElementById("input-my-tv-fv");
    const inputTvV = document.getElementById("input-my-tv-v");

    const btnToggle = document.getElementById("btn-toggle-my-plan");
    const badgeStatus = document.getElementById("my-plan-status-badge");
    const btnDisable = document.getElementById("btn-disable-my-plan");
    const cellSimple = document.getElementById("my-plan-simple-input-cell");
    const cellDualFv = document.getElementById("my-plan-dual-fv-cell");
    const cellDualV = document.getElementById("my-plan-dual-v-cell");
    const form = document.getElementById("my-plan-form");

    // Cycle visibility
    if (cellSimple) cellSimple.style.display = state.cycle === "simple" ? "block" : "none";
    if (cellDualFv) cellDualFv.style.display = state.cycle === "dual" ? "block" : "none";
    if (cellDualV) cellDualV.style.display = state.cycle === "dual" ? "block" : "none";

    // Form open / close
    if (form) form.style.display = state.myPlanFormOpen ? "block" : "none";
    if (btnToggle) {
      btnToggle.textContent = state.myPlanFormOpen
        ? (t("my_plan_btn_close") || "[ RECOLHER CONFIGURAÇÃO ▴ ]")
        : (t("my_plan_btn_open") || "[ CONFIGURAR O MEU PLANO ▾ ]");
    }

    // Active status
    if (badgeStatus) {
      if (state.myPlan.enabled) {
        badgeStatus.className = "my-plan-badge badge-on";
        badgeStatus.textContent = t("my_plan_badge_active") || "[ATIVO]";
      } else {
        badgeStatus.className = "my-plan-badge badge-off";
        badgeStatus.textContent = t("my_plan_badge_inactive") || "[DESLIGADO]";
      }
    }

    if (btnDisable) {
      btnDisable.style.display = state.myPlan.enabled ? "inline-block" : "none";
    }

    // Populate inputs if empty
    if (inputSupplier && state.myPlan.supplier && !inputSupplier.value) {
      inputSupplier.value = state.myPlan.supplier;
    }
    if (inputTf && state.myPlan.tf && !inputTf.value) {
      inputTf.value = state.myPlan.tf;
    }
    if (inputTv && state.myPlan.tv_simple && !inputTv.value) {
      inputTv.value = state.myPlan.tv_simple;
    }
    if (inputTvFv && state.myPlan.tv_fv && !inputTvFv.value) {
      inputTvFv.value = state.myPlan.tv_fv;
    }
    if (inputTvV && state.myPlan.tv_v && !inputTvV.value) {
      inputTvV.value = state.myPlan.tv_v;
    }
  }

  function setMyPlanFormOpen(open) {
    state.myPlanFormOpen = open;
    syncMyPlanFormDOM();
  }

  /**
   * Update all calculations and re-render UI
   */
  function update() {
    syncMyPlanFormDOM();
    const summary = getRankedTariffs();
    renderHud(summary);
    renderLeaderboard(summary);
  }

  /**
   * Bind DOM event listeners for buttons and slider
   */
  function bindEvents() {
    // 1. Contracted Power Buttons
    const powerButtons = document.querySelectorAll(".btn-erse-power");
    powerButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = btn.getAttribute("data-power");
        if (p) {
          state.power = p;
          powerButtons.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          update();
        }
      });
    });

    // 2. Cycle Buttons
    const cycleButtons = document.querySelectorAll(".btn-erse-cycle");
    cycleButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const c = btn.getAttribute("data-cycle");
        if (c) {
          state.cycle = c;
          cycleButtons.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          update();
        }
      });
    });

    // 3. Preset Buttons
    const presetButtons = document.querySelectorAll(".btn-erse-preset");
    const slider = document.getElementById("erse-kwh-slider");
    const sliderLabel = document.getElementById("erse-kwh-val-display");

    presetButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const kwh = parseInt(btn.getAttribute("data-kwh"), 10);
        if (!isNaN(kwh)) {
          state.annualKwh = kwh;
          if (slider) slider.value = kwh;
          if (sliderLabel) {
            sliderLabel.textContent = `${kwh.toLocaleString("pt-PT")} kWh/ano (~${Math.round(kwh / 12)} kWh/mês)`;
          }
          presetButtons.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          update();
        }
      });
    });

    // 4. Custom Slider
    if (slider) {
      slider.addEventListener("input", (e) => {
        const kwh = parseInt(e.target.value, 10);
        if (!isNaN(kwh)) {
          state.annualKwh = kwh;
          if (sliderLabel) {
            sliderLabel.textContent = `${kwh.toLocaleString("pt-PT")} kWh/ano (~${Math.round(kwh / 12)} kWh/mês)`;
          }
          presetButtons.forEach((b) => {
            const bVal = parseInt(b.getAttribute("data-kwh"), 10);
            if (bVal === kwh) {
              b.classList.add("active");
            } else {
              b.classList.remove("active");
            }
          });
          update();
        }
      });
    }

    // 5. Filter Chips
    const filterButtons = document.querySelectorAll(".btn-erse-filter");
    filterButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const f = btn.getAttribute("data-filter");
        if (f) {
          state.filter = f;
          filterButtons.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          update();
        }
      });
    });

    // 6. My Plan Toggle Form Button
    const btnToggleMyPlan = document.getElementById("btn-toggle-my-plan");
    if (btnToggleMyPlan) {
      btnToggleMyPlan.addEventListener("click", () => {
        setMyPlanFormOpen(!state.myPlanFormOpen);
      });
    }

    // 7. My Plan Apply Button
    const btnApplyMyPlan = document.getElementById("btn-apply-my-plan");
    if (btnApplyMyPlan) {
      btnApplyMyPlan.addEventListener("click", () => {
        const inputSupplier = document.getElementById("input-my-supplier");
        const inputTf = document.getElementById("input-my-tf");
        const inputTv = document.getElementById("input-my-tv");
        const inputTvFv = document.getElementById("input-my-tv-fv");
        const inputTvV = document.getElementById("input-my-tv-v");

        const supplier = (inputSupplier && inputSupplier.value.trim()) || "O Meu Contrato";
        const tf = parseFloat((inputTf && inputTf.value) || "0") || 0;
        const tvSimple = parseFloat((inputTv && inputTv.value) || "0") || 0;
        const tvFv = parseFloat((inputTvFv && inputTvFv.value) || "0") || 0;
        const tvV = parseFloat((inputTvV && inputTvV.value) || "0") || 0;

        if (tf <= 0 && tvSimple <= 0 && tvFv <= 0 && tvV <= 0) {
          alert("Por favor, introduza pelo menos um termo fixo (TF €/dia) ou termo de energia (TV €/kWh) válido.");
          return;
        }

        state.myPlan.enabled = true;
        state.myPlan.supplier = supplier;
        state.myPlan.tf = tf;
        if (tvSimple > 0) state.myPlan.tv_simple = tvSimple;
        if (tvFv > 0) state.myPlan.tv_fv = tvFv;
        if (tvV > 0) state.myPlan.tv_v = tvV;

        saveMyPlan();
        update();
      });
    }

    // 8. My Plan Disable Button
    const btnDisableMyPlan = document.getElementById("btn-disable-my-plan");
    if (btnDisableMyPlan) {
      btnDisableMyPlan.addEventListener("click", () => {
        state.myPlan.enabled = false;
        saveMyPlan();
        update();
      });
    }

    // 9. My Plan Clear Button
    const btnClearMyPlan = document.getElementById("btn-clear-my-plan");
    if (btnClearMyPlan) {
      btnClearMyPlan.addEventListener("click", () => {
        state.myPlan = {
          enabled: false,
          supplier: "",
          tf: 0,
          tv_simple: 0,
          tv_fv: 0,
          tv_v: 0
        };
        try {
          localStorage.removeItem(MY_PLAN_STORAGE_KEY);
        } catch (_) {}

        const inputSupplier = document.getElementById("input-my-supplier");
        const inputTf = document.getElementById("input-my-tf");
        const inputTv = document.getElementById("input-my-tv");
        const inputTvFv = document.getElementById("input-my-tv-fv");
        const inputTvV = document.getElementById("input-my-tv-v");

        if (inputSupplier) inputSupplier.value = "";
        if (inputTf) inputTf.value = "";
        if (inputTv) inputTv.value = "";
        if (inputTvFv) inputTv.value = "";
        if (inputTvV) inputTv.value = "";

        update();
      });
    }
  }

  /**
   * Module initialization
   */
  async function init() {
    loadMyPlan();
    bindEvents();

    // Listen to language changes
    if (window.I18n) {
      window.I18n.onChange(() => {
        update();
      });
    }

    await fetchTariffs();
    update();
  }

  // Public exports
  global.ErseSimulator = {
    init,
    update,
    fetchTariffs,
    setPower: (p) => { state.power = p; update(); },
    setCycle: (c) => { state.cycle = c; update(); },
    setAnnualKwh: (kwh) => { state.annualKwh = kwh; update(); },
    setFilter: (f) => { state.filter = f; update(); },
    getState: () => ({ ...state })
  };
})(window);

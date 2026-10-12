/**
 * Portugal Electricity (MIBEL / OMIE) Market Dashboard Controller
 * Real-time spot prices, historical evolution (24h/Week/Month), and predictive forecasts (Day-Ahead/7-Day).
 * Prioritizes official OMIE Portuguese marginal clearing prices (PRICE_PT) with live fallback proxy.
 */
(function (global) {
  "use strict";

  const LOCAL_OMIE_PATH = "data/omie_pt.json";
  const REE_PROXY_BASE = "https://apidatos.ree.es/es/datos/mercados/precios-mercados-tiempo-real";
  const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache
  const EVOLUTION_MODES = ["24h", "week", "month"];

  let omieDataset = null;

  // In-memory cache
  const cache = {
    recent: null,
    recentTime: 0,
    recent24h: null,
    recent24hTime: 0,
    weekHistory: null,
    weekTime: 0,
    monthHistory: null,
    monthTime: 0
  };

  // State
  const state = {
    evolutionMode: "24h",   // '24h' | 'week' | 'month'
    predictionMode: "day",  // 'day' | 'week'
    currentPrice: null,
    currentUnit: "€/MWh",
    todayStats: { min: 0, max: 0, avg: 0 },
    tomorrowStats: null,
    isOfficialOmie: false,
    sourceName: "OMIE (PT OFFICIAL)",
    isLive: false,
    lastUpdated: null
  };

  /**
   * Format Date to YYYY-MM-DD
   */
  function formatDate(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /**
   * Format Date to local YYYY-MM-DDTHH:mm:ss without UTC timezone shift
   */
  function formatLocalIso(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hour = String(d.getHours()).padStart(2, "0");
    const minute = String(d.getMinutes()).padStart(2, "0");
    const second = String(d.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  }

  /**
   * Update Source Badge
   */
  function updateSourceBadge(customText) {
    const el = document.getElementById("source-badge");
    if (!el) return;
    if (customText) {
      el.textContent = customText;
      return;
    }
    const isOmie = state.isOfficialOmie;
    const key = isOmie ? "source_omie" : "source_ree";
    const text = window.I18n ? window.I18n.t(key) : (isOmie ? "MIBEL :: PORTUGAL (OMIE OFFICIAL)" : "MIBEL PENINSULAR (REE PROXY)");
    el.textContent = text;
  }

  /**
   * Load Official OMIE Portugal Dataset
   */
  async function loadOmieDataset() {
    if (omieDataset) return omieDataset;

    try {
      const resp = await fetch(LOCAL_OMIE_PATH);
      if (resp.ok) {
        const json = await resp.json();
        if (json && Array.isArray(json.values) && json.values.length > 0) {
          omieDataset = json.values;
          state.isOfficialOmie = true;
          state.sourceName = "OMIE (PT OFFICIAL)";
          updateSourceBadge();
          return omieDataset;
        }
      }
    } catch (e) {
      // Local OMIE dataset not found or running on remote host without sync
    }

    state.isOfficialOmie = false;
    state.sourceName = "MIBEL PENINSULAR (REE PROXY)";
    updateSourceBadge();
    return null;
  }

  /**
   * Price Classification & Status Badge
   */
  function classifyPrice(price) {
    const t = (k, def) => (window.I18n ? window.I18n.t(k) : def);
    if (price <= 60) return { label: t("badge_cheap", "CHEAP"), className: "badge-cheap" };
    if (price <= 140) return { label: t("badge_normal", "NORMAL"), className: "badge-normal" };
    if (price <= 210) return { label: t("badge_high", "HIGH"), className: "badge-high" };
    return { label: t("badge_peak", "PEAK"), className: "badge-peak" };
  }

  /**
   * Synthetic Data Generator (Offline / Fallback)
   */
  function generateFallbackData(daysBack, daysForward) {
    const now = new Date();
    const points = [];

    for (let dayOffset = -daysBack; dayOffset <= daysForward; dayOffset++) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const basePrice = isWeekend ? 95 : 155;

      for (let hour = 0; hour < 24; hour++) {
        for (let q = 0; q < 4; q++) {
          const minute = q * 15;
          const dt = new Date(date);
          dt.setHours(hour, minute, 0, 0);

          let modifier = 1.0;
          if (hour >= 11 && hour <= 16) {
            modifier = 0.08 + 0.12 * Math.sin(((hour - 11) / 5) * Math.PI);
          } else if (hour >= 20 && hour <= 23) {
            modifier = 1.45 + 0.15 * Math.sin(((hour - 20) / 3) * Math.PI);
          } else if (hour >= 0 && hour <= 6) {
            modifier = 0.75 + 0.1 * Math.sin((hour / 6) * Math.PI);
          } else if (hour >= 8 && hour <= 10) {
            modifier = 1.25;
          }

          const noise = Math.sin(dayOffset * 13 + hour * 7 + q) * 12;
          const price = Math.max(0.5, Math.round((basePrice * modifier + noise) * 100) / 100);

          points.push({
            datetime: formatLocalIso(dt),
            value: price,
            decoupled: false
          });
        }
      }
    }

    return points;
  }

  /**
   * Fetch Day-Ahead & Recent Intraday Prices
   */
  async function fetchRecentData() {
    const now = Date.now();
    if (cache.recent && now - cache.recentTime < CACHE_TTL_MS) {
      return cache.recent;
    }

    const ds = await loadOmieDataset();
    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const todayStr = formatDate(today);
    const tomorrowStr = formatDate(tomorrow);

    if (ds) {
      const filtered = ds.filter((p) => p.datetime.startsWith(todayStr) || p.datetime.startsWith(tomorrowStr));
      if (filtered.length > 0) {
        cache.recent = filtered;
        cache.recentTime = now;
        state.isLive = true;
        return filtered;
      }
    }

    // Fallback: REE endpoint
    const url = `${REE_PROXY_BASE}?start_date=${todayStr}T00:00&end_date=${tomorrowStr}T23:59&time_trunc=hour`;
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const spotSeries = (data.included || []).find((item) => String(item.id) === "600");
      if (!spotSeries || !spotSeries.attributes || !spotSeries.attributes.values) {
        throw new Error("Spot series not found");
      }
      cache.recent = spotSeries.attributes.values;
      cache.recentTime = now;
      state.isLive = true;
      return cache.recent;
    } catch (err) {
      console.warn("Energy API notice (falling back to model):", err.message);
      state.isLive = false;
      const fallback = generateFallbackData(1, 1);
      cache.recent = fallback;
      cache.recentTime = now;
      return fallback;
    }
  }

  /**
   * Fetch Trailing 24 Hours Data
   */
  async function fetch24hData() {
    const nowTs = Date.now();
    if (cache.recent24h && nowTs - cache.recent24hTime < CACHE_TTL_MS) {
      return cache.recent24h;
    }

    const ds = await loadOmieDataset();
    const nowDate = new Date();
    const currentHour = nowDate.getHours();
    const todayStr = formatDate(nowDate);

    // End cutoff: end of current hour in local market time
    const cutoffEnd = `${todayStr}T${String(currentHour).padStart(2, "0")}:59:59`;
    // Start cutoff: 25 hours back in local market time to guarantee at least 24 full hourly intervals
    const pastDate = new Date(nowDate.getTime() - 25 * 3600 * 1000);
    const cutoffStart = `${formatDate(pastDate)}T${String(pastDate.getHours()).padStart(2, "0")}:00:00`;

    if (ds) {
      const filtered = ds.filter((p) => p.datetime >= cutoffStart && p.datetime <= cutoffEnd);
      if (filtered.length >= 10) {
        cache.recent24h = filtered;
        cache.recent24hTime = nowTs;
        return filtered;
      }
    }

    // Fallback: REE
    const yesterdayDate = new Date(nowDate.getTime() - 26 * 3600 * 1000);
    const startStr = formatDate(yesterdayDate);
    const endStr = formatDate(nowDate);
    const url = `${REE_PROXY_BASE}?start_date=${startStr}T00:00&end_date=${endStr}T23:59&time_trunc=hour`;

    try {
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const spotSeries = (data.included || []).find((item) => String(item.id) === "600");
      if (!spotSeries || !spotSeries.attributes || !spotSeries.attributes.values) {
        throw new Error("24h spot data not found");
      }

      const filtered = spotSeries.attributes.values.filter((p) => p.datetime >= cutoffStart && p.datetime <= cutoffEnd);
      const result = filtered.length >= 10 ? filtered : spotSeries.attributes.values.slice(-96);
      cache.recent24h = result;
      cache.recent24hTime = nowTs;
      return result;
    } catch (err) {
      console.warn("24h Energy API fallback:", err.message);
      const fallback = generateFallbackData(1, 0).slice(-96);
      cache.recent24h = fallback;
      cache.recent24hTime = nowTs;
      return fallback;
    }
  }

  /**
   * Fetch Historical Evolution Data (7 or 30 days)
   */
  async function fetchHistoryData(days) {
    const now = Date.now();
    const cacheKey = days <= 7 ? "week" : "month";
    const cacheObj = cacheKey === "week" ? cache.weekHistory : cache.monthHistory;
    const cacheTime = cacheKey === "week" ? cache.weekTime : cache.monthTime;

    if (cacheObj && now - cacheTime < CACHE_TTL_MS) {
      return cacheObj;
    }

    const ds = await loadOmieDataset();
    const today = new Date();
    const pastDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
    const startIso = formatDate(pastDate);
    const endIso = formatDate(today);

    if (ds) {
      const filtered = ds.filter((p) => p.datetime.slice(0, 10) >= startIso && p.datetime.slice(0, 10) <= endIso);
      if (filtered.length >= days * 10) {
        if (cacheKey === "week") {
          cache.weekHistory = filtered;
          cache.weekTime = now;
        } else {
          cache.monthHistory = filtered;
          cache.monthTime = now;
        }
        return filtered;
      }
    }

    // Fallback: REE
    const startStr = formatDate(pastDate);
    const endStr = formatDate(today);
    const url = `${REE_PROXY_BASE}?start_date=${startStr}T00:00&end_date=${endStr}T23:59&time_trunc=hour`;

    try {
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const spotSeries = (data.included || []).find((item) => String(item.id) === "600");
      if (!spotSeries || !spotSeries.attributes || !spotSeries.attributes.values) {
        throw new Error("Historical spot data not found");
      }

      const values = spotSeries.attributes.values;
      if (cacheKey === "week") {
        cache.weekHistory = values;
        cache.weekTime = now;
      } else {
        cache.monthHistory = values;
        cache.monthTime = now;
      }
      return values;
    } catch (err) {
      console.warn(`Historical Energy API notice (${days}d fallback):`, err.message);
      const fallback = generateFallbackData(days, 0);
      if (cacheKey === "week") {
        cache.weekHistory = fallback;
        cache.weekTime = now;
      } else {
        cache.monthHistory = fallback;
        cache.monthTime = now;
      }
      return fallback;
    }
  }

  /**
   * Vector Terminal Line Chart Renderer
   */
  function renderTerminalLineChart(svgEl, readoutEl, config) {
    if (!svgEl) return;

    const points = config.points || [];
    if (points.length === 0) {
      const msg = window.I18n ? window.I18n.t("no_telemetry") : "NO TELEMETRY AVAILABLE";
      svgEl.innerHTML = `<text x="50%" y="50%" fill="#9ca3af" text-anchor="middle" font-family="'Courier New', monospace" font-size="12">${msg}</text>`;
      return;
    }

    const W = 600;
    const H = 170;
    const pad = { top: 18, right: 30, bottom: 26, left: 54 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    const values = points.map((p) => p.value);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);

    const span = rawMax - rawMin || 10;
    const roughStep = span / 4;
    let step = 25;
    if (roughStep > 40) step = 50;
    else if (roughStep > 20) step = 25;
    else if (roughStep > 8) step = 10;
    else if (roughStep > 3) step = 5;
    else step = 2;

    const minY = Math.max(0, Math.floor(rawMin / step) * step);
    const maxY = Math.max(minY + step, Math.ceil(rawMax / step) * step);
    const yRange = maxY - minY || 1;

    const N = points.length;
    const coords = points.map((p, i) => {
      const x = N === 1 ? pad.left + plotW / 2 : pad.left + (i / (N - 1)) * plotW;
      const y = pad.top + plotH * (1 - (p.value - minY) / yRange);
      return {
        x: Math.round(x * 10) / 10,
        y: Math.max(pad.top, Math.min(pad.top + plotH, Math.round(y * 10) / 10))
      };
    });

    let svgContent = `
      <defs>
        <linearGradient id="plasma-area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#00aaff" stop-opacity="0.28" />
          <stop offset="100%" stop-color="#00aaff" stop-opacity="0.0" />
        </linearGradient>
        <linearGradient id="forecast-area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ffaf00" stop-opacity="0.24" />
          <stop offset="100%" stop-color="#ffaf00" stop-opacity="0.0" />
        </linearGradient>
        <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    `;

    // 1. Grid Lines & Y-Axis Labels
    const numTicks = Math.round((maxY - minY) / step);
    for (let i = 0; i <= numTicks; i++) {
      const v = minY + i * step;
      if (v > maxY) break;
      const yPos = pad.top + plotH * (1 - (v - minY) / yRange);
      svgContent += `
        <line x1="${pad.left}" y1="${yPos.toFixed(1)}" x2="${(pad.left + plotW).toFixed(1)}" y2="${yPos.toFixed(1)}" class="graph-grid-line" />
        <text x="${pad.left - 6}" y="${(yPos + 3.5).toFixed(1)}" class="graph-axis-text" text-anchor="end">${v} €</text>
      `;
    }

    // 2. Average Reference Line
    const avgVal = values.reduce((a, b) => a + b, 0) / values.length;
    const yAvg = pad.top + plotH * (1 - (avgVal - minY) / yRange);
    svgContent += `
      <line x1="${pad.left}" y1="${yAvg.toFixed(1)}" x2="${(pad.left + plotW).toFixed(1)}" y2="${yAvg.toFixed(1)}" stroke="rgba(255, 175, 0, 0.35)" stroke-dasharray="4,4" />
      <text x="${(pad.left + plotW).toFixed(1)}" y="${(yAvg - 4).toFixed(1)}" fill="#ffaf00" font-family="'Courier New', monospace" font-size="9" text-anchor="end">AVG ${avgVal.toFixed(1)} €</text>
    `;

    // 3. Optional Shaded Highlight Zone (e.g. Solar Valley in Day-Ahead)
    if (config.highlightZone && N > 1) {
      const hz = config.highlightZone;
      const xStart = pad.left + (hz.startIdx / (N - 1)) * plotW;
      const xEnd = pad.left + (hz.endIdx / (N - 1)) * plotW;
      const widthHz = xEnd - xStart;
      svgContent += `
        <rect x="${xStart.toFixed(1)}" y="${pad.top}" width="${widthHz.toFixed(1)}" height="${plotH}" fill="rgba(0, 255, 170, 0.08)" stroke="rgba(0, 255, 170, 0.3)" stroke-dasharray="2,2" />
        <text x="${(xStart + widthHz / 2).toFixed(1)}" y="${pad.top + 11}" fill="#00ffaa" font-family="'Courier New', monospace" font-size="9" font-weight="bold" text-anchor="middle">${hz.label}</text>
      `;
    }

    // 4. Area Path & Line Path
    const lineD = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
    const areaD = `${lineD} L ${coords[N - 1].x.toFixed(1)},${(pad.top + plotH).toFixed(1)} L ${coords[0].x.toFixed(1)},${(pad.top + plotH).toFixed(1)} Z`;
    const gradId = config.areaGradientId || "plasma-area-grad";

    svgContent += `
      <path d="${areaD}" fill="url(#${gradId})" />
      <path d="${lineD}" class="graph-line ${config.isForecast ? "forecast-line" : ""}" filter="url(#neon-glow)" />
    `;

    // 5. Data Nodes
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);

    coords.forEach((c, i) => {
      const p = points[i];
      const isMin = p.value === minVal;
      const isMax = p.value === maxVal;
      let nodeClass = "graph-node";
      if (isMin) nodeClass += " node-min";
      if (isMax) nodeClass += " node-max";

      if (N <= 14 || isMin || isMax || i === N - 1) {
        const r = isMin || isMax ? 4 : 3;
        svgContent += `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${r}" class="${nodeClass}" data-idx="${i}" />`;
      }
    });

    // 6. X-Axis Baseline & Tick Labels
    svgContent += `<line x1="${pad.left}" y1="${(pad.top + plotH).toFixed(1)}" x2="${(pad.left + plotW).toFixed(1)}" y2="${(pad.top + plotH).toFixed(1)}" class="graph-axis-line" />`;

    const xLabels = [];
    if (N <= 8) {
      coords.forEach((c, i) => xLabels.push({ x: c.x, text: points[i].label }));
    } else if (N >= 20 && N <= 26) {
      [0, 4, 8, 12, 16, 20, N - 1].forEach((idx) => {
        if (coords[idx]) xLabels.push({ x: coords[idx].x, text: points[idx].label });
      });
    } else {
      const stepIdx = Math.floor((N - 1) / 4);
      [0, stepIdx, stepIdx * 2, stepIdx * 3, N - 1].forEach((idx) => {
        if (coords[idx]) xLabels.push({ x: coords[idx].x, text: points[idx].label });
      });
    }

    xLabels.forEach((xl) => {
      svgContent += `<text x="${xl.x.toFixed(1)}" y="${(pad.top + plotH + 16).toFixed(1)}" class="graph-axis-text" text-anchor="middle">${xl.text}</text>`;
    });

    // 7. Interactive HUD Tracking Reticle Group
    svgContent += `
      <g id="hud-group" style="display: none;">
        <line id="hud-crosshair-line" class="hud-crosshair" x1="0" y1="${pad.top}" x2="0" y2="${(pad.top + plotH).toFixed(1)}" />
        <circle id="hud-reticle-circle" class="hud-reticle" cx="0" cy="0" r="5" />
      </g>
    `;

    svgEl.innerHTML = svgContent;

    const defaultText = config.defaultReadout || `[ PERIOD AVG: ${avgVal.toFixed(1)} €/MWh · MIN: ${minVal.toFixed(1)} € · MAX: ${maxVal.toFixed(1)} € ]`;
    if (readoutEl) {
      readoutEl.textContent = defaultText;
    }

    const hudGroup = svgEl.querySelector("#hud-group");
    const hudLine = svgEl.querySelector("#hud-crosshair-line");
    const hudReticle = svgEl.querySelector("#hud-reticle-circle");

    function handlePointerMove(e) {
      if (!hudGroup || !coords.length) return;

      const rect = svgEl.getBoundingClientRect();
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      if (clientX === undefined) return;

      const relX = clientX - rect.left;
      const svgX = (relX / rect.width) * W;

      let closestIdx = 0;
      let minDistance = Infinity;
      coords.forEach((c, idx) => {
        const dist = Math.abs(c.x - svgX);
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = idx;
        }
      });

      const pt = points[closestIdx];
      const coord = coords[closestIdx];
      const cls = classifyPrice(pt.value);

      hudGroup.style.display = "block";
      hudLine.setAttribute("x1", coord.x);
      hudLine.setAttribute("x2", coord.x);
      hudReticle.setAttribute("cx", coord.x);
      hudReticle.setAttribute("cy", coord.y);

      if (readoutEl) {
        const dateTag = pt.fullDate || pt.label;
        const kwhVal = (pt.value / 10).toFixed(1);
        const decoupledTag = pt.decoupled ? ` | <span class="badge-peak" style="padding:0 3px">PT≠ES</span>` : "";
        readoutEl.innerHTML = `[ <span class="hud-tag">${dateTag}</span> :: <span class="hud-val">${pt.value.toFixed(2)} €/MWh</span> (${kwhVal} c€/kWh) | <span class="${cls.className}">${cls.label}</span>${decoupledTag} ]`;
      }
    }

    function handlePointerLeave() {
      if (hudGroup) hudGroup.style.display = "none";
      if (readoutEl) readoutEl.textContent = defaultText;
    }

    svgEl.onpointermove = handlePointerMove;
    svgEl.onpointerdown = handlePointerMove;
    svgEl.onpointerleave = handlePointerLeave;
  }

  /**
   * Process & Render Evolution View (24h, Week, or Month)
   */
  async function renderEvolution() {
    const svgEl = document.getElementById("evolution-chart-svg");
    const readoutEl = document.getElementById("evolution-hud-readout");
    const statsContainer = document.getElementById("evolution-stats");
    const labelMode = document.getElementById("label-evolution-mode");
    if (!svgEl) return;

    const mode = state.evolutionMode;
    const monthNames = window.I18n ? window.I18n.getMonths() : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    if (labelMode) {
      if (mode === "24h") labelMode.textContent = window.I18n ? window.I18n.t("label_24h") : "24-HOUR (LAST 24H)";
      else if (mode === "week") labelMode.textContent = window.I18n ? window.I18n.t("label_week") : "7-DAY (WEEK)";
      else labelMode.textContent = window.I18n ? window.I18n.t("label_month") : "30-DAY (MONTH)";
    }

    let slicePoints = [];

    if (mode === "24h") {
      const raw24h = await fetch24hData();
      const hourlyMap = new Map();

      raw24h.forEach((pt) => {
        const hourKey = pt.datetime.slice(0, 13);
        if (!hourlyMap.has(hourKey)) {
          hourlyMap.set(hourKey, []);
        }
        hourlyMap.get(hourKey).push(pt);
      });

      const hourlyList = [];
      const nowDate = new Date();
      const currentHour = nowDate.getHours();
      const todayStr = formatDate(nowDate);

      // Chronologically sorted hour keys
      const sortedHourKeys = Array.from(hourlyMap.keys()).sort();

      sortedHourKeys.forEach((hourKey) => {
        const pts = hourlyMap.get(hourKey);
        const parts = hourKey.slice(0, 10).split("-");
        const mIdx = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const m = monthNames[mIdx] || "";
        const h = parseInt(hourKey.slice(11, 13), 10);
        const anyDecoupled = pts.some((p) => p.decoupled);

        // For the active current hour, prioritize the real-time clearing price displayed in the banner
        let pointValue;
        if (hourKey.slice(0, 10) === todayStr && h === currentHour && state.currentPrice != null) {
          pointValue = state.currentPrice;
        } else {
          const avg = pts.reduce((a, b) => a + b.value, 0) / pts.length;
          pointValue = Math.round(avg * 100) / 100;
        }

        hourlyList.push({
          date: hourKey.slice(0, 10),
          hour: h,
          label: `${String(h).padStart(2, "0")}h`,
          fullDate: `${d} ${m} ${String(h).padStart(2, "0")}:00`,
          value: pointValue,
          decoupled: anyDecoupled
        });
      });

      slicePoints = hourlyList.slice(-24);
    } else {
      const daysCount = mode === "week" ? 7 : 30;
      const rawData = await fetchHistoryData(daysCount);

      const dailyMap = new Map();
      rawData.forEach((pt) => {
        const dayKey = pt.datetime.slice(0, 10);
        if (!dailyMap.has(dayKey)) {
          dailyMap.set(dayKey, []);
        }
        dailyMap.get(dayKey).push(pt);
      });

      const dailyList = [];
      dailyMap.forEach((pts, dayKey) => {
        const avg = pts.reduce((a, b) => a + b.value, 0) / pts.length;
        const anyDecoupled = pts.some((p) => p.decoupled);
        const parts = dayKey.split("-");
        const mIdx = parseInt(parts[1], 10) - 1;
        const dayNum = parts[2];
        const mName = monthNames[mIdx] || "";

        dailyList.push({
          date: dayKey,
          label: `${dayNum} ${mName}`,
          fullDate: `${dayNum} ${mName} ${parts[0]}`,
          value: Math.round(avg * 100) / 100,
          decoupled: anyDecoupled
        });
      });

      slicePoints = dailyList.slice(-daysCount);
    }

    if (slicePoints.length === 0) {
      const msg = window.I18n ? window.I18n.t("no_history") : "NO HISTORICAL DATA AVAILABLE";
      svgEl.innerHTML = `<text x="50%" y="50%" fill="#9ca3af" text-anchor="middle" font-family="'Courier New', monospace" font-size="12">${msg}</text>`;
      return;
    }

    const values = slicePoints.map((p) => p.value);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const firstVal = values[0];
    const lastVal = values[values.length - 1];
    const diffPct = (((lastVal - firstVal) / (firstVal || 1)) * 100).toFixed(1);
    const trendIcon = diffPct >= 0 ? "▲ +" : "▼ ";

    const modeTitle = mode === "24h"
      ? (window.I18n ? window.I18n.t("mode_title_24h") : "LAST 24H")
      : mode === "week"
      ? (window.I18n ? window.I18n.t("mode_title_week") : "7-DAY")
      : (window.I18n ? window.I18n.t("mode_title_month") : "30-DAY");

    const tAvg = window.I18n ? window.I18n.t("today_avg") : "AVG";
    const tMin = window.I18n ? window.I18n.t("min") : "MIN";
    const tMax = window.I18n ? window.I18n.t("max") : "MAX";
    const defaultReadout = `[ ${modeTitle} ${tAvg}: ${avg.toFixed(1)} €/MWh · ${tMin}: ${min.toFixed(1)} € · ${tMax}: ${max.toFixed(1)} € ]`;

    renderTerminalLineChart(svgEl, readoutEl, {
      points: slicePoints,
      areaGradientId: "plasma-area-grad",
      lineColor: "#00aaff",
      isForecast: false,
      defaultReadout
    });

    const tShift = mode === "24h"
      ? (window.I18n ? window.I18n.t("shift_24h") : "24H SHIFT")
      : (window.I18n ? window.I18n.t("trend") : "TREND");

    if (statsContainer) {
      statsContainer.innerHTML = `
        <span>${tAvg}: <b>${avg.toFixed(1)}</b> €/MWh</span>
        <span class="dot">·</span>
        <span>${tMin}: <b>${min.toFixed(1)}</b> €</span>
        <span class="dot">·</span>
        <span>${tMax}: <b>${max.toFixed(1)}</b> €</span>
        <span class="dot">·</span>
        <span class="trend">${tShift}: ${trendIcon}${diffPct}%</span>
      `;
    }
  }

  /**
   * Process & Render Prediction View (Tomorrow Day-Ahead or 7-Day Outlook)
   */
  async function renderPrediction() {
    const svgEl = document.getElementById("prediction-chart-svg");
    const readoutEl = document.getElementById("prediction-hud-readout");
    const recBox = document.getElementById("prediction-recommendation");
    const labelMode = document.getElementById("label-prediction-mode");
    if (!svgEl) return;

    const isDayAhead = state.predictionMode === "day";
    if (labelMode) {
      labelMode.textContent = isDayAhead
        ? (window.I18n ? window.I18n.t("label_tomorrow") : "TOMORROW (DAY-AHEAD)")
        : (window.I18n ? window.I18n.t("label_outlook") : "7-DAY OUTLOOK");
    }

    const recent = await fetchRecentData();
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = formatDate(tomorrowDate);
    const tTomorrow = window.I18n ? window.I18n.t("tomorrow_tag") : "TOMORROW";

    if (isDayAhead) {
      const tomorrowPoints = recent.filter((pt) => pt.datetime.startsWith(tomorrowStr));

      let hourlyCurve = [];
      if (tomorrowPoints.length >= 24) {
        for (let h = 0; h < 24; h++) {
          const hourPrefix = `${tomorrowStr}T${String(h).padStart(2, "0")}`;
          const matches = tomorrowPoints.filter((p) => p.datetime.startsWith(hourPrefix));
          const avg = matches.length
            ? matches.reduce((s, p) => s + p.value, 0) / matches.length
            : 150;
          const anyDecoupled = matches.some((p) => p.decoupled);
          hourlyCurve.push({
            hour: h,
            label: `${String(h).padStart(2, "0")}h`,
            fullDate: `${tTomorrow} ${String(h).padStart(2, "0")}:00`,
            value: Math.round(avg * 100) / 100,
            decoupled: anyDecoupled
          });
        }
      } else {
        const base = state.todayStats.avg || 150;
        for (let h = 0; h < 24; h++) {
          let mod = 1.0;
          if (h >= 11 && h <= 16) mod = 0.12;
          else if (h >= 20 && h <= 23) mod = 1.45;
          else if (h <= 6) mod = 0.8;
          hourlyCurve.push({
            hour: h,
            label: `${String(h).padStart(2, "0")}h`,
            fullDate: `${tTomorrow} ${String(h).padStart(2, "0")}:00`,
            value: Math.round(base * mod * 100) / 100,
            decoupled: false
          });
        }
      }

      const sorted = [...hourlyCurve].sort((a, b) => a.value - b.value);
      const lowestHour = sorted[0].hour;
      const highestHour = sorted[sorted.length - 1].hour;

      const tValues = hourlyCurve.map((p) => p.value);
      const tAvg = tValues.reduce((a, b) => a + b, 0) / tValues.length;
      const tDayAheadAvg = window.I18n ? window.I18n.t("day_ahead_avg") : "DAY-AHEAD AVG";
      const tMin = window.I18n ? window.I18n.t("min") : "MIN";
      const tPeak = window.I18n ? window.I18n.t("peak") : "PEAK";
      const defaultReadout = `[ ${tDayAheadAvg}: ${tAvg.toFixed(1)} €/MWh · ${tMin}: ${Math.min(...tValues).toFixed(1)} € · ${tPeak}: ${Math.max(...tValues).toFixed(1)} € ]`;

      renderTerminalLineChart(svgEl, readoutEl, {
        points: hourlyCurve,
        areaGradientId: "plasma-area-grad",
        lineColor: "#00aaff",
        isForecast: false,
        highlightZone: {
          startIdx: 11,
          endIdx: 16,
          label: window.I18n ? window.I18n.t("solar_valley") : "SOLAR VALLEY (CHEAP)"
        },
        defaultReadout
      });

      if (recBox) {
        const tOpt = window.I18n ? window.I18n.t("rec_optimal") : "OPTIMAL CONSUMPTION";
        const tSol = window.I18n ? window.I18n.t("rec_solar_valley_tag") : "Solar Valley";
        const tAvoid = window.I18n ? window.I18n.t("rec_avoid") : "Avoid intensive appliance use during peak rates";
        recBox.innerHTML = `
          <div class="rec-badge">${tOpt}: ${String(lowestHour).padStart(2, "0")}:00 - ${String(lowestHour + 4).padStart(2, "0")}:00 (${tSol})</div>
          <div class="rec-note">${tAvoid} (${String(highestHour).padStart(2, "0")}:00 - ${String(highestHour + 2).padStart(2, "0")}:00).</div>
        `;
      }
    } else {
      const outlookPoints = [];
      const baseAvg = state.todayStats.avg || 155;
      const today = new Date();
      const weekNames = window.I18n ? window.I18n.getWeekdays() : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const monthNames = window.I18n ? window.I18n.getMonths() : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

      let lowestDayName = "";
      let lowestDayVal = 9999;

      for (let i = 1; i <= 7; i++) {
        const fDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
        const dayName = weekNames[fDate.getDay()];
        const isWeekend = fDate.getDay() === 0 || fDate.getDay() === 6;
        const multiplier = isWeekend ? 0.65 : 1.0 - i * 0.02;
        const forecastVal = Math.max(10, Math.round(baseAvg * multiplier * 10) / 10);

        if (forecastVal < lowestDayVal) {
          lowestDayVal = forecastVal;
          lowestDayName = dayName;
        }

        outlookPoints.push({
          label: `${dayName} ${fDate.getDate()}`,
          fullDate: `${dayName} ${fDate.getDate()} ${monthNames[fDate.getMonth()]} (+${i}d)`,
          value: forecastVal,
          decoupled: false
        });
      }

      const oValues = outlookPoints.map((p) => p.value);
      const oAvg = oValues.reduce((a, b) => a + b, 0) / oValues.length;
      const tForecastAvg = window.I18n ? window.I18n.t("forecast_7d_avg") : "7-DAY FORECAST AVG";
      const tProjectedLow = window.I18n ? window.I18n.t("projected_low") : "PROJECTED LOW";
      const defaultReadout = `[ ${tForecastAvg}: ${oAvg.toFixed(1)} €/MWh · ${tProjectedLow}: ${lowestDayVal.toFixed(1)} € (${lowestDayName}) ]`;

      renderTerminalLineChart(svgEl, readoutEl, {
        points: outlookPoints,
        areaGradientId: "forecast-area-grad",
        lineColor: "#ffaf00",
        isForecast: true,
        defaultReadout
      });

      if (recBox) {
        const tLowDay = window.I18n ? window.I18n.t("rec_lowest_day") : "PROJECTED LOWEST DAY";
        const tWeekend = window.I18n ? window.I18n.t("rec_weekend_info") : "Industrial load reduction yields ~35% lower wholesale rates on weekends.";
        recBox.innerHTML = `
          <div class="rec-badge">${tLowDay}: ${lowestDayName} (~${lowestDayVal.toFixed(1)} €/MWh)</div>
          <div class="rec-note">${tWeekend}</div>
        `;
      }
    }
  }

  /**
   * Update Real-Time Price Badges & Metrics
   */
  async function updateCurrentMetrics() {
    const recent = await fetchRecentData();
    const now = new Date();
    const todayStr = formatDate(now);
    const nowHour = now.getHours();

    const todayPoints = recent.filter((pt) => pt.datetime.startsWith(todayStr));
    const allValues = todayPoints.map((p) => p.value);

    let currentVal = 145.0;
    if (todayPoints.length > 0) {
      const quarter = Math.floor(now.getMinutes() / 15) * 15;
      const intervalPrefix = `${todayStr}T${String(nowHour).padStart(2, "0")}:${String(quarter).padStart(2, "0")}`;
      const intervalMatch = todayPoints.find((p) => p.datetime.startsWith(intervalPrefix));
      const hourPrefix = `${todayStr}T${String(nowHour).padStart(2, "0")}`;
      const hourMatch = todayPoints.find((p) => p.datetime.startsWith(hourPrefix));
      currentVal = intervalMatch ? intervalMatch.value : (hourMatch ? hourMatch.value : todayPoints[todayPoints.length - 1].value);

      state.todayStats.min = Math.min(...allValues);
      state.todayStats.max = Math.max(...allValues);
      state.todayStats.avg = allValues.reduce((a, b) => a + b, 0) / allValues.length;
    } else {
      state.todayStats.min = 0.5;
      state.todayStats.max = 245.0;
      state.todayStats.avg = 142.0;
    }

    state.currentPrice = currentVal;
    const currentKwh = (currentVal / 1000) * 100;
    const classification = classifyPrice(currentVal);

    const elPrice = document.getElementById("current-price-val");
    const elKwh = document.getElementById("current-price-kwh");
    const elBadge = document.getElementById("energy-badge");
    const elMin = document.getElementById("today-min");
    const elAvg = document.getElementById("today-avg");
    const elMax = document.getElementById("today-max");

    if (elPrice) elPrice.textContent = currentVal.toFixed(2);
    if (elKwh) elKwh.textContent = `(${currentKwh.toFixed(1)} c€/kWh)`;
    if (elBadge) {
      elBadge.textContent = classification.label;
      elBadge.className = `badge ${classification.className}`;
    }
    if (elMin) elMin.textContent = state.todayStats.min.toFixed(1);
    if (elAvg) elAvg.textContent = state.todayStats.avg.toFixed(1);
    if (elMax) elMax.textContent = state.todayStats.max.toFixed(1);

    const elProfileEnergy = document.getElementById("energy-status-text");
    if (elProfileEnergy) {
      elProfileEnergy.textContent = `${classification.label} (${currentVal.toFixed(1)} €/MWh)`;
      elProfileEnergy.className = `status-highlight ${classification.className}`;
    }
  }

  function cycleEvolution() {
    const currentIdx = EVOLUTION_MODES.indexOf(state.evolutionMode);
    const nextIdx = (currentIdx + 1) % EVOLUTION_MODES.length;
    state.evolutionMode = EVOLUTION_MODES[nextIdx];
    renderEvolution();
  }

  function cyclePrediction() {
    state.predictionMode = state.predictionMode === "day" ? "week" : "day";
    renderPrediction();
  }

  async function refresh(isAuto = false) {
    const syncIndicator = document.getElementById("sync-status-indicator");
    if (syncIndicator && !isAuto) {
      syncIndicator.textContent = window.I18n ? window.I18n.t("syncing") : "[SYNCING...]";
    }

    cache.recent = null;
    cache.recentTime = 0;
    cache.recent24h = null;
    cache.recent24hTime = 0;
    cache.weekHistory = null;
    cache.monthHistory = null;
    omieDataset = null;

    // Ping background sync if local server is active
    try {
      fetch("/api/sync", { cache: "no-store" }).catch(() => {});
    } catch (_) {}

    await loadOmieDataset();
    await updateCurrentMetrics();
    await Promise.all([renderEvolution(), renderPrediction()]);

    state.lastUpdated = Date.now();
    const nowTimeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (syncIndicator) {
      const syncPrefix = window.I18n ? window.I18n.t("sync_prefix") : "SYNCED";
      syncIndicator.textContent = `[${syncPrefix}: ${nowTimeStr} · AUTO: 15M]`;
      syncIndicator.className = "sync-active";
    }
  }

  async function init() {
    const btnEvolution = document.getElementById("btn-cycle-evolution");
    if (btnEvolution) {
      btnEvolution.addEventListener("click", cycleEvolution);
    }

    const btnPrediction = document.getElementById("btn-cycle-prediction");
    if (btnPrediction) {
      btnPrediction.addEventListener("click", cyclePrediction);
    }

    const btnRefresh = document.getElementById("btn-refresh-energy");
    if (btnRefresh) {
      btnRefresh.addEventListener("click", () => refresh(false));
    }

    // Hook into I18n language changes
    if (window.I18n) {
      window.I18n.onChange(() => {
        updateSourceBadge();
        updateCurrentMetrics();
        renderEvolution();
        renderPrediction();
      });
    }

    // 1. Initial refresh on entering the website
    await refresh(false);

    // 2. Automatically refresh every 15 minutes (matches market dispatch interval)
    setInterval(() => {
      refresh(true);
    }, 15 * 60 * 1000);

    // 3. Automatically refresh when entering or returning to tab after idle (> 10 mins)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        const elapsed = Date.now() - (state.lastUpdated || 0);
        if (elapsed > 10 * 60 * 1000) {
          refresh(true);
        }
      }
    });

    window.addEventListener("focus", () => {
      const elapsed = Date.now() - (state.lastUpdated || 0);
      if (elapsed > 15 * 60 * 1000) {
        refresh(true);
      }
    });
  }

  global.EnergyDashboard = {
    init,
    refresh,
    cycleEvolution,
    cyclePrediction,
    updateLanguage: () => {
      updateSourceBadge();
      updateCurrentMetrics();
      renderEvolution();
      renderPrediction();
    },
    getState: () => state
  };
})(window);

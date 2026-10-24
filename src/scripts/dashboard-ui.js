/**
 * AURA-TM ICCC Dashboard Controller
 * Synchronizes Telemetry Inputs, AURA Engine Calculations,
 * Visualizer Canvas, Scenario Switching, and JSON Export.
 * Minimalist, uncluttered field architecture aligned with Problem Statement 04:
 * 1. Vehicle Counts
 * 2. Weather
 * 3. Time Context
 * 4. Historical Congestion Data
 */

import { executeAuraTmEngine } from './aura-engine.js';
import { SCENARIOS } from './scenarios.js';
import { CorridorCanvas } from './corridor-canvas.js';

class DashboardApp {
  constructor() {
    this.currentScenario = SCENARIOS[0]; // Live Incident Default
    this.telemetryState = JSON.parse(JSON.stringify(this.currentScenario.telemetry));
    this.calculationResults = null;
    this.corridorCanvas = null;
    this.activeTab = 'projections'; // 'projections' | 'safety' | 'cctv' | 'json'
    this.actionLogs = [];

    this.init();
  }

  init() {
    this.setupCorridorCanvas();
    this.setupEventListeners();
    this.populateScenarioSelect();
    this.syncInputFormFromState();
    this.recalculate();
    this.startClock();
  }

  setupCorridorCanvas() {
    const canvasEl = document.getElementById('corridor-canvas');
    if (canvasEl) {
      this.corridorCanvas = new CorridorCanvas(canvasEl);
      this.corridorCanvas.start();
    }
  }

  populateScenarioSelect() {
    const select = document.getElementById('scenario-select');
    if (!select) return;

    select.innerHTML = '';
    SCENARIOS.forEach(sc => {
      const opt = document.createElement('option');
      opt.value = sc.id;
      opt.textContent = sc.name;
      if (sc.id === this.currentScenario.id) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });

    select.addEventListener('change', (e) => {
      const found = SCENARIOS.find(s => s.id === e.target.value);
      if (found) {
        this.currentScenario = found;
        this.telemetryState = JSON.parse(JSON.stringify(found.telemetry));
        this.syncInputFormFromState();
        this.logAction(`Loaded scenario: ${found.name}`, 'INFO');
        this.recalculate();
      }
    });
  }

  syncInputFormFromState() {
    const t = this.telemetryState;
    const c = t.vehicle_counts;

    // 1. Vehicle Counts
    this.setVal('input-count-2w', c.two_wheeler);
    this.setVal('input-count-3w', c.three_wheeler);
    this.setVal('input-count-4w', c.passenger_car);
    this.setVal('input-count-lcv', c.light_commercial);
    this.setVal('input-count-hcv', c.heavy_commercial);

    // 2. Weather
    this.setVal('input-precip', t.precipitation_rate);
    const waterCb = document.getElementById('input-standing-water');
    if (waterCb) waterCb.checked = t.has_standing_water;

    // 3. Time Context
    const timeWinSelect = document.getElementById('input-time-window');
    if (timeWinSelect) timeWinSelect.value = t.temporal_window_key;
    const fridayCb = document.getElementById('input-is-friday');
    if (fridayCb) fridayCb.checked = (t.day_of_week === 'Friday');

    // 4. Historical Data
    this.setVal('input-hist-mean', t.historical_mean);

    // Display updates
    this.setText('val-precip', `${t.precipitation_rate} mm/h`);
  }

  setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  setupEventListeners() {
    // 1. Vehicle Counts
    ['count-2w', 'count-3w', 'count-4w', 'count-lcv', 'count-hcv'].forEach(key => {
      const el = document.getElementById(`input-${key}`);
      if (el) {
        el.addEventListener('input', () => this.readFormInputs());
      }
    });

    // 2. Weather
    const precipEl = document.getElementById('input-precip');
    if (precipEl) {
      precipEl.addEventListener('input', (e) => {
        this.setText('val-precip', `${e.target.value} mm/h`);
        this.readFormInputs();
      });
    }

    const waterEl = document.getElementById('input-standing-water');
    if (waterEl) {
      waterEl.addEventListener('change', () => this.readFormInputs());
    }

    // 3. Time Context
    const timeWin = document.getElementById('input-time-window');
    if (timeWin) timeWin.addEventListener('change', () => this.readFormInputs());
    const fridayEl = document.getElementById('input-is-friday');
    if (fridayEl) fridayEl.addEventListener('change', () => this.readFormInputs());

    // 4. Historical Data
    const histMeanEl = document.getElementById('input-hist-mean');
    if (histMeanEl) {
      histMeanEl.addEventListener('input', () => this.readFormInputs());
    }

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    // Copy JSON button
    const copyBtn = document.getElementById('btn-copy-json');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        if (this.calculationResults && this.calculationResults.m2m_payload) {
          const jsonStr = JSON.stringify(this.calculationResults.m2m_payload, null, 2);
          navigator.clipboard.writeText(jsonStr).then(() => {
            copyBtn.textContent = '✓ Copied to Clipboard';
            setTimeout(() => { copyBtn.textContent = '📋 Copy Raw JSON'; }, 2000);
          });
        }
      });
    }

    // Emergency Action Dispatch Buttons
    const btnDrainage = document.getElementById('btn-dispatch-drainage');
    if (btnDrainage) {
      btnDrainage.addEventListener('click', () => {
        this.dispatchDrainageAction();
      });
    }

    const btnPolice = document.getElementById('btn-dispatch-police');
    if (btnPolice) {
      btnPolice.addEventListener('click', () => {
        this.logAction('Traffic Police QRT unit deployed to merge taper point.', 'DISPATCH');
        alert('ALERT: Police Traffic Unit dispatched to coordinate lane merges on Corridor-04.');
      });
    }
  }

  readFormInputs() {
    // 1. Vehicle Counts
    this.telemetryState.vehicle_counts.two_wheeler = parseFloat(document.getElementById('input-count-2w')?.value) || 0;
    this.telemetryState.vehicle_counts.three_wheeler = parseFloat(document.getElementById('input-count-3w')?.value) || 0;
    this.telemetryState.vehicle_counts.passenger_car = parseFloat(document.getElementById('input-count-4w')?.value) || 0;
    this.telemetryState.vehicle_counts.light_commercial = parseFloat(document.getElementById('input-count-lcv')?.value) || 0;
    this.telemetryState.vehicle_counts.heavy_commercial = parseFloat(document.getElementById('input-count-hcv')?.value) || 0;

    // 2. Weather
    this.telemetryState.precipitation_rate = parseFloat(document.getElementById('input-precip')?.value) || 0;
    this.telemetryState.has_standing_water = document.getElementById('input-standing-water')?.checked ?? false;
    // Derive realistic visibility from rain if not manually overridden
    this.telemetryState.horizontal_visibility = this.telemetryState.precipitation_rate > 15 ? 320 : 1500;

    // 3. Time Context
    this.telemetryState.temporal_window_key = document.getElementById('input-time-window')?.value || "evening_peak_buildup";
    const isFri = document.getElementById('input-is-friday')?.checked ?? true;
    this.telemetryState.day_of_week = isFri ? "Friday" : "NormalDay";
    this.telemetryState.pre_weekend_surge = isFri;

    // 4. Historical Data
    const histVal = parseFloat(document.getElementById('input-hist-mean')?.value);
    if (!isNaN(histVal) && histVal > 0) {
      this.telemetryState.historical_mean = histVal;
    }

    this.recalculate();
  }

  recalculate() {
    this.calculationResults = executeAuraTmEngine(this.telemetryState);

    if (!this.calculationResults.success) {
      console.error(this.calculationResults.error);
      return;
    }

    // Update Corridor Canvas
    if (this.corridorCanvas) {
      this.corridorCanvas.updateOperationalState({
        effective_vc: this.calculationResults.effective_vc_t0,
        precipitation_rate: this.telemetryState.precipitation_rate,
        has_standing_water: this.telemetryState.has_standing_water,
        horizontal_visibility: this.telemetryState.horizontal_visibility,
        vehicle_counts: this.telemetryState.vehicle_counts
      });
    }

    this.renderKpiCards();
    this.renderProjectionsTable();
    this.renderProjectionsChart();
    this.renderAnomalyGauge();
    this.renderAdvisoryList();
    this.renderM2mJson();
    this.renderSafetyGateStatus();
  }

  renderKpiCards() {
    const res = this.calculationResults;
    const mod1 = res.module1;
    const mod2 = res.module2;
    const mod4 = res.module4;

    this.setText('kpi-demand', `${mod1.normalized_hourly_demand_pcu_hr.toFixed(1)}`);
    this.setText('kpi-capacity', `${mod2.effective_capacity_pcu_hr.toFixed(1)}`);
    this.setText('kpi-wcm', `WCM: ${mod2.weather_capacity_multiplier.toFixed(2)}`);

    const vcEl = document.getElementById('kpi-vc');
    const losBadge = document.getElementById('kpi-los-badge');
    if (vcEl) {
      vcEl.textContent = res.effective_vc_t0.toFixed(2);
      vcEl.style.color = res.los_t0.color;
    }
    if (losBadge) {
      losBadge.textContent = `${res.los_t0.grade} ${res.los_t0.flag}`;
      losBadge.style.backgroundColor = `${res.los_t0.color}22`;
      losBadge.style.borderColor = res.los_t0.color;
      losBadge.style.color = res.los_t0.color;
    }

    const cdiEl = document.getElementById('kpi-cdi');
    const cdiBadge = document.getElementById('kpi-cdi-badge');
    if (cdiEl) {
      cdiEl.textContent = `${mod4.cdi_z_score >= 0 ? '+' : ''}${mod4.cdi_z_score.toFixed(2)} σ`;
    }
    if (cdiBadge) {
      cdiBadge.textContent = mod4.classification.replace('_', ' ');
      const col = mod4.severity === 'CRITICAL' ? '#ef4444' : mod4.severity === 'WARNING' ? '#f59e0b' : '#00e676';
      cdiBadge.style.backgroundColor = `${col}22`;
      cdiBadge.style.borderColor = col;
      cdiBadge.style.color = col;
    }
  }

  renderProjectionsTable() {
    const container = document.getElementById('projections-table-body');
    if (!container) return;

    container.innerHTML = '';
    const horizons = this.calculationResults.horizons;

    horizons.forEach(h => {
      const tr = document.createElement('tr');
      const isOversaturated = h.effective_v_c > 1.0;
      const isSpillback = h.effective_v_c > 1.15;

      // Clean, concise time extraction (e.g. "18:15", "18:30")
      const timeMatch = h.timestamp_iso.match(/T(\d{2}:\d{2})/);
      const shortTime = timeMatch ? timeMatch[1] : h.timestamp_iso;

      tr.innerHTML = `
        <td class="font-bold text-cyan">${h.horizon}</td>
        <td class="font-mono text-xs">${shortTime}</td>
        <td class="font-mono font-bold">${h.demand_pcu_hr.toFixed(1)}</td>
        <td class="font-mono">${h.effective_capacity_pcu_hr.toFixed(1)}</td>
        <td class="font-mono font-bold" style="color: ${h.los.color}">${h.effective_v_c.toFixed(2)}</td>
        <td>
          <span class="badge-los" style="background: ${h.los.color}22; border-color: ${h.los.color}; color: ${h.los.color}">
            ${h.los.grade} ${isOversaturated ? '[OVERSATURATED]' : ''}
          </span>
        </td>
        <td>
          <span class="badge-status ${isSpillback ? 'badge-critical' : 'badge-normal'}">
            ${isSpillback ? '⚠️ High Spillback Risk' : 'Controlled Flow'}
          </span>
        </td>
      `;
      container.appendChild(tr);
    });
  }

  renderProjectionsChart() {
    const canvas = document.getElementById('chart-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width || 600;
    const h = 200;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);

    const horizons = this.calculationResults.horizons;
    const maxVal = Math.max(...horizons.map(x => x.demand_pcu_hr), 7000);
    const paddingLeft = 50;
    const paddingBottom = 25;
    const chartW = w - paddingLeft - 20;
    const chartH = h - paddingBottom - 15;

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let step = 0; step <= 4; step++) {
      const yVal = (maxVal / 4) * step;
      const y = h - paddingBottom - (yVal / maxVal) * chartH;
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(w - 20, y);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(yVal), paddingLeft - 8, y + 3);
    }

    // Effective Capacity Reference Line
    const effCap = this.calculationResults.module2.effective_capacity_pcu_hr;
    const capY = h - paddingBottom - (effCap / maxVal) * chartH;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(paddingLeft, capY);
    ctx.lineTo(w - 20, capY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`CAPACITY: ${effCap.toFixed(0)} PCU/hr`, w - 25, capY - 6);

    // Bars for Demand
    const barWidth = 42;
    const slotW = chartW / horizons.length;

    horizons.forEach((item, idx) => {
      const x = paddingLeft + idx * slotW + slotW / 2;
      const barH = (item.demand_pcu_hr / maxVal) * chartH;
      const y = h - paddingBottom - barH;

      const grad = ctx.createLinearGradient(x - barWidth / 2, y, x - barWidth / 2, h - paddingBottom);
      if (item.effective_v_c > 1.0) {
        grad.addColorStop(0, '#f43f5e');
        grad.addColorStop(1, 'rgba(244, 63, 94, 0.2)');
      } else {
        grad.addColorStop(0, '#00f0ff');
        grad.addColorStop(1, 'rgba(0, 240, 255, 0.2)');
      }

      ctx.fillStyle = grad;
      ctx.fillRect(x - barWidth / 2, y, barWidth, barH);
      ctx.strokeStyle = item.effective_v_c > 1.0 ? '#f43f5e' : '#00f0ff';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - barWidth / 2, y, barWidth, barH);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${item.demand_pcu_hr.toFixed(0)}`, x, y - 5);

      ctx.fillStyle = item.los.color;
      ctx.fillText(`V/C ${item.effective_v_c.toFixed(2)}`, x, y + 14);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px "Inter", sans-serif';
      ctx.fillText(item.horizon, x, h - 8);
    });
  }

  renderAnomalyGauge() {
    const canvas = document.getElementById('gauge-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = 70;
    const h = 35;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h - 4;
    const r = 26;
    const cdi = this.calculationResults.module4.cdi_z_score;

    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    ctx.strokeStyle = '#00e676';
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, Math.PI + (4 / 7) * Math.PI);
    ctx.stroke();

    ctx.strokeStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI + (4.8 / 7) * Math.PI, Math.PI * 2);
    ctx.stroke();

    const clampedCdi = Math.max(-3, Math.min(4, cdi));
    const angle = Math.PI + ((clampedCdi + 3) / 7) * Math.PI;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(r - 2, 0);
    ctx.stroke();
    ctx.restore();
  }

  renderAdvisoryList() {
    const container = document.getElementById('advisories-list');
    if (!container) return;

    container.innerHTML = '';
    const advs = this.calculationResults.advisories;

    advs.forEach(adv => {
      const card = document.createElement('div');
      card.className = `advisory-card priority-${adv.priority.toLowerCase()}`;
      card.innerHTML = `
        <div class="advisory-header">
          <span class="advisory-badge badge-${adv.priority.toLowerCase()}">${adv.priority}</span>
          <span class="advisory-id">${adv.id} • ${adv.category}</span>
        </div>
        <div class="advisory-title font-bold">${adv.title}</div>
        <div class="advisory-action">${adv.action_required}</div>
      `;
      container.appendChild(card);
    });
  }

  renderM2mJson() {
    const pre = document.getElementById('m2m-json-output');
    if (pre && this.calculationResults && this.calculationResults.m2m_payload) {
      pre.textContent = JSON.stringify(this.calculationResults.m2m_payload, null, 2);
    }
  }

  renderSafetyGateStatus() {
    const gateStatus = document.getElementById('gate-status-text');
    if (gateStatus) {
      gateStatus.innerHTML = `
        <span class="text-amber font-bold">🔒 ADVISORY_ONLY (Enforced)</span> — 
        <span class="text-xs text-muted">Controller interlocks active. Physical signal overrides safely gated.</span>
      `;
    }
  }

  dispatchDrainageAction() {
    this.logAction('Emergency drainage dispatch triggered for Slip Lane at Corridor-04.', 'DISPATCH');
    this.telemetryState.has_standing_water = false;
    this.telemetryState.precipitation_rate = 4.0;
    this.syncInputFormFromState();
    this.recalculate();
    alert('SUCCESS: Emergency drainage pumps deployed. Slip lane standing water cleared! Capacity restored.');
  }

  logAction(msg, type = 'INFO') {
    const time = new Date().toLocaleTimeString();
    this.actionLogs.unshift({ time, msg, type });
    const logBox = document.getElementById('action-log-feed');
    if (logBox) {
      logBox.innerHTML = this.actionLogs.slice(0, 8).map(l => `
        <div class="log-entry log-${l.type.toLowerCase()}">
          <span class="log-time font-mono text-xs">[${l.time}]</span>
          <span class="log-msg text-xs">${l.msg}</span>
        </div>
      `).join('');
    }
  }

  switchTab(tabId) {
    this.activeTab = tabId;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `tab-${tabId}`);
    });
  }

  startClock() {
    const clockEl = document.getElementById('live-clock');
    if (clockEl) {
      setInterval(() => {
        const d = new Date();
        clockEl.textContent = d.toLocaleTimeString();
      }, 1000);
    }
  }
}

// Instantiate once DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  window.app = new DashboardApp();
});

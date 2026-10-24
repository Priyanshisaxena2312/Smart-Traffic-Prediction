/**
 * AURA-TM Interactive Corridor Visualizer
 * Real-time Canvas rendering of CORRIDOR-04-IT-EXPRESSWAY-MERGE:
 * - 3 Main expressway lanes + 1 Left merging slip lane
 * - Upstream Roundabout with dynamic queue accumulation & spillback alert
 * - Heterogeneous fleet simulation (2W, 3W, 4W, LCV, HCV)
 * - Dynamic weather effects (rain streaks, puddle waterlogging)
 * - Live Variable Message Signs (VMS Portal 01 & 02)
 * - Dual Inductive Loop & ANPR camera sensor consensus triggers
 */

export class CorridorCanvas {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.options = options;

    this.vehicles = [];
    this.rainDrops = [];
    this.sensorPulses = [];
    this.vmsPhase = 0;
    this.vmsTimer = 0;

    // Operational parameters
    this.effectiveVc = 1.66;
    this.precipitationRate = 24.0;
    this.hasStandingWater = true;
    this.visibilityMeters = 320;
    this.vehicleCounts = {
      two_wheeler: 520,
      three_wheeler: 140,
      passenger_car: 580,
      light_commercial: 44,
      heavy_commercial: 38
    };

    this.isRunning = false;
    this.lastTime = 0;

    this.initCanvasSize();
    this.initRain();
    this.initVehicles();

    window.addEventListener('resize', () => this.initCanvasSize());
  }

  initCanvasSize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width || 1000;
    this.height = 340;

    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx.scale(dpr, dpr);
  }

  updateOperationalState(state) {
    this.effectiveVc = state.effective_vc || 1.66;
    this.precipitationRate = state.precipitation_rate !== undefined ? state.precipitation_rate : 24.0;
    this.hasStandingWater = state.has_standing_water !== undefined ? state.has_standing_water : true;
    this.visibilityMeters = state.horizontal_visibility || 320;
    if (state.vehicle_counts) {
      this.vehicleCounts = state.vehicle_counts;
    }

    this.initRain();
  }

  initRain() {
    this.rainDrops = [];
    const count = Math.min(250, Math.floor(this.precipitationRate * 8));
    for (let i = 0; i < count; i++) {
      this.rainDrops.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        length: 8 + Math.random() * 12,
        speed: 8 + Math.random() * 8,
        opacity: 0.15 + Math.random() * 0.35
      });
    }
  }

  initVehicles() {
    this.vehicles = [];
    const totalVehicles = 40;
    for (let i = 0; i < totalVehicles; i++) {
      this.vehicles.push(this.createVehicle(Math.random() * this.width));
    }
  }

  createVehicle(startX = 0) {
    // Determine vehicle type based on fleet mix proportions
    const total = (this.vehicleCounts.two_wheeler +
                   this.vehicleCounts.three_wheeler +
                   this.vehicleCounts.passenger_car +
                   this.vehicleCounts.light_commercial +
                   this.vehicleCounts.heavy_commercial) || 1000;

    const r = Math.random() * total;
    let type = 'car';
    let length = 18;
    let width = 9;
    let color = '#38bdf8'; // Sky blue car

    if (r < this.vehicleCounts.two_wheeler) {
      type = '2w';
      length = 8;
      width = 4;
      color = '#00f0ff'; // Cyan bike
    } else if (r < this.vehicleCounts.two_wheeler + this.vehicleCounts.three_wheeler) {
      type = '3w';
      length = 12;
      width = 7;
      color = '#f59e0b'; // Amber auto
    } else if (r < this.vehicleCounts.two_wheeler + this.vehicleCounts.three_wheeler + this.vehicleCounts.passenger_car) {
      type = '4w';
      length = 18;
      width = 9;
      color = Math.random() > 0.5 ? '#f8fafc' : '#38bdf8'; // White or blue car
    } else if (r < total - this.vehicleCounts.heavy_commercial) {
      type = 'lcv';
      length = 24;
      width = 10;
      color = '#fbbf24'; // Delivery van
    } else {
      type = 'hcv';
      length = 36;
      width = 12;
      color = '#ef4444'; // Red transit bus / heavy multi-axle truck
    }

    // Lane selection: 0 = Lane 1 (Fast), 1 = Lane 2 (Mid), 2 = Lane 3 (Slow), 3 = Slip Lane
    const lane = Math.random() < 0.25 ? 3 : Math.floor(Math.random() * 3);

    return {
      type,
      x: startX,
      lane,
      length,
      width,
      color,
      speedBase: 1.2 + Math.random() * 0.8,
      isBraking: false,
      hazardOn: false
    };
  }

  start() {
    if (!this.isRunning) {
      this.isRunning = true;
      this.lastTime = performance.now();
      requestAnimationFrame((t) => this.loop(t));
    }
  }

  stop() {
    this.isRunning = false;
  }

  loop(currentTime) {
    if (!this.isRunning) return;
    const delta = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    this.update(delta);
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  }

  update(delta) {
    // VMS Message Cycling
    this.vmsTimer += delta;
    if (this.vmsTimer > 3.0) {
      this.vmsTimer = 0;
      this.vmsPhase = (this.vmsPhase + 1) % 2;
    }

    // Speed calculation from Effective V/C
    // When V/C > 1.0, severe speed degradation
    let speedFactor = 1.0;
    if (this.effectiveVc > 1.8) {
      speedFactor = 0.18; // Severe stop-and-go gridlock
    } else if (this.effectiveVc > 1.2) {
      speedFactor = 0.35; // Heavy congestion
    } else if (this.effectiveVc > 0.9) {
      speedFactor = 0.60; // Unstable flow
    } else {
      speedFactor = 1.0; // Free / stable
    }

    // Weather impact on speed
    if (this.precipitationRate > 15) {
      speedFactor *= 0.8;
    }

    // Update Vehicles
    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];
      let currentSpeed = v.speedBase * speedFactor * 45 * delta;

      // Merging slowdown on slip lane (lane 3)
      if (v.lane === 3) {
        if (this.hasStandingWater && v.x > 380 && v.x < 550) {
          currentSpeed *= 0.3; // Crawl through standing water
          v.hazardOn = true;
        } else {
          v.hazardOn = false;
        }
        // At the merge point (x ~ 580), merge into Lane 2 or Lane 1
        if (v.x > 580) {
          v.lane = 2; // merged into Lane 3 of main expressway
        }
      }

      // Check proximity to vehicle in front
      let leadVehicleDist = 999;
      for (let j = 0; j < this.vehicles.length; j++) {
        if (i !== j && this.vehicles[j].lane === v.lane) {
          const dist = this.vehicles[j].x - v.x;
          if (dist > 0 && dist < leadVehicleDist) {
            leadVehicleDist = dist;
          }
        }
      }

      if (leadVehicleDist < v.length + 15) {
        currentSpeed = Math.min(currentSpeed, 0.2);
        v.isBraking = true;
      } else if (leadVehicleDist < v.length + 35) {
        currentSpeed *= 0.6;
        v.isBraking = true;
      } else {
        v.isBraking = speedFactor < 0.5;
      }

      v.x += currentSpeed;

      // Trigger sensor pulses when crossing x = 280 (Loops) or x = 500 (ANPR)
      if (Math.abs(v.x - 280) < 2 && Math.random() < 0.2) {
        this.sensorPulses.push({ x: 280, y: this.getLaneY(v.lane), r: 2, maxR: 16, life: 1.0 });
      }

      // Loop around
      if (v.x > this.width + 40) {
        this.vehicles[i] = this.createVehicle(-40);
      }
    }

    // Update Sensor Pulses
    for (let i = this.sensorPulses.length - 1; i >= 0; i--) {
      const p = this.sensorPulses[i];
      p.r += delta * 25;
      p.life -= delta * 2.0;
      if (p.life <= 0) {
        this.sensorPulses.splice(i, 1);
      }
    }

    // Update Rain
    for (const drop of this.rainDrops) {
      drop.y += drop.speed;
      drop.x -= drop.speed * 0.3; // Slanted rain
      if (drop.y > this.height) {
        drop.y = -10;
        drop.x = Math.random() * (this.width + 100);
      }
    }
  }

  getLaneY(laneIndex) {
    const mainRoadTop = 110;
    const laneHeight = 36;
    if (laneIndex === 0) return mainRoadTop + 18;
    if (laneIndex === 1) return mainRoadTop + 18 + laneHeight;
    if (laneIndex === 2) return mainRoadTop + 18 + laneHeight * 2;
    // Slip lane (curved approach on top)
    return 55;
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Background: Dark control room asphalt & surrounding terrain
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    // Grid lines for high-tech HUD look
    this.renderTelemetryGrid();

    // Upstream Roundabout depiction (Left side: x: 0 to 140)
    this.renderRoundaboutZone();

    // Roadway Infrastructure (3 Main Lanes)
    this.renderMainCarriageway();

    // Merging Slip Lane
    this.renderSlipLane();

    // Sensor Detection Zones (Loops & ANPR)
    this.renderSensors();

    // Dynamic Vehicles
    this.renderVehicles();

    // Sensor Pulses
    this.renderSensorPulses();

    // Variable Message Signs (VMS Gantries)
    this.renderVMSGantries();

    // Environmental Effects: Waterlogging Puddle & Rain
    this.renderEnvironmentalLayer();

    // HUD Status Overlays
    this.renderHudBadges();
  }

  renderTelemetryGrid() {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < this.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    for (let y = 0; y < this.height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  renderRoundaboutZone() {
    const ctx = this.ctx;
    const cx = 70;
    const cy = 164;
    const rOuter = 55;
    const rInner = 28;

    ctx.save();
    // Roundabout road ring
    ctx.fillStyle = '#171e2e';
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
    ctx.fill();

    // Central island
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
    ctx.fill();

    // Island border with amber pulsing ring if spillback risk is high
    const isSpillback = this.effectiveVc > 1.15;
    ctx.strokeStyle = isSpillback ? 'rgba(239, 68, 68, 0.7)' : 'rgba(0, 240, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Roundabout Center Text
    ctx.fillStyle = isSpillback ? '#ef4444' : '#64748b';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('UPSTREAM', cx, cy - 4);
    ctx.fillText('R-ABOUT', cx, cy + 7);

    // Spillback queue warning bar
    if (isSpillback) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
      ctx.fillRect(cx + rOuter - 5, cy - 30, 60, 60);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx + rOuter - 5, cy - 30, 60, 60);

      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.fillText('SPILLBACK', cx + rOuter + 25, cy + 3);
    }
    ctx.restore();
  }

  renderMainCarriageway() {
    const ctx = this.ctx;
    const topY = 110;
    const laneH = 36;
    const totalH = laneH * 3;

    ctx.save();
    // Asphalt base
    ctx.fillStyle = '#111827';
    ctx.fillRect(120, topY, this.width - 120, totalH);

    // Road borders (Solid white)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(120, topY);
    ctx.lineTo(this.width, topY);
    ctx.moveTo(120, topY + totalH);
    ctx.lineTo(this.width, topY + totalH);
    ctx.stroke();

    // Dashed lane dividers
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([12, 12]);
    ctx.beginPath();
    ctx.moveTo(120, topY + laneH);
    ctx.lineTo(this.width, topY + laneH);
    ctx.moveTo(120, topY + laneH * 2);
    ctx.lineTo(this.width, topY + laneH * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Lane Labels (subtle)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('LANE 1 (FAST)', 130, topY + 12);
    ctx.fillText('LANE 2 (MID)', 130, topY + laneH + 12);
    ctx.fillText('LANE 3 (SLOW)', 130, topY + laneH * 2 + 12);

    ctx.restore();
  }

  renderSlipLane() {
    const ctx = this.ctx;
    const topY = 110;

    ctx.save();
    // Slip Lane approach path from top-left (x: 200, y: 35) down to merge point (x: 580, y: topY + 72)
    ctx.fillStyle = '#151d2f';
    ctx.beginPath();
    ctx.moveTo(220, 40);
    ctx.lineTo(440, 60);
    ctx.lineTo(580, topY + 72);
    ctx.lineTo(580, topY + 108);
    ctx.lineTo(400, topY + 108);
    ctx.lineTo(220, 75);
    ctx.closePath();
    ctx.fill();

    // Slip Lane road boundaries
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(220, 40);
    ctx.lineTo(440, 60);
    ctx.lineTo(580, topY + 72);
    ctx.stroke();

    // Painted Chevron Gore Area (Merge taper between slip lane and main road)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.moveTo(340, topY);
    ctx.lineTo(580, topY);
    ctx.lineTo(580, topY + 72);
    ctx.closePath();
    ctx.fill();

    // Chevrons inside gore area
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1.5;
    for (let gx = 360; gx < 570; gx += 28) {
      ctx.beginPath();
      ctx.moveTo(gx, topY);
      ctx.lineTo(gx + 14, topY + 28);
      ctx.stroke();
    }

    // Slip Lane Label
    ctx.fillStyle = '#f59e0b';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillText('LEFT MERGE SLIP LANE', 230, 32);

    ctx.restore();
  }

  renderSensors() {
    const ctx = this.ctx;
    ctx.save();

    // Dual Inductive Loops at x = 280
    const loopX = 280;
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1;
    for (let l = 0; l < 3; l++) {
      const ly = 110 + l * 36 + 6;
      ctx.strokeRect(loopX, ly, 18, 24);
      ctx.strokeRect(loopX + 24, ly, 18, 24);
    }
    ctx.fillStyle = '#00f0ff';
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.fillText('DUAL LOOPS', loopX - 8, 104);

    // ANPR Camera at x = 500
    const anprX = 500;
    ctx.fillStyle = '#00e676';
    ctx.fillRect(anprX, 94, 6, 12);
    ctx.strokeStyle = '#00e676';
    ctx.strokeRect(anprX - 2, 92, 10, 16);
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.fillText('ANPR CAM-04', anprX - 16, 88);

    ctx.restore();
  }

  renderVehicles() {
    const ctx = this.ctx;
    ctx.save();

    for (const v of this.vehicles) {
      let vx = v.x;
      let vy = 0;

      if (v.lane === 3) {
        // Angled slip lane trajectory
        if (vx < 220) {
          vy = 58;
        } else if (vx < 580) {
          const t = (vx - 220) / 360;
          vy = 58 + t * (110 + 72 - 58);
        } else {
          vy = 110 + 72 + 18;
        }
      } else {
        vy = this.getLaneY(v.lane);
      }

      // Draw vehicle body
      ctx.fillStyle = v.color;
      ctx.shadowColor = v.color;
      ctx.shadowBlur = 4;
      ctx.fillRect(vx - v.length / 2, vy - v.width / 2, v.length, v.width);
      ctx.shadowBlur = 0;

      // Headlights (glowing white/yellow forward)
      ctx.fillStyle = 'rgba(255, 255, 200, 0.8)';
      ctx.fillRect(vx + v.length / 2, vy - v.width / 2 + 1, 3, 2);
      ctx.fillRect(vx + v.length / 2, vy + v.width / 2 - 3, 3, 2);

      // Taillights (red behind)
      ctx.fillStyle = v.isBraking ? '#ff1744' : '#ef4444';
      if (v.isBraking) {
        ctx.shadowColor = '#ff1744';
        ctx.shadowBlur = 6;
      }
      ctx.fillRect(vx - v.length / 2 - 2, vy - v.width / 2 + 1, 2, 2);
      ctx.fillRect(vx - v.length / 2 - 2, vy + v.width / 2 - 3, 2, 2);
      ctx.shadowBlur = 0;

      // Hazard blinker if waterlogged
      if (v.hazardOn && Math.floor(performance.now() / 300) % 2 === 0) {
        ctx.fillStyle = '#ffab00';
        ctx.fillRect(vx - v.length / 2 - 2, vy - v.width / 2 - 2, 3, 3);
        ctx.fillRect(vx + v.length / 2, vy + v.width / 2, 3, 3);
      }
    }

    ctx.restore();
  }

  renderSensorPulses() {
    const ctx = this.ctx;
    ctx.save();
    for (const p of this.sensorPulses) {
      ctx.strokeStyle = `rgba(0, 240, 255, ${p.life})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  renderVMSGantries() {
    const ctx = this.ctx;
    ctx.save();

    // VMS Portal 01 (Overhead at x = 320)
    const vms1X = 320;
    const vms1Y = 70;
    ctx.fillStyle = '#05070e';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.fillRect(vms1X - 85, vms1Y, 170, 24);
    ctx.strokeRect(vms1X - 85, vms1Y, 170, 24);

    ctx.fillStyle = '#f59e0b'; // Amber LED Dot Matrix
    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    if (this.vmsPhase === 0) {
      ctx.fillText('VMS-01: HEAVY RAIN / WATERLOGGING', vms1X, vms1Y + 10);
      ctx.fillText('REDUCE SPEED TO 30 KM/H', vms1X, vms1Y + 19);
    } else {
      ctx.fillText('VMS-01: SLIP LANE BLOCKED AHEAD', vms1X, vms1Y + 10);
      ctx.fillText('DIVERT VIA OUTER RING ROAD', vms1X, vms1Y + 19);
    }

    // VMS Portal 02 (Overhead at x = 750)
    const vms2X = 750;
    const vms2Y = 70;
    ctx.fillStyle = '#05070e';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.fillRect(vms2X - 85, vms2Y, 170, 24);
    ctx.strokeRect(vms2X - 85, vms2Y, 170, 24);

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    if (this.vmsPhase === 0) {
      ctx.fillText('VMS-02: CAUTION STANDING WATER', vms2X, vms2Y + 10);
      ctx.fillText('MERGE RIGHT SAFELY', vms2X, vms2Y + 19);
    } else {
      ctx.fillText('VMS-02: HIGH SPILLBACK RISK', vms2X, vms2Y + 10);
      ctx.fillText('KEEP INTERSECTION BOX CLEAR', vms2X, vms2Y + 19);
    }

    ctx.restore();
  }

  renderEnvironmentalLayer() {
    const ctx = this.ctx;
    ctx.save();

    // Standing water / puddle zone on leftmost slip lane (x: 410 to 550, y: 70 to 115)
    if (this.hasStandingWater) {
      const grad = ctx.createRadialGradient(480, 95, 10, 480, 95, 60);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
      grad.addColorStop(0.6, 'rgba(14, 165, 233, 0.25)');
      grad.addColorStop(1, 'rgba(14, 165, 233, 0.0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(480, 95, 65, 22, -0.15, 0, Math.PI * 2);
      ctx.fill();

      // Water surface ripple animation
      const rippleTime = performance.now() / 400;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(480, 95, (rippleTime % 3) * 18, (rippleTime % 3) * 6, -0.15, 0, Math.PI * 2);
      ctx.stroke();

      // Warning marker for puddle
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 8px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('▲ STANDING WATER HAZARD (24 mm/hr)', 480, 130);
    }

    // Animated Rain streaks
    if (this.precipitationRate > 0) {
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.4)';
      ctx.lineWidth = 1;
      for (const d of this.rainDrops) {
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - d.length * 0.3, d.y + d.length);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  renderHudBadges() {
    const ctx = this.ctx;
    ctx.save();

    // Top Header Telemetry Strip
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(0, 0, this.width, 24);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.strokeRect(0, 0, this.width, 24);

    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#00f0ff';
    ctx.textAlign = 'left';
    ctx.fillText('LIVE SCHEMATIC: CORRIDOR-04-IT-EXPRESSWAY-MERGE', 12, 16);

    ctx.textAlign = 'right';
    const isOversat = this.effectiveVc > 1.0;
    ctx.fillStyle = isOversat ? '#ef4444' : '#00e676';
    ctx.fillText(
      `EFF V/C: ${this.effectiveVc.toFixed(2)} | PRECIP: ${this.precipitationRate} mm/h | REGIME: ${isOversat ? 'OVERSATURATED' : 'STABLE'}`,
      this.width - 12,
      16
    );

    ctx.restore();
  }
}

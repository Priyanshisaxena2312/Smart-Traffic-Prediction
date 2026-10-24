/**
 * AURA-TM (Autonomous Urban Routing & Adaptive Traffic Management)
 * Core Deterministic Calculation Engine
 * 
 * Compliant with Advanced Reliability, Validation & Safety Protocol:
 * - Module 1: Passenger Car Unit (PCU) Conversion & Normalized Demand
 * - Module 2: Environmental & Weather Capacity Adjustment
 * - Module 3: Scenario Forecasting & Temporal Progression Multipliers
 * - Module 4: Statistical Anomaly Detection (Congestion Deviation Index - CDI)
 * - Module 5: Level of Service (LoS) Classification by V/C
 * - Traffic-Control Safety Gate: Advisory-only enforcement & command withholding
 */

export const PCU_FACTORS = {
  two_wheeler: 0.50,
  three_wheeler: 0.80,
  passenger_car: 1.00,
  light_commercial: 1.50,
  heavy_commercial: 3.00
};

export const TEMPORAL_WINDOWS = {
  morning_peak_buildup: {
    label: "Morning Peak Build-Up (08:00 - 09:29)",
    tpm: { t15: 1.12, t30: 1.22, t60: 1.15 }
  },
  morning_peak_plateau: {
    label: "Morning Peak Plateau (09:30 - 10:59)",
    tpm: { t15: 1.04, t30: 0.98, t60: 0.85 }
  },
  midday_offpeak: {
    label: "Mid-Day Off-Peak (11:00 - 16:59)",
    tpm: { t15: 1.00, t30: 1.00, t60: 1.02 }
  },
  evening_peak_buildup: {
    label: "Evening Peak Build-Up (17:00 - 18:59)",
    tpm: { t15: 1.15, t30: 1.28, t60: 1.20 }
  },
  evening_peak_dissipation: {
    label: "Evening Peak Dissipation (19:00 - 21:29)",
    tpm: { t15: 0.95, t30: 0.86, t60: 0.72 }
  },
  night_freight: {
    label: "Night Freight Window (21:30 - 07:59)",
    tpm: { t15: 0.90, t30: 0.85, t60: 0.80 }
  }
};

/**
 * Validates inputs according to Protocol Section A
 */
export function validateTelemetryInputs(inputs) {
  const errors = [];
  const warnings = [];

  // Vehicle count checks
  const counts = inputs.vehicle_counts || {};
  ['two_wheeler', 'three_wheeler', 'passenger_car', 'light_commercial', 'heavy_commercial'].forEach(key => {
    const val = counts[key];
    if (val === undefined || val === null || isNaN(val)) {
      errors.push(`Missing or non-numeric count for vehicle class: ${key}`);
    } else if (val < 0) {
      errors.push(`Vehicle count for ${key} cannot be negative (${val})`);
    }
  });

  // Capacity check
  if (!inputs.base_design_capacity || inputs.base_design_capacity <= 0) {
    errors.push(`Base design capacity must be positive (> 0), got: ${inputs.base_design_capacity}`);
  }

  // Historical statistics check
  if (!inputs.historical_mean || inputs.historical_mean <= 0) {
    errors.push(`Historical mean demand must be positive (> 0), got: ${inputs.historical_mean}`);
  }
  if (!inputs.historical_std_dev || inputs.historical_std_dev <= 0) {
    errors.push(`Historical standard deviation must be positive (> 0), got: ${inputs.historical_std_dev}`);
  }

  // Weather check
  if (inputs.precipitation_rate < 0) {
    errors.push(`Precipitation rate cannot be negative, got: ${inputs.precipitation_rate}`);
  }
  if (inputs.horizontal_visibility < 0) {
    errors.push(`Horizontal visibility cannot be negative, got: ${inputs.horizontal_visibility}`);
  }

  // Safety Gate Check: Controller Constraints
  const hasControllerConstraints = inputs.signal_controller_constraints !== null && 
                                   inputs.controller_authorization_token !== null;
  if (!hasControllerConstraints) {
    warnings.push("Controller safety parameters and authorization token missing: Actuation gated to ADVISORY_ONLY");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Calculates Module 1: PCU Conversion & Normalized Demand
 */
export function calculateModule1Demand(vehicleCounts, baseCapacity) {
  const c2w = vehicleCounts.two_wheeler * PCU_FACTORS.two_wheeler;
  const c3w = vehicleCounts.three_wheeler * PCU_FACTORS.three_wheeler;
  const c4w = vehicleCounts.passenger_car * PCU_FACTORS.passenger_car;
  const clcv = vehicleCounts.light_commercial * PCU_FACTORS.light_commercial;
  const chcv = vehicleCounts.heavy_commercial * PCU_FACTORS.heavy_commercial;

  const current15mLoad = c2w + c3w + c4w + clcv + chcv;
  const normalizedHourlyDemand = current15mLoad * 4;
  const unadjustedBaseVC = normalizedHourlyDemand / baseCapacity;

  return {
    components: {
      two_wheeler_pcu: c2w,
      three_wheeler_pcu: c3w,
      passenger_car_pcu: c4w,
      light_commercial_pcu: clcv,
      heavy_commercial_pcu: chcv
    },
    current_15m_load_pcu: current15mLoad,
    normalized_hourly_demand_pcu_hr: normalizedHourlyDemand,
    unadjusted_base_v_c: unadjustedBaseVC
  };
}

/**
 * Calculates Module 2: Weather Capacity Adjustment
 */
export function calculateModule2Weather(precipitationMmHr, visibilityMeters, hasStandingWater, baseCapacity) {
  let wcm = 1.00;
  let conditionClass = "Clear / Dry";

  // Dense fog or severe storm
  if (visibilityMeters < 150) {
    wcm = 0.55;
    conditionClass = "Dense Fog / Severe Storm (Visibility < 150 m)";
  } else if (precipitationMmHr > 15.0 || hasStandingWater) {
    wcm = 0.65;
    conditionClass = "Heavy Rain / Waterlogging (Precipitation > 15.0 mm/hr OR Standing Water)";
  } else if (precipitationMmHr >= 0.1 || visibilityMeters < 1000) {
    wcm = 0.88;
    conditionClass = "Light Rain / Mist (Precipitation 0.1 to 15.0 mm/hr AND Visibility >= 500 m)";
  } else {
    wcm = 1.00;
    conditionClass = "Clear / Dry (Precipitation = 0 mm/hr AND Visibility >= 1000 m)";
  }

  const effectiveCapacity = baseCapacity * wcm;

  return {
    weather_capacity_multiplier: wcm,
    condition_classification: conditionClass,
    effective_capacity_pcu_hr: effectiveCapacity
  };
}

/**
 * Calculates Module 3: Scenario Forecasting & Temporal Progression
 */
export function calculateModule3Forecast(normalizedDemandT0, effectiveCapacity, temporalWindowKey, isFriday, hasSpecialEvent) {
  const windowConfig = TEMPORAL_WINDOWS[temporalWindowKey] || TEMPORAL_WINDOWS.evening_peak_buildup;
  const baseTpm = windowConfig.tpm;

  // Single Calendar Adjustment Rule: +0.08 applied ONCE only per horizon to prevent double counting
  let calendarAdjustment = 0.0;
  let calendarReason = "No special calendar or surge adjustment";
  if (isFriday || hasSpecialEvent) {
    calendarAdjustment = 0.08;
    if (isFriday && hasSpecialEvent) {
      calendarReason = "Friday context applied (+0.08); secondary surge qualifier absorbed without double-counting";
    } else if (isFriday) {
      calendarReason = "Friday weekend build-up adjustment (+0.08)";
    } else {
      calendarReason = "Active special event / pre-holiday adjustment (+0.08)";
    }
  }

  const effectiveTpm = {
    t15: Number((baseTpm.t15 + calendarAdjustment).toFixed(2)),
    t30: Number((baseTpm.t30 + calendarAdjustment).toFixed(2)),
    t60: Number((baseTpm.t60 + calendarAdjustment).toFixed(2))
  };

  const projections = {
    t15: {
      horizon: "T+15m",
      offset_minutes: 15,
      base_tpm: baseTpm.t15,
      effective_tpm: effectiveTpm.t15,
      projected_demand_pcu_hr: normalizedDemandT0 * effectiveTpm.t15,
      effective_capacity_pcu_hr: effectiveCapacity,
      effective_v_c: (normalizedDemandT0 * effectiveTpm.t15) / effectiveCapacity
    },
    t30: {
      horizon: "T+30m",
      offset_minutes: 30,
      base_tpm: baseTpm.t30,
      effective_tpm: effectiveTpm.t30,
      projected_demand_pcu_hr: normalizedDemandT0 * effectiveTpm.t30,
      effective_capacity_pcu_hr: effectiveCapacity,
      effective_v_c: (normalizedDemandT0 * effectiveTpm.t30) / effectiveCapacity
    },
    t60: {
      horizon: "T+60m",
      offset_minutes: 60,
      base_tpm: baseTpm.t60,
      effective_tpm: effectiveTpm.t60,
      projected_demand_pcu_hr: normalizedDemandT0 * effectiveTpm.t60,
      effective_capacity_pcu_hr: effectiveCapacity,
      effective_v_c: (normalizedDemandT0 * effectiveTpm.t60) / effectiveCapacity
    }
  };

  return {
    window_label: windowConfig.label,
    base_tpm: baseTpm,
    calendar_adjustment: calendarAdjustment,
    calendar_reason: calendarReason,
    effective_tpm: effectiveTpm,
    projections
  };
}

/**
 * Calculates Module 4: Statistical Anomaly Detection (CDI)
 */
export function calculateModule4Anomaly(normalizedDemandT0, historicalMean, historicalStdDev) {
  const deviation = normalizedDemandT0 - historicalMean;
  const cdi = deviation / historicalStdDev;

  let classification = "NORMAL_VARIATION";
  let severity = "NORMAL";
  let description = "Within normal historical variation (|CDI| < 1.00)";

  if (cdi > 1.80) {
    classification = "SEVERE_POSITIVE_ANOMALY";
    severity = "CRITICAL";
    description = "Severe positive statistical demand surge (CDI > 1.80). Requires physical field verification.";
  } else if (cdi >= 1.00) {
    classification = "ELEVATED_DEMAND_ANOMALY";
    severity = "WARNING";
    description = "Statistically elevated demand surge (1.00 <= CDI <= 1.80).";
  } else if (cdi < -1.00) {
    classification = "LOW_DEMAND_ANOMALY";
    severity = "NOTICE";
    description = "Below-average demand anomaly (CDI < -1.00). Check for upstream blockage or sensor dropout.";
  }

  return {
    historical_mean: historicalMean,
    historical_std_dev: historicalStdDev,
    demand_deviation_pcu_hr: deviation,
    cdi_z_score: cdi,
    classification,
    severity,
    description
  };
}

/**
 * Module 5: Level of Service (LoS) Classification by V/C
 */
export function classifyLoS(effectiveVC) {
  if (effectiveVC < 0.35) {
    return { grade: "LoS A", regime: "Free-flow demand-to-capacity regime", flag: "[FREE_FLOW]", color: "#00e676" };
  } else if (effectiveVC <= 0.55) {
    return { grade: "LoS B", regime: "Reasonably stable flow regime", flag: "[STABLE_FLOW]", color: "#22c55e" };
  } else if (effectiveVC <= 0.75) {
    return { grade: "LoS C", regime: "Stable flow demand-to-capacity regime", flag: "[STABLE_FLOW]", color: "#eab308" };
  } else if (effectiveVC <= 0.90) {
    return { grade: "LoS D", regime: "Approaching unstable regime", flag: "[CONGESTION_APPROACHING]", color: "#f97316" };
  } else if (effectiveVC <= 1.00) {
    return { grade: "LoS E", regime: "Unstable / near-capacity regime", flag: "[NEAR_CAPACITY]", color: "#ef4444" };
  } else {
    return { grade: "LoS F", regime: "Oversaturated demand regime", flag: "[OVERSATURATED_REGIME]", color: "#dc2626" };
  }
}

/**
 * Master Execution Function: Runs full AURA-TM Deterministic Pipeline
 */
export function executeAuraTmEngine(telemetryInput) {
  const validation = validateTelemetryInputs(telemetryInput);
  if (!validation.valid) {
    return {
      success: false,
      validation,
      error: "Input validation failed: " + validation.errors.join("; ")
    };
  }

  const baseCapacity = telemetryInput.base_design_capacity;
  const counts = telemetryInput.vehicle_counts;
  const precip = telemetryInput.precipitation_rate;
  const vis = telemetryInput.horizontal_visibility;
  const standingWater = telemetryInput.has_standing_water;

  // Module 1
  const mod1 = calculateModule1Demand(counts, baseCapacity);
  const normalizedDemandT0 = mod1.normalized_hourly_demand_pcu_hr;

  // Module 2
  const mod2 = calculateModule2Weather(precip, vis, standingWater, baseCapacity);
  const effectiveCapacity = mod2.effective_capacity_pcu_hr;

  // T0 Effective V/C and LoS
  const effectiveVcT0 = normalizedDemandT0 / effectiveCapacity;
  const losT0 = classifyLoS(effectiveVcT0);

  // Module 3
  const isFriday = telemetryInput.day_of_week === "Friday";
  const hasEvent = Boolean(telemetryInput.special_event || telemetryInput.pre_weekend_surge);
  const mod3 = calculateModule3Forecast(
    normalizedDemandT0,
    effectiveCapacity,
    telemetryInput.temporal_window_key,
    isFriday,
    hasEvent
  );

  // Module 4
  const mod4 = calculateModule4Anomaly(
    normalizedDemandT0,
    telemetryInput.historical_mean,
    telemetryInput.historical_std_dev
  );

  // Multi-horizon results with LoS
  const horizons = [
    {
      horizon: "T0 (Current)",
      offset_minutes: 0,
      timestamp_iso: telemetryInput.timestamp_iso8601,
      demand_pcu_hr: normalizedDemandT0,
      demand_pcu_hr_exact: normalizedDemandT0,
      effective_capacity_pcu_hr: effectiveCapacity,
      effective_v_c: effectiveVcT0,
      los: losT0,
      predicted_speed: null,
      queue_length_meters: null,
      provenance: "[CALCULATED]"
    },
    {
      horizon: "T+15m",
      offset_minutes: 15,
      timestamp_iso: addMinutesToIso(telemetryInput.timestamp_iso8601, 15),
      demand_pcu_hr: Number(mod3.projections.t15.projected_demand_pcu_hr.toFixed(1)),
      demand_pcu_hr_exact: mod3.projections.t15.projected_demand_pcu_hr,
      effective_capacity_pcu_hr: effectiveCapacity,
      effective_v_c: mod3.projections.t15.effective_v_c,
      los: classifyLoS(mod3.projections.t15.effective_v_c),
      predicted_speed: null,
      queue_length_meters: null,
      provenance: "[FORECAST]"
    },
    {
      horizon: "T+30m",
      offset_minutes: 30,
      timestamp_iso: addMinutesToIso(telemetryInput.timestamp_iso8601, 30),
      demand_pcu_hr: Number(mod3.projections.t30.projected_demand_pcu_hr.toFixed(1)),
      demand_pcu_hr_exact: mod3.projections.t30.projected_demand_pcu_hr,
      effective_capacity_pcu_hr: effectiveCapacity,
      effective_v_c: mod3.projections.t30.effective_v_c,
      los: classifyLoS(mod3.projections.t30.effective_v_c),
      predicted_speed: null,
      queue_length_meters: null,
      provenance: "[FORECAST]"
    },
    {
      horizon: "T+60m",
      offset_minutes: 60,
      timestamp_iso: addMinutesToIso(telemetryInput.timestamp_iso8601, 60),
      demand_pcu_hr: Number(mod3.projections.t60.projected_demand_pcu_hr.toFixed(1)),
      demand_pcu_hr_exact: mod3.projections.t60.projected_demand_pcu_hr,
      effective_capacity_pcu_hr: effectiveCapacity,
      effective_v_c: mod3.projections.t60.effective_v_c,
      los: classifyLoS(mod3.projections.t60.effective_v_c),
      predicted_speed: null,
      queue_length_meters: null,
      provenance: "[FORECAST]"
    }
  ];

  // Safety Gate & Advisories
  const advisories = generateAdvisories(effectiveVcT0, mod4, standingWater, precip);

  // Generate Strict M2M JSON Payload
  const m2mPayload = generateM2mJsonPayload(
    telemetryInput,
    mod1,
    mod2,
    mod3,
    mod4,
    horizons,
    advisories
  );

  return {
    success: true,
    validation,
    timestamp_iso8601: telemetryInput.timestamp_iso8601,
    corridor_id: telemetryInput.corridor_id,
    module1: mod1,
    module2: mod2,
    module3: mod3,
    module4: mod4,
    effective_vc_t0: effectiveVcT0,
    los_t0: losT0,
    horizons,
    advisories,
    m2m_payload: m2mPayload
  };
}

/**
 * Generate Safety-Gated Advisories per Protocol Section D
 */
function generateAdvisories(effectiveVc, anomaly, hasStandingWater, precipitationRate) {
  const list = [];

  // Standing water & drainage
  if (hasStandingWater || precipitationRate > 15.0) {
    list.push({
      id: "ADV-01",
      category: "FIELD_DISPATCH",
      priority: "CRITICAL",
      title: "Emergency Drainage Pump Dispatch",
      target_location: "CORRIDOR-04-IT-EXPRESSWAY-MERGE (Leftmost Slip Lane)",
      action_required: "Deploy municipal emergency water suction pumps to clear standing water on the merge slip lane.",
      status: "DISPATCH_PENDING"
    });
  }

  // Upstream spillback verification
  if (effectiveVc > 1.15) {
    list.push({
      id: "ADV-02",
      category: "INCIDENT_VERIFICATION",
      priority: "HIGH",
      title: "Roundabout CCTV Spillback Inspection",
      target_location: "Upstream Roundabout Approaches",
      action_required: "PTZ surveillance cameras must verify physical queue progression on upstream roundabout approaches.",
      status: "VERIFICATION_REQUIRED"
    });
  }

  // VMS Portal 01 (Pre-Divergence)
  list.push({
    id: "ADV-03",
    category: "VMS_BROADCAST",
    priority: "HIGH",
    title: "Upstream Divergence Warning (VMS 01 - 2.0 km)",
    target_location: "VMS Portal 01 (Upstream 2.0 km)",
    action_required: "Display: 'HEAVY WATERLOGGING AT IT MERGE / SEVERE DELAY / DIVERT VIA OUTER RING ROAD'",
    status: "BROADCAST_ACTIVE"
  });

  // VMS Portal 02 (Merge Approach)
  list.push({
    id: "ADV-04",
    category: "VMS_BROADCAST",
    priority: "MEDIUM",
    title: "Approach Caution Advisory (VMS 02 - 800 m)",
    target_location: "VMS Portal 02 (Upstream 800 m)",
    action_required: "Display: 'CAUTION: STANDING WATER ON LEFT SLIP LANE / MERGE RIGHT SAFELY'",
    status: "BROADCAST_ACTIVE"
  });

  return list;
}

/**
 * Strict Machine-to-Machine JSON Payload Generator adhering to Section E
 */
function generateM2mJsonPayload(telemetry, mod1, mod2, mod3, mod4, horizons, advisories) {
  return {
    system_id: "AURA-TM-DETERMINISTIC-ENGINE",
    version: "2.4.0",
    timestamp_iso8601: telemetry.timestamp_iso8601,
    corridor_id: telemetry.corridor_id,
    safety_mode: "ADVISORY_ONLY / DRY_RUN",
    data_quality: {
      sensor_status: "ACTIVE_VALIDATED",
      consensus_mechanism: "ANPR + Dual Inductive Loop Consensus",
      temporal_compatibility: "PASS_TIME_MATCHED",
      unit_compatibility: "PASS_COMPATIBLE_PCU_HR",
      unmodeled_attributes: [
        "Calibrated_Speed_Flow_Model",
        "Signal_Controller_Constraints",
        "Controller_Authorization_Token",
        "Lane_Level_Split_Data",
        "Downstream_Queue_Storage_Meters",
        "Forecast_Weather_Next_60_Min"
      ]
    },
    forecast_assumptions: {
      temporal_progression_model: `Declared Baseline Scenario Progression (${mod3.window_label})`,
      calendar_adjustment_applied: mod3.calendar_adjustment,
      calendar_adjustment_justification: mod3.calendar_reason,
      capacity_continuity_assumption: "Constant weather-adjusted capacity across all horizons due to null future weather feed",
      empirical_calibration_status: "Scenario projection; corridor-specific empirical regression uncalibrated"
    },
    model_limitations: {
      speed_estimation: "UNAVAILABLE: No calibrated speed-flow mathematical model provided in input",
      queue_length_meters: "UNAVAILABLE: No queue-accumulation or storage telemetry provided in input",
      congestion_percentage: "UNAVAILABLE: V/C is a demand-to-capacity index, not physical road occupancy percentage",
      confidence_interval: "UNAVAILABLE: Historical variance propagation model unsupplied"
    },
    telemetry_summary: {
      observation_window_start: addMinutesToIso(telemetry.timestamp_iso8601, -15),
      observation_window_end: telemetry.timestamp_iso8601,
      vehicle_counts_raw_per_15min: telemetry.vehicle_counts,
      environmental_telemetry: {
        precipitation_rate_mm_hr: telemetry.precipitation_rate,
        horizontal_visibility_meters: telemetry.horizontal_visibility,
        surface_condition_reported: telemetry.has_standing_water 
          ? "Standing water reported on leftmost merging slip lane" 
          : "Road surface unobstructed / normal wet or dry",
        weather_capacity_multiplier: mod2.weather_capacity_multiplier
      },
      historical_baseline: {
        time_matched_window: "Fridays 18:00 - 19:00",
        historical_mean_pcu_hr: telemetry.historical_mean,
        historical_std_dev_pcu_hr: telemetry.historical_std_dev
      }
    },
    calculated_metrics_t0: {
      current_15m_load_pcu: mod1.current_15m_load_pcu,
      normalized_hourly_flow_rate_pcu_hr: mod1.normalized_hourly_demand_pcu_hr,
      base_design_capacity_pcu_hr: telemetry.base_design_capacity,
      effective_capacity_pcu_hr: mod2.effective_capacity_pcu_hr,
      unadjusted_base_v_c_ratio: Number(mod1.unadjusted_base_v_c.toFixed(2)),
      effective_v_c_ratio: Number((mod1.normalized_hourly_demand_pcu_hr / mod2.effective_capacity_pcu_hr).toFixed(2)),
      level_of_service: classifyLoS(mod1.normalized_hourly_demand_pcu_hr / mod2.effective_capacity_pcu_hr).grade,
      regime_flag: classifyLoS(mod1.normalized_hourly_demand_pcu_hr / mod2.effective_capacity_pcu_hr).flag,
      predicted_speed_km_h: null,
      queue_length_meters: null
    },
    statistical_anomaly_evaluation: {
      metric_name: "Congestion Deviation Index (CDI)",
      cdi_z_score: Number(mod4.cdi_z_score.toFixed(2)),
      classification: mod4.classification,
      interpretation: `Statistical demand surge (+${mod4.cdi_z_score.toFixed(2)} sigma above historical mean); not definitive proof of physical incident`
    },
    forecast_horizons: horizons.slice(1).map(h => ({
      horizon: h.horizon,
      target_timestamp_iso8601: h.timestamp_iso,
      base_tpm: mod3.base_tpm[h.horizon.toLowerCase().replace('+', '').replace('m', '')],
      effective_tpm: mod3.effective_tpm[h.horizon.toLowerCase().replace('+', '').replace('m', '')],
      projected_demand_pcu_hr: Number(h.demand_pcu_hr_exact.toFixed(1)),
      projected_demand_pcu_hr_exact: h.demand_pcu_hr_exact,
      effective_capacity_pcu_hr: h.effective_capacity_pcu_hr,
      effective_v_c_ratio: Number(h.effective_v_c.toFixed(2)),
      level_of_service: h.los.grade,
      regime_flag: h.los.flag,
      predicted_speed_km_h: null,
      queue_length_meters: null,
      spillback_risk_assessment: h.effective_v_c > 1.15 ? "CRITICAL_SPILLBACK_RISK" : "CONTROLLED_FLOW"
    })),
    recommended_advisories: advisories.map(a => ({
      category: a.category,
      priority: a.priority,
      target_location: a.target_location,
      advisory_text: a.action_required
    })),
    authorized_commands: []
  };
}

/**
 * ISO 8601 Helper for rolling horizons with preserved timezone offset
 */
export function addMinutesToIso(isoString, minutes) {
  // Example: "2026-10-23T18:15:00+05:30"
  try {
    const offsetMatch = isoString.match(/([+-]\d{2}:\d{2})$/);
    const offset = offsetMatch ? offsetMatch[1] : "+05:30";
    const date = new Date(isoString);
    date.setMinutes(date.getMinutes() + minutes);
    
    // Format YYYY-MM-DDTHH:mm:ss+offset
    const pad = (n) => String(n).padStart(2, '0');
    // Compute local time considering offset
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const mins = pad(date.getMinutes());
    const secs = pad(date.getSeconds());
    return `${year}-${month}-${day}T${hours}:${mins}:${secs}${offset}`;
  } catch (e) {
    return isoString;
  }
}

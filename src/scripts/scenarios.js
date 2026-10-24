/**
 * AURA-TM Preset Scenarios
 * Includes the prompt's Live Execution Telemetry as Scenario 1 (Default),
 * plus realistic alternative operational cases for comparative evaluation.
 */

export const SCENARIOS = [
  {
    id: "live_incident_oct23",
    name: "Scenario 1: Live Incident - Oct 23, 18:15 (Rain + Outbound Surge)",
    badge: "ACTIVE TELEMETRY",
    badgeColor: "#dc2626",
    description: "Friday evening peak outbound surge coupled with 24 mm/hr monsoon precipitation and slip-lane waterlogging. Extreme oversaturation.",
    telemetry: {
      timestamp_iso8601: "2026-10-23T18:15:00+05:30",
      corridor_id: "CORRIDOR-04-IT-EXPRESSWAY-MERGE",
      base_design_capacity: 4200,
      free_flow_reference_speed: 60,
      day_of_week: "Friday",
      temporal_window_key: "evening_peak_buildup",
      pre_weekend_surge: true,
      special_event: false,
      vehicle_counts: {
        two_wheeler: 520,
        three_wheeler: 140,
        passenger_car: 580,
        light_commercial: 44,
        heavy_commercial: 38
      },
      precipitation_rate: 24.0,
      horizontal_visibility: 320,
      has_standing_water: true,
      historical_mean: 3500,
      historical_std_dev: 280,
      signal_controller_constraints: null,
      controller_authorization_token: null
    }
  },
  {
    id: "drainage_restored_1830",
    name: "Scenario 2: T+15 Post-Drainage Intervention (Pumps Deployed)",
    badge: "FIELD ACTION SUCCESS",
    badgeColor: "#00e676",
    description: "Emergency suction pumps have cleared the leftmost slip lane. Rain decreased to 4 mm/hr. Capacity restored to 3,696 PCU/hr.",
    telemetry: {
      timestamp_iso8601: "2026-10-23T18:30:00+05:30",
      corridor_id: "CORRIDOR-04-IT-EXPRESSWAY-MERGE",
      base_design_capacity: 4200,
      free_flow_reference_speed: 60,
      day_of_week: "Friday",
      temporal_window_key: "evening_peak_buildup",
      pre_weekend_surge: true,
      special_event: false,
      vehicle_counts: {
        two_wheeler: 490,
        three_wheeler: 130,
        passenger_car: 540,
        light_commercial: 40,
        heavy_commercial: 32
      },
      precipitation_rate: 4.0,
      horizontal_visibility: 850,
      has_standing_water: false,
      historical_mean: 3500,
      historical_std_dev: 280,
      signal_controller_constraints: null,
      controller_authorization_token: null
    }
  },
  {
    id: "morning_rush_clear",
    name: "Scenario 3: Typical Tuesday Morning Peak (Dry / High Volume)",
    badge: "HEAVY COMMUTE",
    badgeColor: "#eab308",
    description: "Sunny morning peak build-up (08:30). High passenger car and two-wheeler volumes with zero precipitation.",
    telemetry: {
      timestamp_iso8601: "2026-10-27T08:30:00+05:30",
      corridor_id: "CORRIDOR-04-IT-EXPRESSWAY-MERGE",
      base_design_capacity: 4200,
      free_flow_reference_speed: 60,
      day_of_week: "Tuesday",
      temporal_window_key: "morning_peak_buildup",
      pre_weekend_surge: false,
      special_event: false,
      vehicle_counts: {
        two_wheeler: 820,
        three_wheeler: 180,
        passenger_car: 720,
        light_commercial: 55,
        heavy_commercial: 25
      },
      precipitation_rate: 0.0,
      horizontal_visibility: 2000,
      has_standing_water: false,
      historical_mean: 3800,
      historical_std_dev: 310,
      signal_controller_constraints: null,
      controller_authorization_token: null
    }
  },
  {
    id: "midday_offpeak",
    name: "Scenario 4: Mid-Day Off-Peak Steady State (LoS B)",
    badge: "FREE FLOW",
    badgeColor: "#00f0ff",
    description: "Wednesday 14:15 off-peak traffic. Modest demand well within corridor design capacity under clear sky conditions.",
    telemetry: {
      timestamp_iso8601: "2026-10-28T14:15:00+05:30",
      corridor_id: "CORRIDOR-04-IT-EXPRESSWAY-MERGE",
      base_design_capacity: 4200,
      free_flow_reference_speed: 60,
      day_of_week: "Wednesday",
      temporal_window_key: "midday_offpeak",
      pre_weekend_surge: false,
      special_event: false,
      vehicle_counts: {
        two_wheeler: 220,
        three_wheeler: 60,
        passenger_car: 260,
        light_commercial: 30,
        heavy_commercial: 18
      },
      precipitation_rate: 0.0,
      horizontal_visibility: 2500,
      has_standing_water: false,
      historical_mean: 2100,
      historical_std_dev: 190,
      signal_controller_constraints: null,
      controller_authorization_token: null
    }
  },
  {
    id: "night_freight_corridor",
    name: "Scenario 5: Night Freight Window (Heavy Commercial Dominance)",
    badge: "FREIGHT CORRIDOR",
    badgeColor: "#a855f7",
    description: "Thursday 23:45 night freight movement. High proportion of HCVs and LCVs during late night off-peak.",
    telemetry: {
      timestamp_iso8601: "2026-10-29T23:45:00+05:30",
      corridor_id: "CORRIDOR-04-IT-EXPRESSWAY-MERGE",
      base_design_capacity: 4200,
      free_flow_reference_speed: 60,
      day_of_week: "Thursday",
      temporal_window_key: "night_freight",
      pre_weekend_surge: false,
      special_event: false,
      vehicle_counts: {
        two_wheeler: 40,
        three_wheeler: 15,
        passenger_car: 110,
        light_commercial: 95,
        heavy_commercial: 140
      },
      precipitation_rate: 0.0,
      horizontal_visibility: 1500,
      has_standing_water: false,
      historical_mean: 1800,
      historical_std_dev: 220,
      signal_controller_constraints: null,
      controller_authorization_token: null
    }
  }
];

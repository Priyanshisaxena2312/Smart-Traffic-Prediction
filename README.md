# 🚦 AURA-TM: Smart Traffic Prediction & Management

**Autonomous Urban Routing & Adaptive Traffic Management (AURA-TM)** is a smart traffic prediction and decision-support system designed to analyze traffic conditions, forecast congestion, and generate actionable traffic advisories. Inspired by smart city initiatives, the platform combines vehicle counts, weather conditions, time-based traffic patterns, and historical congestion data to help improve urban mobility.

The system provides an interactive traffic visualization dashboard, multi-horizon traffic projections, and statistical anomaly detection to support data-driven traffic management.


## 🎯 Project Objectives

- Predict traffic demand using vehicle counts and historical traffic patterns.
- Analyze different vehicle categories and convert their counts into Passenger Car Units (PCU).
- Estimate the impact of rainfall and waterlogging on road capacity.
- Forecast traffic conditions for the current time and the next 15, 30, and 60 minutes.
- Detect unusual traffic surges using historical congestion statistics.
- Visualize traffic flow, lane merging, weather conditions, and congestion levels.
- Generate safety-focused traffic advisories for decision-support teams.


## ✨ Key Features

### 1. 🚗 Real-Time Traffic Visualization
An interactive HTML5 Canvas dashboard visualizes traffic movement across Corridor-04, including:

- Three main expressway lanes.
- One left merging slip lane.
- Animated vehicle movement and lane merging.
- Rain particles and standing water effects.
- Dynamic Variable Message Signs (VMS).
- Visual representation of changing traffic conditions.

### 2. 📊 Multi-Horizon Traffic Prediction
The system estimates traffic conditions at multiple time horizons:

| Time Horizon | Purpose |
|---|---|
| T₀ | Assess current traffic conditions |
| T + 15 minutes | Identify short-term congestion risks |
| T + 30 minutes | Anticipate developing traffic bottlenecks |
| T + 60 minutes | Support traffic planning and resource allocation |

These projections help traffic management teams understand how current demand and road conditions may affect future congestion.

### 3. 🚙 Vehicle Count & PCU Analysis
The system considers different vehicle categories:

- Cars
- Two-wheelers
- Three-wheelers
- Light Commercial Vehicles (LCVs)
- Heavy Commercial Vehicles (HCVs)

Vehicle counts are converted into Passenger Car Units (PCU) using configurable conversion factors.

This provides a standardized measure of traffic demand and supports comparisons between different vehicle mixes.

### 4. 🌧️ Weather-Based Capacity Adjustment
Weather conditions can significantly affect traffic flow and road capacity.

The Weather Capacity Model (WCM) considers:

- Rainfall intensity.
- Standing water and waterlogging.
- Reduced effective road capacity under adverse conditions.

The model adjusts estimated road capacity according to weather and surface conditions, helping identify situations where even moderate traffic demand may result in congestion.

### 5. 📈 Congestion Deviation Index (CDI)
The Congestion Deviation Index identifies unusual traffic conditions by comparing current observations against historical traffic patterns.

The system uses a Z-score-based statistical approach:

**Z-score = (Observed Traffic − Historical Mean) / Historical Standard Deviation**

A higher absolute Z-score indicates that observed traffic differs substantially from its historical baseline.

The CDI can help flag:
- Unexpected traffic surges.
- Abnormal congestion.
- Potential traffic incidents requiring further investigation.

Thresholds should be configured and validated using historical data. A statistical anomaly is an alert for investigation, not proof that an incident has occurred.

### 6. 🕒 Time-Aware Traffic Analysis
Traffic demand varies throughout the day. AURA-TM accounts for different traffic periods:

- **Morning Peak:** Increased commuter traffic.
- **Mid-Day Off-Peak:** Relatively lower commuter demand.
- **Evening Peak:** Increased return-commute traffic.
- **Night Freight:** Potential changes in heavy-vehicle traffic.

Calendar-based adjustments can also be incorporated to account for holidays, weekends, and unusual demand patterns.

### 7. 🛡️ Safety-Gated Advisory Console
AURA-TM operates in `ADVISORY_ONLY` mode.

The platform generates decision-support recommendations without directly controlling physical traffic signals.

Potential advisories include:
- Monitor a corridor experiencing an unusual traffic surge.
- Investigate a possible congestion hotspot.
- Deploy traffic personnel near a merging bottleneck.
- Assess waterlogging on a capacity-constrained road.
- Consider emergency response dispatch when supporting evidence warrants escalation.

**Safety principle:** All advisories require appropriate human review. The system does not independently confirm emergencies or authorize physical traffic-control actions.

## 🏗️ System Architecture

The system follows a modular architecture:

1. **Traffic Data Input:** Collect vehicle counts, weather information, time context, and historical traffic observations.
2. **Vehicle Normalization:** Convert vehicle counts into PCU using configurable vehicle-class factors.
3. **Feature Analysis:** Evaluate traffic demand, weather effects, historical patterns, and time-based variations.
4. **Prediction Engine:** Estimate future traffic demand and congestion risk across multiple time horizons.
5. **Anomaly Detection:** Compare observed traffic against historical baselines using the CDI.
6. **Visualization Layer:** Render vehicle movement, weather effects, lane merging, and traffic conditions.
7. **Advisory Engine:** Generate prioritized recommendations for traffic management personnel.

### Workflow

```text
Vehicle Counts ───────┐
Weather Conditions ───┤
Time & Calendar ──────┼──> Data Processing
Historical Traffic ───┘          |
                                 v
                       PCU & Feature Analysis
                                 |
                                 v
                       Traffic Prediction Model
                                 |
                    ┌────────────┴────────────┐
                    v                         v
            Future Congestion          CDI Anomaly
               Forecast                 Detection
                    |                         |
                    └────────────┬────────────┘
                                 v
                      Traffic Visualization
                                 |
                                 v
                       Advisory Generation
                                 |
                                 v
                      Human Review & Action
```

## 🛠️ Technology Stack

| Component | Technology |
|---|---|
| Frontend | HTML5 |
| Styling | Vanilla CSS3 |
| Programming Language | JavaScript (ES Modules) |
| Visualization | HTML5 Canvas 2D API |
| Build Tool | Vite |
| Package Management | npm |
| Traffic Analysis | PCU normalization and statistical methods |
| Anomaly Detection | Z-score-based statistical analysis |

**Note:** A dedicated machine-learning framework or backend is not specified in the current stack. If a trained ML model or backend service is added, update this section to reflect the actual implementation.


## 📁 Project Structure

The following is a suggested structure. Adjust the filenames to match the actual repository.

```text
Smart-Traffic-Management/
├── public/
├── src/
│   ├── assets/
│   ├── components/
│   ├── styles/
│   ├── main.js
│   └── ...
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
├── .gitignore
└── README.md
```


## 🚀 Getting Started

### Prerequisites

Install the following software:

- Node.js v18.0.0 or higher.
- npm v9.0.0 or higher.
- Git.

### 1. Clone the Repository

```bash
git clone https://github.com/riyasachan94514/Smart-Traffic-Management.git
```

### 2. Navigate to the Project Directory

```bash
cd Smart-Traffic-Management
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Start the Development Server

```bash
npm run dev
```

### 5. Open the Application

Open the local URL printed in your terminal. With the default Vite configuration, this is usually:

```text
http://localhost:5173/
```

### 6. Build for Production

```bash
npm run build
```

Vite generates the production build in the `dist/` directory by default.



## 📊 Prediction Methodology

AURA-TM combines traffic demand analysis, road capacity estimation, and historical anomaly detection.

### Step 1: Traffic Demand Estimation

Vehicle counts are converted into Passenger Car Units:

**Total PCU = Σ (Vehicle Count × Vehicle-Class PCU Factor)**

The conversion factors should be configured for the vehicle categories and traffic conditions being studied.

### Step 2: Road Capacity Adjustment

The effective road capacity is adjusted according to rainfall and waterlogging conditions.

Conceptually:

**Effective Capacity = Base Road Capacity × Weather Adjustment Factor**

The adjustment factor represents the estimated proportion of road capacity remaining under current conditions. Its values must be calibrated using appropriate traffic and weather observations.

### Step 3: Congestion Risk Estimation

Traffic demand is compared with effective road capacity.

A simplified demand-to-capacity ratio is:

**Demand-to-Capacity Ratio = Traffic Demand / Effective Road Capacity**

A higher ratio indicates increased congestion risk. Actual congestion classification should also consider speed, occupancy, travel time, or other available traffic measurements.

### Step 4: Future Traffic Forecasting

The prediction engine estimates traffic conditions at T₀, T+15 minutes, T+30 minutes, and T+60 minutes.

Forecasts can incorporate:
- Current vehicle counts.
- Time-of-day patterns.
- Historical traffic observations.
- Weather-related capacity changes.
- Calendar-based demand adjustments.

### Step 5: Anomaly Detection

The CDI compares observed traffic conditions with historical observations for comparable time periods.

Unusual deviations trigger alerts for further investigation.

**Important:** Forecast accuracy depends on the quality and availability of the input data. Deterministic projections should not be described as trained machine-learning predictions unless an ML model has actually been trained and evaluated.


## 🌍 Real-World Applications

AURA-TM is designed to support smart-city mobility initiatives, including:

- Urban expressway traffic monitoring.
- Congestion forecasting.
- Traffic bottleneck identification.
- Weather-aware traffic planning.
- Emergency response prioritization.
- Traffic operations in Integrated Command and Control Centres (ICCC).
- Data-driven urban mobility planning.

## 🔮 Future Enhancements

Potential improvements include:

- **Machine Learning Integration:** Train models such as Random Forest, XGBoost, or LSTM on historical traffic data.
- **Live Traffic Data:** Integrate traffic sensors, CCTV-based vehicle counting, or supported traffic APIs.
- **Weather API Integration:** Retrieve current rainfall and weather observations.
- **Interactive Traffic Maps:** Add map-based corridor monitoring and congestion overlays.
- **Incident Detection:** Combine traffic anomalies with independent incident indicators.
- **Historical Analytics:** Display congestion trends, peak-hour comparisons, and daily traffic patterns.
- **Model Evaluation:** Measure MAE, RMSE, and other suitable forecasting metrics.
- **Backend Integration:** Introduce a backend and database to store traffic observations and prediction history.
- **Explainable Predictions:** Show which variables contribute most to estimated congestion risk.
- **Dashboard Export:** Generate reports for traffic operators and urban planners.

## 🔐 Safety & Limitations

- The system is designed for decision support rather than autonomous physical traffic control.
- Generated advisories should be reviewed by authorized personnel.
- Anomalies indicate unusual observations, not confirmed accidents or emergencies.
- Reliable forecasting requires representative historical data and validated model assumptions.
- Weather adjustments and vehicle-class conversion factors require suitable calibration.
- Live prediction capabilities depend on the availability of real-time data sources.


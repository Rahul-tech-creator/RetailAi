# Retail Spatial Intelligence Platform

> **"Google Analytics for physical retail spaces."**  
> Turn existing retail CCTV footage into actionable customer-flow intelligence, ground-truth analytics, and evidence-based layout recommendations.

---

## 🌟 Key Features

- **Genuine Computer Vision Pipeline:** Powered by Ultralytics YOLOv8 for person detection and ByteTrack for multi-object tracking.
- **Strictly Zero Fake Data:** 100% of metrics (visitor counts, dwell times, trajectories, heatmaps, bottlenecks, dead zones) originate directly from verified computer vision video processing. Display "Insufficient data" or "No people reliably detected" instead of fabricating numbers.
- **Canonical Single Source of Truth:** Unified analytics schema consumed by the dashboard, executive reports, charts, and Groq AI without discrepancy.
- **Floor Foot-Point Extraction:** Ground contact points calculated at bottom-center of bounding boxes (`x = (x1 + x2)/2, y = y2`).
- **Flexible Zone System:**
  - **Case A — Custom Polygon Zones:** Interactive canvas zone editor to draw custom store sections (e.g. Apparel, Electronics, Checkout, Entrance).
  - **Case B — Automatic Camera Regions:** Automatic division of the camera frame into `Region 1`, `Region 2`, `Region 3`, `Region 4` if no custom zones are provided, with customizable names.
- **Comprehensive 12-Metric Zone Intelligence:** For every zone: Unique Visitors, Total Visits, Average Dwell, Median Dwell, Maximum Dwell, Min Meaningful Dwell, Peak Occupancy, Average Occupancy, Traffic Share %, Relative Activity %, Entry Count, and Exit Count.
- **Flow Map Visualization:** Visual directed transition matrix capturing customer movement between zones with observed transition counts.
- **Track Inspector:** Interactive inspection of individual anonymous tracks (`Track #1`, `Track #2`...) showing duration, zones visited, foot-point coordinates, and image-space speed (`px/s`).
- **Time Range & Multi-Resolution Analysis:** Inspect traffic timelines across 1s, 5s, and 10s intervals and filter metrics across custom video intervals.
- **Video & Analytics Synchronization:** Interactive synchronized video playback with seekable timeline, speed control, and overlay toggles.
- **Evidence-Based Bottleneck & Dead-Zone Scoring:** Transparent 0–100 scores combining normalized occupancy, dwell, density, and relative activity with cited evidence and confidence ratings.
- **Professional PDF & Multi-Format Reporting:**
  - **Consulting-Grade Vector PDF Report:** 5-page PDF with executive cover page, KPI summary cards, embedded heatmap, 12-metric zone table, flow map, Groq interpretation, methodology, and limitations.
  - **Executive HTML Report:** Interactive printable web report.
  - **Markdown & JSON Exports.**
- **Before / After Layout Experiment Mode:** Side-by-side comparative architecture for evaluating layout changes (A/B testing).
- **"Code for Truth. AI for Interpretation.":** Groq (LLaMA 3.3 70B) receives only structured measurements to generate operational implications without hallucinating. Fallback engine operates deterministically if offline.
- **100% Privacy-Preserving:** Anonymous tracking IDs only. No facial recognition, biometric data, or PII.

---

## 🏗️ Technology Stack

| Tier | Technology | Purpose |
|------|------------|---------|
| **Frontend** | React 19, Vite, Vanilla CSS | Enterprise glassmorphism dashboard, zone canvas editor, video playback |
| **Backend** | Node.js, Express.js | API orchestration, file uploads, persistence, Groq LLM integration |
| **CV Engine** | Python 3.11, FastAPI, OpenCV, YOLOv8, ByteTrack | Person detection, tracking, footpoint extraction, heatmaps, numerical metrics |
| **AI / LLM** | Groq SDK (`llama-3.3-70b-versatile`) | Executive summary, findings, and evidence-based recommendations |
| **Storage** | Local JSON store (`analytics/db.json`) / MongoDB | Job persistence, video metadata, zones, and reports |

---

## 📁 Repository Structure

```
RetailProduct/
├── frontend/             # React + Vite Enterprise UI
│   ├── src/
│   │   ├── components/   # Navbar, VideoUpload, ZoneEditor, ProcessingView, Dashboard
│   │   ├── App.jsx       # App coordinator and state management
│   │   └── index.css     # Clean enterprise glassmorphism design tokens
├── backend/              # Node.js + Express API Orchestrator
│   ├── server.js         # REST endpoints for upload, analysis, streaming, exports
│   ├── groqService.js    # Groq integration with deterministic fallback engine
│   └── store.js          # Persistent JSON document store
├── cv-service/           # Python FastAPI Computer Vision Service
│   ├── main.py           # FastAPI service entrypoint
│   ├── detector.py       # YOLOv8 Person detector (COCO class 0)
│   ├── tracker.py        # ByteTrack multi-object tracking
│   ├── footpoint.py      # Bottom-center foot-point calculation
│   ├── zone_engine.py    # Custom polygon + automatic region segmentation
│   ├── dwell_engine.py   # Dwell time tracking with occlusion buffers
│   ├── traffic_engine.py # Instantaneous occupancy & traffic density
│   ├── trajectory_engine.py # Image-space speed & customer journeys
│   ├── heatmap_engine.py # 2D Gaussian density kernel & overlay rendering
│   ├── bottleneck_engine.py # Deterministic bottleneck scoring & evidence
│   ├── dead_zone_engine.py  # Deterministic dead-zone scoring & evidence
│   ├── video_annotator.py   # Video bounding box & track overlay writer
│   └── pipeline.py       # Master end-to-end pipeline coordinator
├── uploads/              # Uploaded CCTV video files
├── processed/            # Processed artifacts (heatmaps, frames, annotated videos)
├── analytics/            # Persistent analytics database (`db.json`)
├── tests/                # Automated test suite (`test_platform.js`)
├── docs/                 # Architectural specifications
└── .env.example          # Environment configuration template
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18+)
- **Python** (v3.10 to v3.12, 64-bit)

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Configure your environment variables:
```ini
PORT=5000
BACKEND_PORT=5000
CV_SERVICE_URL=http://localhost:8000

# Optional: Add your Groq API key (free at https://console.groq.com)
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile

# Video Defaults
DEFAULT_MAX_DIMENSION=960
DEFAULT_FRAME_SKIP=2
YOLO_MODEL=yolov8n.pt
```

*(Note: If `GROQ_API_KEY` is not provided, the platform automatically runs using its deterministic rule-based analysis engine).*

---

### 3. Running the Services

#### Step 1: Start the Computer Vision Service
```bash
cd cv-service
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```
*The CV service will be available at `http://localhost:8000`.*

#### Step 2: Start the Backend Orchestration Server
```bash
cd backend
npm install
node server.js
```
*The backend API will be available at `http://localhost:5000`.*

#### Step 3: Start the Frontend Application
```bash
cd frontend
npm install
npm run dev
```
*Open your browser at `http://localhost:5173`.*

---

## 🧪 Running the Automated Test Suites

The repository includes a 17-stage end-to-end integration test suite and an edge-case robustness test suite:

```bash
# 1. Complete End-to-End Integration Test Suite (17 Tests)
node tests/test_platform.js

# 2. Edge Case & Zero-Data Resilience Test Suite (5 Tests)
node tests/test_edge_cases.js
```

Both tests verify:
- Backend & Python CV service health connectivity
- Video metadata extraction and frame serving
- Case B (Auto regions) & Case A (Custom polygons) CV analysis
- Canonical single source of truth analytics schema validation
- Flow Map directed graph generation
- Heatmap PNG (regular, alpha overlay, density-only) and annotated MP4 video serving
- Consulting-grade Vector PDF report generation (`pdfkit`)
- Executive HTML and Markdown report exports
- A/B layout experiment endpoint comparison
- Secret redaction and zero API key exposure
- Zero-detection / empty footage graceful degradation without NaN or divide-by-zero crashes

---

## 🎬 Live Demonstration / Judge Workflow

1. Open `http://localhost:5173`.
2. Click **"Load Sample CCTV Video"** (or upload any store MP4/AVI/MOV video).
3. The platform extracts metadata (`768x432`, `12 FPS`, `596 frames`) and renders the representative video frame.
4. **Choose your zone mode:**
   - **Case A — Custom Polygon Zones:** Click on the frame to draw custom vertices for store sections (e.g., Apparel, Electronics, Checkout, Entrance).
   - **Case B — Automatic Camera Regions:** Automatically partitions the frame into `Region 1`, `Region 2`, `Region 3`, `Region 4` with full rename capability.
5. Configure performance options if needed (Frame Skip for CPU acceleration, Min Track Duration to filter momentary noise).
6. Click **"Start CV Analysis"**.
7. Watch the real-time stage progress tracker execute YOLOv8 detection, ByteTrack tracking, foot-point projection, dwell session timing, and heatmap generation.
8. Explore the **13 Specialized Dashboard Tabs**:
   - **Overview:** Executive KPIs, store health summary, tracking quality indicator.
   - **Traffic:** Aggregated time-series with selectable intervals (`1s`, `5s`, `10s`) and custom time window filtering (`0%–100%`, `First 25%`, `Middle 50%`, `Last 25%`).
   - **Heatmap:** Foot-point 2D Gaussian density kernel, transparent alpha overlay, density-only mode, and trajectory overlay toggle.
   - **Zones:** All 12 empirical zone metrics in a sortable matrix plus top rankings (Most Visited, Highest Dwell, Highest Activity).
   - **Customer Flow:** Visual directed flow graph illustrating transition frequencies between zones.
   - **Journeys:** Empirical multi-zone customer sequences with observed visitor counts.
   - **Bottlenecks:** Transparent 0–100 bottleneck scoring with individual normalized signals and evidence.
   - **Dead Zones:** Relative activity evaluation highlighting severely under-traversed store sections.
   - **Track Inspector:** Interactive individual track selector (`Track #1`, `Track #2`...) rendering exact footpaths, duration, zones visited, and image-space velocity.
   - **Video Sync:** Synchronized video player with playback speed controls, timeline jumping, and overlay toggles.
   - **AI Insights:** Structured Groq LLaMA 3.3 70B analysis (or deterministic fallback) with evidence-backed operational recommendations.
   - **Reports Hub:** Generate and download consulting-grade **PDF Reports**, standalone **HTML Reports**, or **Markdown/JSON** data.
   - **A/B Experiments:** Compare control vs new layout analytics side-by-side.

---

## 🔒 Privacy Approach

- Individual customers are identified solely via transient, numerical session identifiers (`Customer #1`, `Customer #2`).
- No facial recognition, biometric embeddings, facial landmarks, or demographics (age/gender) are computed.
- All tracking coordinates are anonymized and discarded after trajectory extraction.

---

## 🗺️ Roadmap

- [ ] Multi-camera re-identification (ReID appearance embeddings without PII).
- [ ] Top-down camera calibration to 2D store blueprints.
- [ ] Automated staff vs customer discrimination based on dwell trajectories.
- [ ] Real-time RTSP/HLS surveillance stream processing.

---

## 📄 License
MIT License.

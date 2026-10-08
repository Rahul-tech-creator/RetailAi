# Retail Spatial Intelligence Platform — Architecture & Methodology Specification

## 1. System Overview

**Retail Spatial Intelligence Platform** is an enterprise-grade computer-vision system designed as the physical equivalent of Google Analytics for retail stores. It transforms raw, uncalibrated CCTV footage into deterministic spatial metrics, foot-traffic analytics, and actionable layout recommendations.

### Core Architectural Principle
> **"CODE FOR TRUTH. AI FOR INTERPRETATION."**

- **Computer Vision & Deterministic Analytics Engine:** Computes all ground truth numbers, multi-person tracking trajectories, bottom-center foot coordinates, zone dwell times, peak occupancy, 2D density heatmaps, and bottleneck/dead-zone indicators.
- **Groq LLM Interpretation Engine:** Interprets the structured analytical facts into an executive summary, diagnoses customer flow dynamics, and generates prioritized, evidence-based merchandising and spatial recommendations.
- **Privacy Core:** Employs strictly anonymous tracking identifiers (`Customer #1`, `Customer #2`, etc.). Zero facial recognition, zero demographic profiling, zero PII storage.

---

## 2. Pipeline Sequence Diagram

```
[ User Video Upload (.mp4/.avi/.mov/.mkv) ]
                     │
                     ▼
       [ Express Orchestration API ]
                     │
         (Proxy & Background Task)
                     ▼
      [ FastAPI Computer Vision Service ]
                     │
    ┌────────────────┴────────────────┐
    ▼                                 ▼
[ Video Metadata Extraction ]   [ Frame Extraction (Representative) ]
    │                                 │
    ▼                                 ▼
[ YOLOv8 Person Detection ]     [ Spatial Zone Engine ]
(COCO Class 0, CPU Optimized)   ├── Case A: User-Drawn Polygons
    │                           └── Case B: Automatic Camera Regions
    ▼
[ ByteTrack Multi-Object Tracker ]
(Persistent Anonymous IDs)
    │
    ▼
[ Floor Foot-Point Calculation ]
(Bottom-center: x=(x1+x2)/2, y=y2)
    │
    ▼
[ Point-in-Polygon Zone Assignment ]
(Ray casting & cv2.pointPolygonTest)
    │
    ├────────────────────────┬───────────────────────┬──────────────────────┐
    ▼                        ▼                       ▼                      ▼
[ Dwell Time Engine ]  [ Traffic Engine ]     [ Heatmap Engine ]    [ Trajectory Engine ]
- Entry/Exit times     - Unique visitors      - 2D Gaussian Kernel  - Subsampled paths
- Occlusion tolerance  - Peak occupancy       - Turbo Colormap      - Image-space speed
- Zone-wise stats      - Timeline curve       - Density Alpha Blend - Journey mining
    │                        │                       │                      │
    └────────────────────────┴───────────────────────┴──────────────────────┘
                     │
                     ▼
   [ Deterministic Bottleneck & Dead-Zone Scoring ]
   - Bottlenecks: Occupancy + Dwell + Slowdown + Density
   - Dead Zones: Deficient traffic share + minimal dwell
                     │
                     ▼
     [ Video Annotator (MP4 Video Writer) ]
     (Renders bounding boxes, IDs, trails, and zones)
                     │
                     ▼
         [ Structured Analytics JSON ]
                     │
                     ▼
      [ Groq LLM / Deterministic Fallback ]
                     │
                     ▼
      [ Premium Glassmorphism React Dashboard ]
```

---

## 3. Computer Vision & Analytics Methodology

### 3.1 Floor Foot-Point Extraction
Bounding box centers do not correspond to physical floor location due to camera perspective tilt and foreshortening. The platform calculates the bottom-center coordinate of the bounding box:
$$\text{Foot Point} = \left(\frac{x_1 + x_2}{2}, y_2\right)$$
All spatial inclusion, heatmaps, and movement trajectories are calculated relative to this ground contact position.

### 3.2 Dual Zone System
- **Case A: User-Defined Custom Zones**: The user draws polygon regions of interest on a canvas over the representative frame, naming them (e.g., Apparel, Electronics, Checkout, Entrance).
- **Case B: Automatic Camera Regions**: If no custom zones are provided, the system deterministically divides the camera view into 4 balanced geometric sectors (`Region 1 (Upper Left)`, `Region 2 (Upper Right)`, `Region 3 (Lower Left)`, `Region 4 (Lower Right)`) and issues a notice:
  > *"No custom zones were provided. Analytics are being reported using automatically generated camera regions."*

### 3.3 Dwell Time & Occlusion Handling
Dwell sessions track entry and exit timestamps per zone per customer. To prevent transient occlusion or momentary detection drops from splitting a single dwell event into multiple fragments, an occlusion buffer tolerance ($t_{tol} = 0.6\text{s}$) is maintained before closing a dwell session.

### 3.4 Deterministic Bottleneck Scoring
$$\text{Score} = 0.35 \cdot S_{\text{occ}} + 0.30 \cdot S_{\text{dwell}} + 0.15 \cdot S_{\text{density}} + 0.20 \cdot S_{\text{slowdown}}$$
Where $S_{\text{slowdown}} = \max\left(0, \frac{\bar{v}_{\text{store}} - \bar{v}_{\text{zone}}}{\bar{v}_{\text{store}}}\right)$. Identified areas are labeled *"Potential Bottleneck"* with concrete evidence (e.g., peak occupancy, dwell vs baseline, speed slowdown).

### 3.5 Deterministic Dead-Zone Scoring
$$\text{Deficiency Score} = 0.45 \cdot D_{\text{traffic}} + 0.35 \cdot D_{\text{dwell}} + 0.20 \cdot D_{\text{occupancy}}$$
Identifies regions with persistently negligible customer traversal relative to the store baseline.

### 3.6 2D Kernel Density Heatmaps
Foot points are accumulated into a spatial density matrix, smoothed using a normalized 2D Gaussian kernel ($\sigma \approx 41$), mapped through OpenCV's false color colormap (`COLORMAP_TURBO`), and blended onto the representative background frame with configurable alpha transparency.

### 3.7 Flow Map Transition Graph
Between successive zone visits along any customer's trajectory, the platform records discrete zone-to-zone transitions $(Z_i \to Z_j)$. The resulting weighted directed graph yields transition counts and relative transition frequencies without interpolating or guessing connections:
$$\text{Weight}(Z_i \to Z_j) = \sum_{k \in \text{Tracks}} \mathbb{I}(\text{Transition}(k, Z_i, Z_j))$$

### 3.8 Individual Track Inspector
For every detected track surviving the minimum track duration threshold ($t \ge \text{MIN\_TRACK\_DURATION\_SECONDS}$), the engine computes:
- Bounding-box bottom-center foot coordinates subsampled across time
- Instantaneous image-space displacement velocity ($\text{px/s}$)
- Sequence of zones visited and zone dwell durations
This provides undeniable visual and mathematical proof that high-level aggregations derive 100% from actual trajectories.

---

## 4. Canonical Single Source of Truth Analytics Schema

The analytical pipeline outputs a canonical JSON schema that is strictly consumed without variation by the Dashboard, the PDF/HTML report generators, and the Groq interpretation prompt:

```typescript
interface CanonicalAnalysisResult {
  videoMetadata: {
    filename: string;
    duration: number;
    width: number;
    height: number;
    fps: number;
    frame_count: number;
  };
  processingStats: {
    frames_processed: number;
    total_detections: number;
    processing_time_sec: number;
    effective_processing_fps: number;
    frame_skip: number;
  };
  trackingQuality: {
    rating: 'Good' | 'Moderate' | 'Limited';
    explanation: string;
    total_tracks_evaluated: number;
    valid_persistent_tracks: number;
    filtered_flicker_tracks: number;
  };
  visitorStats: {
    unique_visitors: number;
    total_detections: number;
    valid_tracks: number;
    filtered_flicker_tracks: number;
  };
  zoneStats: Array<{
    zone_id: string;
    zone_name: string;
    zone_type: string;
    unique_visitors: number;
    total_visits: number;
    avg_dwell_sec: number;
    median_dwell_sec: number;
    max_dwell_sec: number;
    min_meaningful_dwell_sec: number;
    peak_occupancy: number;
    avg_occupancy: number;
    traffic_share_pct: number;
    relative_activity_pct: number;
    entry_count: number;
    exit_count: number;
  }>;
  trafficStats: {
    peak_occupancy: number;
    avg_occupancy: number;
    total_tracked_visitors: number;
    multi_resolution_timeline: {
      '1s': Array<{ timestamp_sec: number; active_tracks: number; new_entries: number }>;
      '5s': Array<{ timestamp_sec: number; active_tracks: number; new_entries: number }>;
      '10s': Array<{ timestamp_sec: number; active_tracks: number; new_entries: number }>;
    };
  };
  flow_map: {
    nodes: Array<{ id: string; label: string; visitors: number }>;
    links: Array<{ source: string; target: string; count: number; weight_pct: number }>;
  };
  journeyStats: {
    unique_journeys_observed: number;
    common_patterns: Array<{ pattern: string; count: number; percentage: number }>;
  };
  bottleneckResults: Array<{
    zone_id: string;
    zone_name: string;
    score: number;
    severity: 'Potential Bottleneck';
    confidence: 'Low' | 'Medium' | 'High';
    evidence: string[];
    signals: { occupancy: number; dwell: number; density: number; slowdown: number };
  }>;
  deadZoneResults: Array<{
    zone_id: string;
    zone_name: string;
    status: 'Potential Dead Zone';
    deficiency_score: number;
    activity_score: number;
    relative_activity_pct: number;
    confidence: 'Low' | 'Medium' | 'High';
    evidence: string[];
  }>;
  zoneRankings: {
    most_visited: Array<{ zone_name: string; count: number }>;
    highest_dwell: Array<{ zone_name: string; avg_dwell_sec: number }>;
    highest_activity: Array<{ zone_name: string; relative_activity_pct: number }>;
  };
  track_summaries: Array<{
    track_id: number;
    duration_sec: number;
    first_seen_sec: number;
    last_seen_sec: number;
    detections_count: number;
    zones_visited: string[];
    avg_image_speed_px_sec: number;
    path_points_count: number;
  }>;
  groq_analysis: {
    is_ai_generated: boolean;
    executive_summary: string;
    key_findings: string[];
    operational_implications: string[];
    suggested_experiments: Array<{ hypothesis: string; metric_to_track: string; method: string }>;
    strategic_recommendations: Array<{ area: string; recommendation: string; expected_impact: string; priority: string }>;
  };
  limitations: string[];
}
```

---

## 5. Executive PDF & Multi-Format Reporting Architecture

Instead of generating raw markdown, the platform employs **PDFKit** to generate a 5-page vector PDF report:
- **Page 1 — Executive Cover:** Modern card header, metadata badge, disclaimer, and 4 high-impact KPI summary cards.
- **Page 2 — Executive Summary & Operational Traffic:** Groq interpretation, findings, and traffic concurrency breakdown.
- **Page 3 — Heatmap & Comprehensive 12-Metric Zone Analysis:** Embedded high-resolution spatial heatmap and empirical metrics table.
- **Page 4 — Flow Map, Customer Journeys & Bottleneck Forensics:** Directed transition matrix, journey pathways, and transparent bottleneck scores.
- **Page 5 — Strategic Recommendations, Methodology & Limitations:** Prioritized actions, A/B layout experiments, CV methodology, and camera calibration limitations.

---

## 6. A/B Retail Layout Experiment Mode

The `/api/experiments/compare` endpoint accepts two analysis job IDs (`jobA` = baseline layout, `jobB` = experimental layout) and computes mathematical deltas:
$$\Delta \text{Visitors} = \text{Visitors}_B - \text{Visitors}_A$$
$$\Delta \text{Dwell} = \text{Dwell}_B - \text{Dwell}_A$$
$$\Delta \text{Bottlenecks} = \text{Bottlenecks}_B - \text{Bottlenecks}_A$$
Enables merchants to evaluate merchandising rearrangements empirically without asserting unverified POS conversion numbers.

---

## 7. Resilience & Fallback Guarantees

1. **No Fake Data Guarantee**: Zero placeholder numbers, random metrics, or fabricated visitor counts. If footage has no people, the system reports `0 visitors` and states limitations clearly.
2. **Groq AI Failure Resilience**: If the Groq API key is omitted, rate-limited, or unavailable, the backend automatically generates a comprehensive deterministic rule-based executive summary and recommendations based directly on the computer vision analytics, adding the disclaimer:
   > *"AI interpretation unavailable. Showing deterministic analytics based directly on verified computer vision facts."*
3. **Storage Resilience**: Persistence defaults to a local JSON document store in `analytics/db.json` with seamless optional MongoDB connectivity.


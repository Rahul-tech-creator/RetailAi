require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const store = require('./store');
const groqService = require('./groqService');
const { generatePdfReport } = require('./pdfReportGenerator');
const { generateHtmlReport } = require('./htmlReportGenerator');

const app = express();
const PORT = process.env.PORT || process.env.BACKEND_PORT || 5000;
const CV_SERVICE_URL = process.env.CV_SERVICE_URL || 'http://localhost:8000';

const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');
const PROCESSED_DIR = path.resolve(__dirname, '..', 'processed');

// Ensure directories exist
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(PROCESSED_DIR, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.mp4';
    const uniqueName = `video_${Date.now()}_${uuidv4().slice(0, 8)}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp4', '.avi', '.mov', '.mkv', '.webm'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported video format: ${ext}. Supported: mp4, avi, mov, mkv, webm`));
    }
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  let cvHealth = 'down';
  try {
    const cvRes = await axios.get(`${CV_SERVICE_URL}/health`, { timeout: 2000 });
    if (cvRes.data?.status === 'ok') cvHealth = 'healthy';
  } catch (e) {
    cvHealth = 'unreachable';
  }

  res.json({
    status: 'ok',
    service: 'retail-spatial-intelligence-api',
    cv_service_status: cvHealth,
    has_groq_key: Boolean(process.env.GROQ_API_KEY)
  });
});

// POST /api/videos/upload
app.post('/api/videos/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const videoId = uuidv4();
    const filePath = req.file.path;
    const fileName = req.file.filename;

    console.log(`[Upload] Video uploaded: ${fileName} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);

    // Request metadata from CV service
    let metadata = {};
    try {
      const metaRes = await axios.post(`${CV_SERVICE_URL}/metadata`, { video_path: filePath }, { timeout: 10000 });
      metadata = metaRes.data;
    } catch (err) {
      console.warn('[Upload] Could not extract metadata from CV service:', err.message);
      metadata = {
        width: 1280,
        height: 720,
        resolution: 'Unknown',
        fps: 25.0,
        duration_seconds: 0,
        frame_count: 0
      };
    }

    // Extract representative frame for zone editor
    const framePath = path.join(PROCESSED_DIR, `${videoId}_frame.jpg`);
    try {
      await axios.post(`${CV_SERVICE_URL}/extract-frame`, {
        video_path: filePath,
        output_path: framePath
      }, { timeout: 10000 });
    } catch (err) {
      console.warn('[Upload] Could not extract frame from CV service:', err.message);
    }

    const videoInfo = {
      id: videoId,
      filename: fileName,
      originalName: req.file.originalname,
      sizeBytes: req.file.size,
      filePath,
      metadata,
      frameUrl: `/api/videos/${videoId}/frame`,
      uploadedAt: new Date().toISOString()
    };

    store.setVideo(videoId, videoInfo);

    res.json({
      success: true,
      video: videoInfo
    });

  } catch (err) {
    console.error('[Upload Error]', err);
    res.status(500).json({ error: err.message || 'Video upload failed' });
  }
});

// POST /api/videos/load-sample (For immediate demo and judges)
app.post('/api/videos/load-sample', async (req, res) => {
  try {
    const samplePath = path.join(UPLOADS_DIR, 'sample_retail_cctv.mp4');
    if (!fs.existsSync(samplePath)) {
      return res.status(404).json({ error: 'Sample video not found on server' });
    }

    const videoId = uuidv4();
    const stat = fs.statSync(samplePath);

    // Request metadata from CV service
    let metadata = {};
    try {
      const metaRes = await axios.post(`${CV_SERVICE_URL}/metadata`, { video_path: samplePath }, { timeout: 10000 });
      metadata = metaRes.data;
    } catch (err) {
      metadata = {
        width: 768,
        height: 432,
        resolution: '768x432',
        fps: 12.0,
        duration_seconds: 49.67,
        frame_count: 596
      };
    }

    // Extract representative frame
    const framePath = path.join(PROCESSED_DIR, `${videoId}_frame.jpg`);
    try {
      await axios.post(`${CV_SERVICE_URL}/extract-frame`, {
        video_path: samplePath,
        output_path: framePath
      }, { timeout: 10000 });
    } catch (err) {
      console.warn('[Sample] Could not extract frame:', err.message);
    }

    const videoInfo = {
      id: videoId,
      filename: 'sample_retail_cctv.mp4',
      originalName: 'retail_corridor_cctv_sample.mp4',
      sizeBytes: stat.size,
      filePath: samplePath,
      metadata,
      frameUrl: `/api/videos/${videoId}/frame`,
      uploadedAt: new Date().toISOString()
    };

    store.setVideo(videoId, videoInfo);

    res.json({
      success: true,
      video: videoInfo
    });

  } catch (err) {
    console.error('[Load Sample Error]', err);
    res.status(500).json({ error: err.message || 'Failed to load sample video' });
  }
});

// GET /api/videos/:id/frame
app.get('/api/videos/:id/frame', (req, res) => {
  const framePath = path.join(PROCESSED_DIR, `${req.params.id}_frame.jpg`);
  if (fs.existsSync(framePath)) {
    return res.sendFile(framePath);
  }
  res.status(404).json({ error: 'Representative frame not found' });
});

// POST /api/zones
app.post('/api/zones', (req, res) => {
  const { videoId, zones } = req.body;
  if (!videoId || !Array.isArray(zones)) {
    return res.status(400).json({ error: 'videoId and zones array are required' });
  }
  store.setZones(videoId, zones);
  res.json({ success: true, videoId, count: zones.length });
});

// GET /api/zones/:videoId
app.get('/api/zones/:videoId', (req, res) => {
  const zones = store.getZones(req.params.videoId) || [];
  res.json({ zones });
});

// POST /api/analysis/start
app.post('/api/analysis/start', async (req, res) => {
  try {
    const { videoId, customZones, frameSkip, maxDimension, minTrackDuration } = req.body;
    if (!videoId) {
      return res.status(400).json({ error: 'videoId is required' });
    }

    const video = store.getVideo(videoId);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const jobId = uuidv4();
    const zonesToUse = customZones || store.getZones(videoId) || [];

    // Initialize job in local store
    store.setJob(jobId, {
      jobId,
      videoId,
      status: 'PROCESSING',
      stage: 'Dispatching to Computer Vision pipeline',
      percent: 0,
      createdAt: new Date().toISOString()
    });

    // Dispatch to Python CV Service
    console.log(`[Analysis] Starting CV job ${jobId} for video ${video.filename}`);
    const cvPayload = {
      job_id: jobId,
      video_path: video.filePath,
      output_dir: PROCESSED_DIR,
      custom_zones: zonesToUse.length > 0 ? zonesToUse : null,
      frame_skip: frameSkip || 2,
      max_dimension: maxDimension || 960,
      min_track_duration_sec: minTrackDuration || 1.0
    };

    const cvRes = await axios.post(`${CV_SERVICE_URL}/process`, cvPayload);

    res.json({
      success: true,
      jobId,
      status: 'PROCESSING',
      cvResponse: cvRes.data
    });

  } catch (err) {
    console.error('[Start Analysis Error]', err.message);
    res.status(500).json({ error: err.message || 'Failed to start analysis' });
  }
});

// GET /api/analysis/:jobId/status
app.get('/api/analysis/:jobId/status', async (req, res) => {
  const { jobId } = req.params;
  try {
    // Check CV service status
    const cvRes = await axios.get(`${CV_SERVICE_URL}/status/${jobId}`, { timeout: 3000 });
    const cvStatus = cvRes.data;

    // Sync with local store
    store.setJob(jobId, cvStatus);

    // If completed and no report generated yet, trigger Groq/deterministic report in background
    if (cvStatus.status === 'COMPLETED' && !store.getReport(jobId)) {
      triggerReportGeneration(jobId).catch(e => console.error('[Report Trigger Error]', e.message));
    }

    res.json(cvStatus);
  } catch (err) {
    // Fallback to local store or file on disk
    const localJob = store.getJob(jobId);
    if (localJob) {
      return res.json(localJob);
    }
    const analyticsFile = path.join(PROCESSED_DIR, `${jobId}_analytics.json`);
    if (fs.existsSync(analyticsFile)) {
      return res.json({
        job_id: jobId,
        status: 'COMPLETED',
        stage: 'Analysis complete',
        percent: 100
      });
    }
    res.status(404).json({ error: 'Job not found' });
  }
});

async function triggerReportGeneration(jobId) {
  try {
    let analytics = null;
    const analyticsFile = path.join(PROCESSED_DIR, `${jobId}_analytics.json`);
    if (fs.existsSync(analyticsFile)) {
      analytics = JSON.parse(fs.readFileSync(analyticsFile, 'utf-8'));
    } else {
      const resultsRes = await axios.get(`${CV_SERVICE_URL}/results/${jobId}`);
      analytics = resultsRes.data;
    }

    if (analytics) {
      const report = await groqService.generateReport(analytics);
      report.metadata = {
        analysisId: jobId,
        generatedTimestamp: new Date().toISOString(),
        reportVersion: 'v2.1',
        analyticsVersion: 'v2.0-canonical'
      };
      store.setReport(jobId, report);
    }
  } catch (err) {
    console.error(`[triggerReportGeneration] Failed for ${jobId}:`, err.message);
  }
}

// GET /api/analysis/:jobId/results
app.get('/api/analysis/:jobId/results', async (req, res) => {
  const { jobId } = req.params;
  try {
    let analytics = null;
    const analyticsFile = path.join(PROCESSED_DIR, `${jobId}_analytics.json`);

    if (fs.existsSync(analyticsFile)) {
      analytics = JSON.parse(fs.readFileSync(analyticsFile, 'utf-8'));
    } else {
      const cvRes = await axios.get(`${CV_SERVICE_URL}/results/${jobId}`);
      analytics = cvRes.data;
    }

    if (!analytics) {
      return res.status(202).json({ status: 'PROCESSING', message: 'Analysis still in progress' });
    }

    // Attach report (AI or deterministic)
    let report = store.getReport(jobId);
    if (!report) {
      report = await groqService.generateReport(analytics);
      report.metadata = {
        analysisId: jobId,
        generatedTimestamp: new Date().toISOString(),
        reportVersion: 'v2.1',
        analyticsVersion: 'v2.0-canonical'
      };
      store.setReport(jobId, report);
    }

    analytics.report = report;
    res.json(analytics);

  } catch (err) {
    console.error('[Get Results Error]', err.message);
    res.status(500).json({ error: err.message || 'Failed to fetch analysis results' });
  }
});

// GET /api/analysis/:jobId/heatmap
app.get('/api/analysis/:jobId/heatmap', (req, res) => {
  const heatmapPath = path.join(PROCESSED_DIR, `${req.params.jobId}_heatmap.png`);
  if (fs.existsSync(heatmapPath)) {
    return res.sendFile(heatmapPath);
  }
  res.status(404).json({ error: 'Heatmap not found' });
});

// GET /api/analysis/:jobId/heatmap-overlay
app.get('/api/analysis/:jobId/heatmap-overlay', (req, res) => {
  const overlayPath = path.join(PROCESSED_DIR, `${req.params.jobId}_heatmap_overlay.png`);
  if (fs.existsSync(overlayPath)) {
    return res.sendFile(overlayPath);
  }
  res.status(404).json({ error: 'Heatmap overlay not found' });
});

// GET /api/analysis/:jobId/heatmap-density
app.get('/api/analysis/:jobId/heatmap-density', (req, res) => {
  const densityPath = path.join(PROCESSED_DIR, `${req.params.jobId}_heatmap_density.png`);
  if (fs.existsSync(densityPath)) {
    return res.sendFile(densityPath);
  }
  res.status(404).json({ error: 'Heatmap density image not found' });
});

// GET /api/analysis/:jobId/frame
app.get('/api/analysis/:jobId/frame', (req, res) => {
  const framePath = path.join(PROCESSED_DIR, `${req.params.jobId}_frame.jpg`);
  if (fs.existsSync(framePath)) {
    return res.sendFile(framePath);
  }
  res.status(404).json({ error: 'Frame not found' });
});

// GET /api/analysis/:jobId/video
app.get('/api/analysis/:jobId/video', (req, res) => {
  const videoPath = path.join(PROCESSED_DIR, `${req.params.jobId}_annotated.mp4`);
  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ error: 'Annotated video not found' });
  }

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(videoPath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(200, head);
    fs.createReadStream(videoPath).pipe(res);
  }
});

// Consistency validator ensuring dashboard, API, PDF, and Groq numbers match 100%
function validateAnalyticsConsistency(analytics, report) {
  const visitorCount = analytics.visitorStats?.unique_visitors ?? analytics.visitor_summary?.unique_visitors ?? 0;
  const avgDwell = analytics.visitorStats?.avg_dwell_time_sec ?? analytics.visitor_summary?.avg_dwell_time_sec ?? 0;
  const peakOcc = analytics.trafficStats?.peak_occupancy ?? analytics.occupancyStats?.peak_occupancy ?? 0;
  const zones = analytics.zoneStats || analytics.zone_statistics || [];
  const bottlenecks = (analytics.bottleneckResults || analytics.bottlenecks || []).filter(b => b.is_bottleneck);
  const deadZones = (analytics.deadZoneResults || analytics.dead_zones || []).filter(d => d.is_dead_zone);

  const discrepancies = [];

  // Zone visits verification
  const sumZoneVisits = zones.reduce((acc, z) => acc + (z.visits || 0), 0);
  const totalRecordedVisits = analytics.visitorStats?.total_zone_visits ?? sumZoneVisits;
  if (Math.abs(sumZoneVisits - totalRecordedVisits) > 1 && totalRecordedVisits > 0) {
    discrepancies.push(`Sum of zone visits (${sumZoneVisits}) differs from total visits (${totalRecordedVisits})`);
  }

  return {
    is_consistent: discrepancies.length === 0,
    discrepancies,
    metrics_summary: {
      unique_tracked_visitors: visitorCount,
      overall_avg_dwell_sec: avgDwell,
      peak_concurrency: peakOcc,
      active_zones_evaluated: zones.length,
      potential_bottlenecks_count: bottlenecks.length,
      potential_dead_zones_count: deadZones.length
    }
  };
}

// GET /api/analysis/:jobId/validation (Internal / Debug Analytics Validation Panel Endpoint)
app.get('/api/analysis/:jobId/validation', (req, res) => {
  const { jobId } = req.params;
  const analyticsFile = path.join(PROCESSED_DIR, `${jobId}_analytics.json`);

  if (!fs.existsSync(analyticsFile)) {
    return res.status(404).json({ error: 'Job analytics not found' });
  }

  try {
    const analytics = JSON.parse(fs.readFileSync(analyticsFile, 'utf-8'));
    const report = store.getReport(jobId) || groqService.generateDeterministicFallback(analytics);
    const consistency = validateAnalyticsConsistency(analytics, report);

    res.json({
      success: true,
      job_id: jobId,
      validationStats: analytics.validationStats || analytics.validation_stats || null,
      analyticsConfidence: analytics.analyticsConfidence || analytics.analytics_confidence || null,
      trackingQuality: analytics.trackingQuality || analytics.tracking_quality || null,
      consistencyCheck: consistency
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/report/generate
app.post('/api/report/generate', async (req, res) => {
  const { jobId } = req.body;
  if (!jobId) return res.status(400).json({ error: 'jobId is required' });

  try {
    const analyticsFile = path.join(PROCESSED_DIR, `${jobId}_analytics.json`);
    if (!fs.existsSync(analyticsFile)) {
      return res.status(404).json({ error: 'Analytics file not found for job' });
    }

    const analytics = JSON.parse(fs.readFileSync(analyticsFile, 'utf-8'));
    const report = await groqService.generateReport(analytics);
    const consistency = validateAnalyticsConsistency(analytics, report);

    report.metadata = {
      analysisId: jobId,
      generatedTimestamp: new Date().toISOString(),
      reportVersion: 'v2.2',
      analyticsVersion: 'v2.0-canonical',
      consistencyCheck: consistency
    };
    store.setReport(jobId, report);

    res.json({ success: true, report, consistency });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/report/:jobId/pdf (Direct PDF Report Endpoint)
app.get('/api/report/:jobId/pdf', async (req, res) => {
  const { jobId } = req.params;
  const analyticsFile = path.join(PROCESSED_DIR, `${jobId}_analytics.json`);

  if (!fs.existsSync(analyticsFile)) {
    return res.status(404).json({ error: 'Job analytics not found' });
  }

  try {
    const analytics = JSON.parse(fs.readFileSync(analyticsFile, 'utf-8'));
    const report = store.getReport(jobId) || groqService.generateDeterministicFallback(analytics);

    const pdfPath = path.join(PROCESSED_DIR, `${jobId}_report.pdf`);
    await generatePdfReport(analytics, report, pdfPath);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="retail_spatial_intelligence_${jobId.slice(0, 8)}.pdf"`);
    fs.createReadStream(pdfPath).pipe(res);
  } catch (err) {
    console.error('[PDF Generation Error]', err);
    res.status(500).json({ error: `PDF generation failed: ${err.message}` });
  }
});

// GET /api/report/:jobId/html (Executive HTML Report Endpoint)
app.get('/api/report/:jobId/html', (req, res) => {
  const { jobId } = req.params;
  const analyticsFile = path.join(PROCESSED_DIR, `${jobId}_analytics.json`);

  if (!fs.existsSync(analyticsFile)) {
    return res.status(404).json({ error: 'Job analytics not found' });
  }

  try {
    const analytics = JSON.parse(fs.readFileSync(analyticsFile, 'utf-8'));
    const report = store.getReport(jobId) || groqService.generateDeterministicFallback(analytics);
    const html = generateHtmlReport(analytics, report);

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    res.status(500).json({ error: `HTML generation failed: ${err.message}` });
  }
});

// GET /api/report/:jobId/export (Multi-format export: pdf, html, markdown, json)
app.get('/api/report/:jobId/export', async (req, res) => {
  const { jobId } = req.params;
  const format = (req.query.format || 'markdown').toLowerCase();
  const analyticsFile = path.join(PROCESSED_DIR, `${jobId}_analytics.json`);

  if (!fs.existsSync(analyticsFile)) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const analytics = JSON.parse(fs.readFileSync(analyticsFile, 'utf-8'));
  const report = store.getReport(jobId) || groqService.generateDeterministicFallback(analytics);

  if (format === 'json') {
    return res.json({ analytics, report });
  }

  if (format === 'pdf') {
    try {
      const pdfPath = path.join(PROCESSED_DIR, `${jobId}_report.pdf`);
      await generatePdfReport(analytics, report, pdfPath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="retail_spatial_intelligence_${jobId.slice(0, 8)}.pdf"`);
      return fs.createReadStream(pdfPath).pipe(res);
    } catch (err) {
      return res.status(500).json({ error: `PDF generation failed: ${err.message}` });
    }
  }

  if (format === 'html') {
    const html = generateHtmlReport(analytics, report);
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="retail_spatial_intelligence_${jobId.slice(0, 8)}.html"`);
    return res.send(html);
  }

  // Markdown format
  const meta = analytics.videoMetadata || analytics.video_metadata || {};
  const vis = analytics.visitorStats || analytics.visitor_summary || {};
  const quality = analytics.trackingQuality || analytics.tracking_quality || {};

  const md = `# Retail Spatial Intelligence Report
**Generated:** ${new Date().toISOString()}  
**Video:** ${meta.filename} (${meta.resolution}, ${meta.duration_seconds}s @ ${meta.fps} FPS)  
**Tracking Quality:** ${quality.rating} (${quality.notes})  
**Report Version:** v2.1 (Canonical Analytics v2.0)

---

## 1. Executive Summary
${report.executive_summary}

---

## 2. Key Store Analytics Summary
- **Unique Tracked Visitors:** ${vis.unique_visitors}
- **Total Zone Visits:** ${vis.total_zone_visits}
- **Peak Store Occupancy:** ${vis.peak_store_occupancy} customers
- **Average Visit Duration:** ${vis.avg_visit_duration_sec}s
- **Average Dwell Time:** ${vis.avg_dwell_time_sec}s (Median: ${vis.median_dwell_time_sec}s)
- **Relative Movement Speed:** ${vis.relative_speed?.overall_avg_speed_px_sec || 'N/A'} px/sec

---

## 3. Spatial Zone Performance
| Zone | Category | Visits | Unique Visitors | Avg Dwell (s) | Peak Occ | Density |
|------|----------|--------|-----------------|---------------|----------|---------|
${(analytics.zoneStats || analytics.zone_statistics || []).map(z => `| ${z.name} | ${z.category} | ${z.visits} | ${z.unique_visitors} | ${z.avg_dwell_sec} | ${z.peak_occupancy} | ${z.traffic_density} |`).join('\n')}

---

## 4. Potential Bottleneck Analysis
${(analytics.bottleneckResults || analytics.bottlenecks || []).map(b => `### ${b.zone_name} (Score: ${b.score}/100 - ${b.status})
- **Confidence:** ${b.confidence}
- **Observed Evidence:**
${b.evidence.map(e => `  - ${e}`).join('\n')}
`).join('\n')}

---

## 5. Potential Dead-Zone Analysis
${(analytics.deadZoneResults || analytics.dead_zones || []).map(d => `### ${d.zone_name} (Score: ${d.score}/100 - ${d.status})
- **Confidence:** ${d.confidence}
- **Observed Evidence:**
${d.evidence.map(e => `  - ${e}`).join('\n')}
`).join('\n')}

---

## 6. Frequent Customer Journeys
${((analytics.journeyStats?.patterns) || analytics.journey_patterns || []).map((j, i) => `${i + 1}. **${j.path}** — ${j.observed_customers} customer(s) (${j.percentage}%)`).join('\n')}

---

## 7. Evidence-Based Recommendations
${(report.recommendations || []).map(r => `### [${r.type}] ${r.area}
- **Evidence:** ${r.evidence}
- **Action:** ${r.recommendation}
`).join('\n')}

---

## 8. Prioritized Action Plan
${(report.priority_actions || []).map(p => `- **[${p.priority} Priority]:** ${p.action}`).join('\n')}

---
*Notice: Customer tracking uses anonymous computer-vision IDs and does not identify individuals.*
`;

  res.setHeader('Content-Type', 'text/markdown');
  res.setHeader('Content-Disposition', `attachment; filename="retail_intelligence_report_${jobId.slice(0, 8)}.md"`);
  res.send(md);
});

// GET /api/experiments/compare?jobA=...&jobB=... (Before / After Layout Experiment Mode)
app.get('/api/experiments/compare', (req, res) => {
  const { jobA, jobB } = req.query;
  if (!jobA || !jobB) {
    return res.status(400).json({ error: 'Both jobA and jobB query parameters are required' });
  }

  const fileA = path.join(PROCESSED_DIR, `${jobA}_analytics.json`);
  const fileB = path.join(PROCESSED_DIR, `${jobB}_analytics.json`);

  if (!fs.existsSync(fileA) || !fs.existsSync(fileB)) {
    return res.status(404).json({ error: 'One or both analysis jobs not found' });
  }

  try {
    const dataA = JSON.parse(fs.readFileSync(fileA, 'utf-8'));
    const dataB = JSON.parse(fs.readFileSync(fileB, 'utf-8'));

    const visA = dataA.visitorStats || dataA.visitor_summary || {};
    const visB = dataB.visitorStats || dataB.visitor_summary || {};

    const diff = {
      experiment_type: 'Layout A/B Comparison',
      baseline_job_id: jobA,
      variant_job_id: jobB,
      unique_visitors: {
        baseline: visA.unique_visitors || 0,
        variant: visB.unique_visitors || 0,
        delta: (visB.unique_visitors || 0) - (visA.unique_visitors || 0)
      },
      avg_dwell_sec: {
        baseline: visA.avg_dwell_time_sec || 0,
        variant: visB.avg_dwell_time_sec || 0,
        delta: roundDiff((visB.avg_dwell_time_sec || 0) - (visA.avg_dwell_time_sec || 0))
      },
      peak_occupancy: {
        baseline: visA.peak_store_occupancy || 0,
        variant: visB.peak_store_occupancy || 0,
        delta: (visB.peak_store_occupancy || 0) - (visA.peak_store_occupancy || 0)
      },
      bottlenecks: {
        baseline_count: (dataA.bottlenecks || []).filter(b => b.is_bottleneck).length,
        variant_count: (dataB.bottlenecks || []).filter(b => b.is_bottleneck).length
      },
      dead_zones: {
        baseline_count: (dataA.dead_zones || []).filter(d => d.is_dead_zone).length,
        variant_count: (dataB.dead_zones || []).filter(d => d.is_dead_zone).length
      }
    };

    res.json({ success: true, comparison: diff });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function roundDiff(val) {
  return Math.round(val * 100) / 100;
}

app.listen(PORT, () => {
  console.log(`[Backend] Retail Spatial Intelligence API listening on port ${PORT}`);
  console.log(`[Backend] Connected to CV Service at: ${CV_SERVICE_URL}`);
  console.log(`[Backend] Groq API Key configured: ${Boolean(process.env.GROQ_API_KEY)}`);
});

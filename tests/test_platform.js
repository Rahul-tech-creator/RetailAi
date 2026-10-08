/**
 * Comprehensive Automated End-to-End Test Suite for
 * Retail Spatial Intelligence Platform — Functionality & Accuracy Verification.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const BACKEND_URL = 'http://127.0.0.1:5000';
const CV_URL = 'http://127.0.0.1:8000';

async function runTests() {
  console.log('====================================================');
  console.log('STARTING RETAIL SPATIAL INTELLIGENCE PLATFORM TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    process.stdout.write(`TEST ${total}: ${name}... `);
    try {
      await fn();
      console.log('PASSED ✓');
      passed++;
    } catch (err) {
      console.log(`FAILED ✗\n  Error: ${err.message}`);
    }
  }

  // 1. Health checks
  await test('Backend API Health & CV connection', async () => {
    const res = await fetch(`${BACKEND_URL}/api/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'ok');
    assert.strictEqual(data.cv_service_status, 'healthy');
  });

  await test('CV Service Health endpoint', async () => {
    const res = await fetch(`${CV_URL}/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'ok');
  });

  // 2. Load Sample Video
  let sampleVideo = null;
  await test('Video Setup & Metadata Extraction', async () => {
    const res = await fetch(`${BACKEND_URL}/api/videos/load-sample`, { method: 'POST' });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.video.id);
    assert.ok(data.video.metadata.duration_seconds > 0);
    assert.ok(data.video.metadata.fps > 0);
    sampleVideo = data.video;
  });

  await test('Representative Video Frame Serving', async () => {
    const res = await fetch(`${BACKEND_URL}/api/videos/${sampleVideo.id}/frame`);
    assert.strictEqual(res.status, 200);
    const contentType = res.headers.get('content-type');
    assert.ok(contentType.includes('image'));
  });

  // 3. CASE B: Automatic Region Generation Mode (No Custom Zones)
  let autoJobId = null;
  await test('Case B Analysis: Dispatch with NO custom zones (Auto Regions)', async () => {
    const res = await fetch(`${BACKEND_URL}/api/analysis/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId: sampleVideo.id,
        customZones: null,
        frameSkip: 2,
        minTrackDuration: 1.0
      })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.jobId);
    autoJobId = data.jobId;
  });

  await test('Case B: Poll CV Processing until completion', async () => {
    let completed = false;
    let attempts = 0;
    while (!completed && attempts < 60) {
      attempts++;
      await new Promise(r => setTimeout(r, 1200));
      const res = await fetch(`${BACKEND_URL}/api/analysis/${autoJobId}/status`);
      const data = await res.json();
      if (data.status === 'COMPLETED') {
        completed = true;
      } else if (data.status === 'FAILED') {
        throw new Error(`Job failed: ${data.error}`);
      }
    }
    assert.strictEqual(completed, true, 'Job did not complete within timeout');
  });

  let autoResults = null;
  await test('Case B: Verify Canonical Single Source of Truth Analytics Structure', async () => {
    const res = await fetch(`${BACKEND_URL}/api/analysis/${autoJobId}/results`);
    assert.strictEqual(res.status, 200);
    autoResults = await res.json();

    // Verify Canonical Keys
    assert.ok(autoResults.videoMetadata || autoResults.video_metadata, 'Missing videoMetadata');
    assert.ok(autoResults.trackingQuality || autoResults.tracking_quality, 'Missing trackingQuality');
    assert.ok(autoResults.visitorStats || autoResults.visitor_summary, 'Missing visitorStats');
    assert.ok(autoResults.zoneStats || autoResults.zone_statistics, 'Missing zoneStats');
    assert.ok(autoResults.bottleneckResults || autoResults.bottlenecks, 'Missing bottleneckResults');
    assert.ok(autoResults.deadZoneResults || autoResults.dead_zones, 'Missing deadZoneResults');
    assert.ok(autoResults.highActivityResults || autoResults.high_activity_areas, 'Missing highActivityResults');
    assert.ok(autoResults.flow_map || autoResults.journeyStats?.flow_map, 'Missing flow_map');
    assert.ok(autoResults.zoneRankings || autoResults.zone_rankings, 'Missing zoneRankings');
    assert.ok(autoResults.analyticsConfidence || autoResults.analytics_confidence, 'Missing analyticsConfidence');

    // Automatic Regions
    assert.strictEqual(autoResults.zone_system.source, 'automatic');
    assert.ok(autoResults.zone_system.notice.includes('No custom zones were provided'));
    const zStats = autoResults.zoneStats || autoResults.zone_statistics;
    assert.strictEqual(zStats.length, 4);

    // Verify all 12 zone metrics exist on each zone
    zStats.forEach((z) => {
      assert.ok('visits' in z, `Missing visits in zone ${z.name}`);
      assert.ok('unique_visitors' in z, `Missing unique_visitors in zone ${z.name}`);
      assert.ok('entry_count' in z, `Missing entry_count in zone ${z.name}`);
      assert.ok('exit_count' in z, `Missing exit_count in zone ${z.name}`);
      assert.ok('avg_dwell_sec' in z, `Missing avg_dwell_sec in zone ${z.name}`);
      assert.ok('median_dwell_sec' in z, `Missing median_dwell_sec in zone ${z.name}`);
      assert.ok('max_dwell_sec' in z, `Missing max_dwell_sec in zone ${z.name}`);
      assert.ok('min_meaningful_dwell_sec' in z, `Missing min_meaningful_dwell_sec in zone ${z.name}`);
      assert.ok('peak_occupancy' in z, `Missing peak_occupancy in zone ${z.name}`);
      assert.ok('avg_occupancy' in z, `Missing avg_occupancy in zone ${z.name}`);
      assert.ok('traffic_share_pct' in z, `Missing traffic_share_pct in zone ${z.name}`);
      assert.ok('traffic_density' in z, `Missing traffic_density in zone ${z.name}`);
    });

    // Valid unique customer tracks
    const vis = autoResults.visitorStats || autoResults.visitor_summary;
    assert.ok(vis.unique_visitors > 0, 'Unique visitors must be > 0');
    assert.ok(vis.peak_store_occupancy > 0, 'Peak occupancy must be > 0');

    // Anonymous tracking IDs
    assert.ok(autoResults.tracks.length > 0);
    assert.ok(autoResults.tracks[0].anonymous_id.startsWith('Customer #'));
  });

  await test('Verify Flow Map and Zone Transitions', async () => {
    const flowMap = autoResults.flow_map || autoResults.journeyStats?.flow_map;
    assert.ok(flowMap, 'Flow map must exist');
    assert.ok(Array.isArray(flowMap.nodes));
    assert.ok(Array.isArray(flowMap.links));
  });

  await test('Artifact Serving: Heatmap PNG and Annotated Video MP4', async () => {
    const hmRes = await fetch(`${BACKEND_URL}/api/analysis/${autoJobId}/heatmap`);
    assert.strictEqual(hmRes.status, 200);

    const vidRes = await fetch(`${BACKEND_URL}/api/analysis/${autoJobId}/video`);
    assert.strictEqual(vidRes.status, 200);
  });

  await test('Professional PDF Report Generation Endpoint', async () => {
    const res = await fetch(`${BACKEND_URL}/api/report/${autoJobId}/pdf`);
    assert.strictEqual(res.status, 200);
    const contentType = res.headers.get('content-type');
    assert.ok(contentType.includes('application/pdf'), `Expected PDF content type, got ${contentType}`);
    const buf = await res.arrayBuffer();
    assert.ok(buf.byteLength > 20000, `PDF must be non-empty valid binary, got ${buf.byteLength} bytes`);
  });

  await test('Executive HTML Report Generation Endpoint', async () => {
    const res = await fetch(`${BACKEND_URL}/api/report/${autoJobId}/html`);
    assert.strictEqual(res.status, 200);
    const contentType = res.headers.get('content-type');
    assert.ok(contentType.includes('text/html'), `Expected HTML content type, got ${contentType}`);
    const html = await res.text();
    assert.ok(html.includes('Retail Spatial Intelligence Report'));
    assert.ok(html.includes('Executive Summary'));
    assert.ok(html.includes('Spatial Zone Performance Table'));
  });

  await test('Markdown Export Format', async () => {
    const res = await fetch(`${BACKEND_URL}/api/report/${autoJobId}/export?format=markdown`);
    assert.strictEqual(res.status, 200);
    const md = await res.text();
    assert.ok(md.includes('# Retail Spatial Intelligence Report'));
    assert.ok(md.includes('Executive Summary'));
  });

  // 4. CASE A: Custom Polygon Zone Mode
  let customJobId = null;
  await test('Case A Analysis: User-Defined Custom Polygon Zones', async () => {
    const customZones = [
      {
        id: 'zone_north_corridor',
        name: 'North Corridor Entrance',
        category: 'Entrance',
        color: '#10B981',
        polygon: [[50, 50], [400, 50], [400, 250], [50, 250]]
      },
      {
        id: 'zone_south_display',
        name: 'South Merchandising Display',
        category: 'Promotional Area',
        color: '#3B82F6',
        polygon: [[420, 150], [720, 150], [720, 400], [420, 400]]
      }
    ];

    const res = await fetch(`${BACKEND_URL}/api/analysis/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId: sampleVideo.id,
        customZones,
        frameSkip: 2,
        minTrackDuration: 1.0
      })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.jobId);
    customJobId = data.jobId;
  });

  await test('Case A: Wait for Custom Zone Analysis to Complete', async () => {
    let completed = false;
    let attempts = 0;
    while (!completed && attempts < 60) {
      attempts++;
      await new Promise(r => setTimeout(r, 1200));
      const res = await fetch(`${BACKEND_URL}/api/analysis/${customJobId}/status`);
      const data = await res.json();
      if (data.status === 'COMPLETED') completed = true;
    }
    assert.strictEqual(completed, true);
  });

  await test('Case A: Verify Custom Zone Assignment and Analytics', async () => {
    const res = await fetch(`${BACKEND_URL}/api/analysis/${customJobId}/results`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();

    assert.strictEqual(data.zone_system.source, 'user');
    const zStats = data.zoneStats || data.zone_statistics;
    assert.strictEqual(zStats.length, 2);
    assert.strictEqual(zStats[0].name, 'North Corridor Entrance');
    assert.strictEqual(zStats[1].name, 'South Merchandising Display');
  });

  await test('A/B Retail Layout Experiment Comparison Endpoint', async () => {
    const res = await fetch(`${BACKEND_URL}/api/experiments/compare?jobA=${autoJobId}&jobB=${customJobId}`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.comparison.experiment_type, 'Layout A/B Comparison');
    assert.ok('unique_visitors' in data.comparison);
    assert.ok('avg_dwell_sec' in data.comparison);
  });

  // 5. Security & Privacy checks
  await test('Security: Ensure No Secrets or API Keys Exposed to Frontend', async () => {
    const res = await fetch(`${BACKEND_URL}/api/health`);
    const text = await res.text();
    assert.strictEqual(text.includes('gsk_'), false, 'Groq API keys must never be exposed');
  });

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passed}/${total} PASSED`);
  console.log('====================================================');

  if (passed === total) {
    console.log('ALL TESTS PASSED! System is fully verified.');
    process.exit(0);
  } else {
    console.error('Some tests failed.');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});

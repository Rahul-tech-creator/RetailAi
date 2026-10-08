/**
 * Executive HTML Report Generator for Retail Spatial Intelligence Platform.
 * Generates an executive, print-ready, self-contained HTML report with CSS styling,
 * metrics tables, flow maps, and recommendations.
 */
function generateHtmlReport(analytics, report) {
  const meta = analytics.videoMetadata || analytics.video_metadata || {};
  const visitor = analytics.visitorStats || analytics.visitor_summary || {};
  const quality = analytics.trackingQuality || analytics.tracking_quality || {};
  const zones = analytics.zoneStats || analytics.zone_statistics || [];
  const bottlenecks = analytics.bottleneckResults || analytics.bottlenecks || [];
  const deadZones = analytics.deadZoneResults || analytics.dead_zones || [];
  const highActivity = analytics.highActivityResults || analytics.high_activity_areas || [];
  const journeys = (analytics.journeyStats?.patterns) || analytics.journey_patterns || [];
  const flowMap = (analytics.journeyStats?.flow_map) || analytics.flow_map || { links: [] };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Retail Spatial Intelligence Report — ${meta.filename || 'Analysis'}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    :root {
      --primary: #0F172A;
      --emerald: #059669;
      --emerald-light: #ECFDF5;
      --text-main: #1E293B;
      --text-muted: #64748B;
      --bg: #F8FAFC;
      --card-bg: #FFFFFF;
      --border: #E2E8F0;
      --rose: #E11D48;
      --amber: #D97706;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--text-main);
      line-height: 1.5;
      padding: 40px 20px;
    }
    .report-container {
      max-width: 900px;
      margin: 0 auto;
      background: var(--card-bg);
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
      border: 1px solid var(--border);
      overflow: hidden;
    }
    .header-banner {
      background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
      color: #FFFFFF;
      padding: 36px 40px;
      border-bottom: 4px solid var(--emerald);
    }
    .header-banner h1 { font-size: 26px; font-weight: 800; margin-bottom: 6px; letter-spacing: -0.5px; }
    .header-banner p { font-size: 14px; color: #94A3B8; }
    .content-body { padding: 40px; }
    .section-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--primary);
      margin-bottom: 14px;
      margin-top: 32px;
      padding-bottom: 8px;
      border-bottom: 2px solid var(--emerald-light);
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .section-title:first-of-type { margin-top: 0; }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 28px;
    }
    .kpi-card {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
    }
    .kpi-label { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
    .kpi-val { font-size: 26px; font-weight: 800; color: var(--emerald); margin: 4px 0; }
    .kpi-sub { font-size: 11px; color: var(--text-muted); }
    .exec-summary {
      background: var(--emerald-light);
      border-left: 4px solid var(--emerald);
      padding: 20px;
      border-radius: 0 8px 8px 0;
      margin-bottom: 28px;
    }
    .exec-summary h3 { font-size: 15px; font-weight: 700; color: var(--emerald); margin-bottom: 8px; }
    .exec-summary p { font-size: 13.5px; color: var(--text-main); line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
    th { background: #0F172A; color: #FFFFFF; font-weight: 700; text-align: right; padding: 10px 12px; }
    th:first-child { text-align: left; }
    td { padding: 9px 12px; border-bottom: 1px solid var(--border); text-align: right; }
    td:first-child { text-align: left; font-weight: 600; }
    tr:nth-child(even) td { background: #F8FAFC; }
    .card-list { display: flex; flex-direction: column; gap: 12px; margin-top: 12px; }
    .item-card {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px 18px;
    }
    .item-card.bottleneck { border-left: 4px solid var(--rose); }
    .item-card.deadzone { border-left: 4px solid var(--amber); }
    .item-card.recommendation { border-left: 4px solid var(--emerald); }
    .item-header { display: flex; justify-content: space-between; font-weight: 700; font-size: 13px; margin-bottom: 4px; }
    .item-body { font-size: 12px; color: var(--text-muted); }
    .footer {
      text-align: center;
      padding: 24px;
      font-size: 11px;
      color: var(--text-muted);
      border-top: 1px solid var(--border);
      background: var(--bg);
    }
    @media print {
      body { background: #FFFFFF; padding: 0; }
      .report-container { box-shadow: none; border: none; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="header-banner">
      <h1>Retail Spatial Intelligence Report</h1>
      <p>CCTV Video: ${meta.filename || 'Source'} &bull; ${meta.duration_seconds || 0}s &bull; ${meta.fps || 0} FPS &bull; ${new Date().toLocaleDateString()}</p>
    </div>

    <div class="content-body">
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Unique Visitors</div>
          <div class="kpi-val">${visitor.unique_visitors ?? 0}</div>
          <div class="kpi-sub">Valid customer tracks</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Avg Zone Dwell</div>
          <div class="kpi-val">${visitor.avg_dwell_time_sec ?? 0}s</div>
          <div class="kpi-sub">Median: ${visitor.median_dwell_time_sec ?? 0}s</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Peak Occupancy</div>
          <div class="kpi-val">${visitor.peak_store_occupancy ?? 0}</div>
          <div class="kpi-sub">Concurrent shoppers</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Tracking Quality</div>
          <div class="kpi-val" style="font-size: 19px; line-height: 35px;">${quality.rating || 'Good'}</div>
          <div class="kpi-sub">${quality.avg_track_duration_sec || 0}s avg duration</div>
        </div>
      </div>

      <div class="exec-summary">
        <h3>Executive Summary</h3>
        <p>${report.executive_summary || 'Executive summary generated from verified computer vision spatial metrics.'}</p>
      </div>

      <h2 class="section-title">1. Spatial Zone Performance Table</h2>
      <table>
        <thead>
          <tr>
            <th>Zone</th>
            <th>Visits</th>
            <th>Unique</th>
            <th>Avg Dwell</th>
            <th>Max Dwell</th>
            <th>Peak Occ</th>
            <th>Avg Occ</th>
            <th>Traffic Share</th>
            <th>Density</th>
          </tr>
        </thead>
        <tbody>
          ${zones.map(z => `
            <tr>
              <td>${z.name}</td>
              <td>${z.visits}</td>
              <td>${z.unique_visitors}</td>
              <td>${z.avg_dwell_sec}s</td>
              <td>${z.max_dwell_sec}s</td>
              <td>${z.peak_occupancy}</td>
              <td>${z.avg_occupancy}</td>
              <td>${z.traffic_share_pct}%</td>
              <td>${z.traffic_density}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h2 class="section-title">2. Customer Flow & Traversal Pathways</h2>
      <div class="card-list">
        ${flowMap.links && flowMap.links.length > 0 ? flowMap.links.slice(0, 5).map(l => `
          <div class="item-card recommendation">
            <div class="item-header">
              <span>${l.source_name} &rarr; ${l.target_name}</span>
              <span>${l.count} visitor(s) (${l.percentage}%)</span>
            </div>
            <div class="item-body">Direct zone traversal pathway observed across tracked customers.</div>
          </div>
        `).join('') : '<p style="font-size: 13px; color: var(--text-muted);">No multi-zone transitions observed.</p>'}
      </div>

      <h2 class="section-title">3. Forensic Bottleneck & Dead-Zone Intelligence</h2>
      <div class="card-list">
        ${bottlenecks.filter(b => b.is_bottleneck).map(b => `
          <div class="item-card bottleneck">
            <div class="item-header">
              <span>Potential Bottleneck: ${b.zone_name}</span>
              <span>Score: ${b.score}/100 (${b.confidence} Confidence)</span>
            </div>
            <div class="item-body">${(b.evidence || []).join(' &bull; ')}</div>
          </div>
        `).join('')}

        ${deadZones.filter(d => d.is_dead_zone).map(d => `
          <div class="item-card deadzone">
            <div class="item-header">
              <span>Potential Dead Zone: ${d.zone_name}</span>
              <span>Score: ${d.score}/100 (${d.confidence} Confidence)</span>
            </div>
            <div class="item-body">${(d.evidence || []).join(' &bull; ')}</div>
          </div>
        `).join('')}
      </div>

      <h2 class="section-title">4. Strategic Recommendations & Actions</h2>
      <div class="card-list">
        ${(report.recommendations || []).map(r => `
          <div class="item-card recommendation">
            <div class="item-header">
              <span>[${r.type}] ${r.area}</span>
            </div>
            <div class="item-body">
              <strong>Evidence:</strong> ${r.evidence}<br>
              <strong>Action:</strong> ${r.recommendation}
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="footer">
      Generated deterministically by Retail Spatial Intelligence Platform Engine v2.1 &bull; Strictly Anonymous Computer Vision &bull; Zero Biometric Profiling
    </div>
  </div>
</body>
</html>`;
}

module.exports = {
  generateHtmlReport
};

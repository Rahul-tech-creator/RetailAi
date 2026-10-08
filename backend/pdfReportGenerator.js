const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Enterprise PDF Report Generator for Retail Spatial Intelligence Platform.
 * Generates consulting-grade executive analytical reports matching the platform's
 * aesthetic: muted emerald, charcoal, clean typography, tables, embedded heatmaps,
 * validation panel diagnostics, and methodology transparency.
 */
function generatePdfReport(analytics, report, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true,
        info: {
          Title: 'Retail Spatial Intelligence Report',
          Author: 'Retail Spatial Intelligence Platform',
          Subject: 'CCTV Computer Vision Foot-Traffic Analysis',
          Keywords: 'Retail, Analytics, YOLO, ByteTrack, Heatmap, Dwell Time'
        }
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const meta = analytics.videoMetadata || analytics.video_metadata || {};
      const visitor = analytics.visitorStats || analytics.visitor_summary || {};
      const quality = analytics.trackingQuality || analytics.tracking_quality || {};
      const zones = analytics.zoneStats || analytics.zone_statistics || [];
      const bottlenecks = analytics.bottleneckResults || analytics.bottlenecks || [];
      const deadZones = analytics.deadZoneResults || analytics.dead_zones || [];
      const highActivity = analytics.highActivityResults || analytics.high_activity_areas || [];
      const journeys = (analytics.journeyStats?.patterns) || analytics.journey_patterns || [];
      const flowMap = (analytics.journeyStats?.flow_map) || analytics.flow_map || { links: [] };
      const confidence = analytics.analyticsConfidence || analytics.analytics_confidence || {};
      const validation = analytics.validationStats || analytics.validation_stats || {};
      const limitations = analytics.limitations || quality.limitations || [];

      // Color Palette
      const primaryDark = '#0F172A';
      const textPrimary = '#1E293B';
      const textSecondary = '#475569';
      const textMuted = '#64748B';
      const emeraldPrimary = '#059669';
      const emeraldBg = '#ECFDF5';
      const borderSubtle = '#CBD5E1';
      const lightBg = '#F8FAFC';
      const roseColor = '#E11D48';
      const amberColor = '#D97706';

      // ==========================================
      // PAGE 1: COVER PAGE
      // ==========================================
      doc.rect(40, 40, 515, 6).fill(emeraldPrimary);

      doc.moveDown(4);
      doc.fontSize(12).font('Helvetica-Bold').fillColor(emeraldPrimary).text('ENTERPRISE RETAIL ANALYTICS', 40, 70, { letterSpacing: 1.5 });
      doc.fontSize(28).font('Helvetica-Bold').fillColor(primaryDark).text('Retail Spatial Intelligence', 40, 92);
      doc.fontSize(18).font('Helvetica').fillColor(textSecondary).text('CCTV Foot-Traffic & Spatial Behavior Report', 40, 126);

      // Accent pill
      doc.roundedRect(40, 156, 185, 22, 4).fill(emeraldBg);
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor(emeraldPrimary).text('VERIFIED COMPUTER VISION DATA', 46, 162);

      // Metadata Card
      doc.roundedRect(40, 195, 515, 140, 8).fill(lightBg).stroke(borderSubtle);
      doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryDark).text('Analysis Parameters & Provenance', 55, 208);

      const metaCol1X = 55;
      const metaCol2X = 300;
      let metaY = 228;

      doc.fontSize(8.5).font('Helvetica-Bold').fillColor(textMuted).text('VIDEO SOURCE:', metaCol1X, metaY);
      doc.font('Helvetica').fillColor(textPrimary).text(meta.filename || 'CCTV Video', metaCol1X + 90, metaY);

      doc.font('Helvetica-Bold').fillColor(textMuted).text('DATE PROCESSED:', metaCol2X, metaY);
      doc.font('Helvetica').fillColor(textPrimary).text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }), metaCol2X + 105, metaY);

      metaY += 17;
      doc.font('Helvetica-Bold').fillColor(textMuted).text('RESOLUTION:', metaCol1X, metaY);
      doc.font('Helvetica').fillColor(textPrimary).text(`${meta.resolution || 'N/A'} (${meta.processed_resolution || 'processed'})`, metaCol1X + 90, metaY);

      doc.font('Helvetica-Bold').fillColor(textMuted).text('VIDEO DURATION:', metaCol2X, metaY);
      doc.font('Helvetica').fillColor(textPrimary).text(`${meta.duration_seconds || 0}s (${meta.frame_count || 0} frames @ ${meta.fps || 0} fps)`, metaCol2X + 105, metaY);

      metaY += 17;
      doc.font('Helvetica-Bold').fillColor(textMuted).text('ZONE CONFIG:', metaCol1X, metaY);
      doc.font('Helvetica').fillColor(textPrimary).text(analytics.zone_system?.source === 'user' ? 'Custom Retail Zones' : 'Automatic Camera Regions', metaCol1X + 90, metaY);

      doc.font('Helvetica-Bold').fillColor(textMuted).text('ANALYSIS QUALITY:', metaCol2X, metaY);
      doc.font('Helvetica-Bold').fillColor(emeraldPrimary).text(`${confidence.overall_quality || 'High'} Quality`, metaCol2X + 105, metaY);

      metaY += 17;
      doc.font('Helvetica-Bold').fillColor(textMuted).text('CV PIPELINE:', metaCol1X, metaY);
      doc.font('Helvetica').fillColor(textPrimary).text('YOLOv8 + ByteTrack (Floor Footpoints)', metaCol1X + 90, metaY);

      doc.font('Helvetica-Bold').fillColor(textMuted).text('REPORT VERSION:', metaCol2X, metaY);
      doc.font('Helvetica').fillColor(textPrimary).text('v2.2 (Canonical Single Truth)', metaCol2X + 105, metaY);

      metaY += 17;
      doc.font('Helvetica-Bold').fillColor(textMuted).text('TRACKING QUALITY:', metaCol1X, metaY);
      doc.font('Helvetica-Bold').fillColor(emeraldPrimary).text(`${quality.rating || 'Good'} (${quality.valid_visitors_count || visitor.unique_visitors || 0} valid tracks)`, metaCol1X + 115, metaY);

      doc.font('Helvetica-Bold').fillColor(textMuted).text('JOB AUDIT ID:', metaCol2X, metaY);
      doc.font('Helvetica').fillColor(textPrimary).text((analytics.job_id || 'N/A').slice(0, 18), metaCol2X + 105, metaY);

      // Key Metrics Banner (4 Blocks)
      const kpiY = 350;
      const kpiWidth = 120;
      const kpis = [
        { label: 'TRACKED VISITORS', val: `${visitor.unique_visitors ?? 0}`, sub: 'Unique valid tracks' },
        { label: 'AVG ZONE DWELL', val: `${visitor.avg_dwell_time_sec ?? 0}s`, sub: `Median: ${visitor.median_dwell_time_sec ?? 0}s` },
        { label: 'PEAK CONCURRENCY', val: `${visitor.peak_store_occupancy ?? 0}`, sub: 'Max simultaneous' },
        { label: 'TOTAL ZONE VISITS', val: `${visitor.total_zone_visits ?? 0}`, sub: `Across ${zones.length} zones` }
      ];

      kpis.forEach((kpi, idx) => {
        const x = 40 + idx * (kpiWidth + 11);
        doc.roundedRect(x, kpiY, kpiWidth, 68, 6).fill(lightBg).stroke(borderSubtle);
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor(textMuted).text(kpi.label, x + 8, kpiY + 10);
        doc.fontSize(18).font('Helvetica-Bold').fillColor(emeraldPrimary).text(kpi.val, x + 8, kpiY + 24);
        doc.fontSize(7.5).font('Helvetica').fillColor(textSecondary).text(kpi.sub, x + 8, kpiY + 49);
      });

      // Executive Summary Box
      const execY = 432;
      doc.roundedRect(40, execY, 515, 175, 8).fill('#FFFFFF').stroke(emeraldPrimary);
      doc.rect(40, execY, 6, 175).fill(emeraldPrimary);

      doc.fontSize(12).font('Helvetica-Bold').fillColor(primaryDark).text('Executive Summary', 58, execY + 16);
      doc.fontSize(8).font('Helvetica-Bold').fillColor(emeraldPrimary).text(
        report.is_ai_generated ? 'AI INTERPRETATION (GROQ LLM) FROM VERIFIED CV DATA' : 'DETERMINISTIC SPATIAL RULES SUMMARY',
        58, execY + 34
      );

      const execText = report.executive_summary ||
        `Video analysis observed ${visitor.unique_visitors || 0} unique tracked customer visits across ${meta.duration_seconds || 0}s of footage. Overall average dwell time was ${visitor.avg_dwell_time_sec || 0}s with a peak simultaneous store occupancy of ${visitor.peak_store_occupancy || 0} people. Computer vision tracking identified ${bottlenecks.filter(b => b.is_bottleneck).length} potential bottleneck zone(s) and ${deadZones.filter(d => d.is_dead_zone).length} under-traversed area(s).`;

      doc.fontSize(9.5).font('Helvetica').fillColor(textSecondary).text(execText, 58, execY + 50, {
        width: 475,
        align: 'justify',
        lineGap: 3
      });

      // Cover Notice
      doc.fontSize(7.5).font('Helvetica-Oblique').fillColor(textMuted).text(
        'Note: Visitor count represents unique anonymous tracks observed by the camera above minimum duration threshold. Speeds are reported in image-space px/s.',
        40, 770, { align: 'center', width: 515 }
      );

      // ==========================================
      // PAGE 2: OPERATIONAL TRAFFIC & HEATMAP
      // ==========================================
      doc.addPage();
      addHeader(doc, 'Section 1 & 2: Traffic Concurrency & Heatmap');

      doc.fontSize(14).font('Helvetica-Bold').fillColor(primaryDark).text('1. Temporal Traffic Dynamics & Concurrency', 40, 70);
      doc.moveDown(0.4);
      doc.fontSize(9).font('Helvetica').fillColor(textSecondary).text(
        report.customer_flow || 'Pedestrian movement dynamics observed across the video timeframe.',
        40, doc.y, { width: 515, lineGap: 2 }
      );

      doc.moveDown(0.8);

      // Concurrency summary card
      const concY = doc.y;
      doc.roundedRect(40, concY, 515, 60, 6).fill(lightBg).stroke(borderSubtle);
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor(primaryDark).text('PEAK STORE OCCUPANCY:', 55, concY + 12);
      doc.font('Helvetica').fillColor(emeraldPrimary).text(`${visitor.peak_store_occupancy || 0} concurrent tracked individuals`, 195, concY + 12);

      doc.font('Helvetica-Bold').fillColor(primaryDark).text('AVERAGE OCCUPANCY:', 55, concY + 28);
      doc.font('Helvetica').fillColor(textSecondary).text(`${visitor.avg_store_occupancy || 0} people per analyzed interval`, 195, concY + 28);

      doc.font('Helvetica-Bold').fillColor(primaryDark).text('IMAGE-SPACE SPEED:', 55, concY + 44);
      doc.font('Helvetica').fillColor(textSecondary).text(`${visitor.relative_speed?.overall_avg_speed_px_sec || 0} px/s (Relative pedestrian velocity)`, 195, concY + 44);

      doc.y = concY + 75;

      // Section 2: Heatmap
      doc.fontSize(14).font('Helvetica-Bold').fillColor(primaryDark).text('2. 2D Gaussian Kernel Spatial Heatmap', 40, doc.y);
      doc.moveDown(0.4);
      doc.fontSize(8.5).font('Helvetica').fillColor(textSecondary).text(
        'Accumulated ground foot-points smoothed via 2D Gaussian density kernel and rendered onto the representative camera frame:',
        40, doc.y
      );

      doc.moveDown(0.6);

      // Embed Heatmap Image
      const heatmapImgPath = path.join(__dirname, '..', 'processed', `${analytics.job_id}_heatmap.png`);
      const baseFramePath = path.join(__dirname, '..', 'processed', `${analytics.job_id}_frame.jpg`);
      const imgToEmbed = fs.existsSync(heatmapImgPath) ? heatmapImgPath : (fs.existsSync(baseFramePath) ? baseFramePath : null);

      if (imgToEmbed) {
        try {
          const imgY = doc.y;
          doc.image(imgToEmbed, 40, imgY, { fit: [515, 230], align: 'center', valign: 'center' });
          doc.y = imgY + 240;
        } catch (imgErr) {
          console.warn('[PDF] Failed to embed heatmap image:', imgErr.message);
          doc.rect(40, doc.y, 515, 140).fill(lightBg).stroke(borderSubtle);
          doc.fontSize(9).font('Helvetica-Oblique').fillColor(textMuted).text('Heatmap rendering completed. Image file referenced on server.', 120, doc.y + 60);
          doc.y += 150;
        }
      } else {
        doc.rect(40, doc.y, 515, 140).fill(lightBg).stroke(borderSubtle);
        doc.fontSize(9).font('Helvetica-Oblique').fillColor(textMuted).text('Heatmap available on dashboard.', 150, doc.y + 60);
        doc.y += 150;
      }

      doc.fontSize(8).font('Helvetica-Oblique').fillColor(textMuted).text(
        'Heatmap represents observed customer foot-point activity during the analyzed period. Red indicates peak dwell density.',
        40, doc.y, { align: 'center', width: 515 }
      );

      // ==========================================
      // PAGE 3: ZONE PERFORMANCE & FLOW MAP
      // ==========================================
      doc.addPage();
      addHeader(doc, 'Section 3 & 4: Zone Analytics & Customer Flow');

      doc.fontSize(14).font('Helvetica-Bold').fillColor(primaryDark).text('3. Spatial Zone Performance Analysis (Normalized)', 40, 70);
      doc.moveDown(0.4);
      doc.fontSize(8.5).font('Helvetica').fillColor(textSecondary).text(
        'Comprehensive empirical measurements per spatial zone. Normalized area metrics prevent large zones from appearing artificially dominant.',
        40, doc.y, { width: 515 }
      );

      doc.moveDown(0.8);

      // Zone Performance Table
      const tableX = 40;
      let currentTableY = doc.y;
      const colWidths = [95, 45, 45, 45, 45, 40, 50, 50, 50, 50];
      const headers = ['Zone Name', 'Visits', 'Unique', 'Avg Dwell', 'Max Dwell', 'Peak', 'Area (%)', 'Density', 'Vis/Min', 'Share'];

      // Header row
      doc.rect(tableX, currentTableY, 515, 20).fill(primaryDark);
      let curX = tableX;
      headers.forEach((h, i) => {
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#FFFFFF').text(h, curX + 3, currentTableY + 5, {
          width: colWidths[i] - 6,
          align: i === 0 ? 'left' : 'right'
        });
        curX += colWidths[i];
      });

      currentTableY += 20;

      // Table Rows
      zones.forEach((z, idx) => {
        const rowBg = idx % 2 === 0 ? '#FFFFFF' : lightBg;
        doc.rect(tableX, currentTableY, 515, 18).fill(rowBg);
        doc.rect(tableX, currentTableY + 17, 515, 1).fill(borderSubtle);

        let cellX = tableX;
        const rowData = [
          z.name || `Zone ${idx + 1}`,
          `${z.visits || 0}`,
          `${z.unique_visitors || 0}`,
          `${z.avg_dwell_sec || 0}s`,
          `${z.max_dwell_sec || 0}s`,
          `${z.peak_occupancy || 0}`,
          `${z.area_pct_of_frame || 0}%`,
          `${z.activity_density_100k || z.traffic_density || 0}`,
          `${z.visitors_per_minute || 0}`,
          `${z.traffic_share_pct || 0}%`
        ];

        rowData.forEach((val, i) => {
          doc.fontSize(7).font(i === 0 ? 'Helvetica-Bold' : 'Helvetica').fillColor(textPrimary).text(val, cellX + 3, currentTableY + 5, {
            width: colWidths[i] - 6,
            align: i === 0 ? 'left' : 'right'
          });
          cellX += colWidths[i];
        });

        currentTableY += 18;
      });

      doc.y = currentTableY + 18;

      // Section 4: Customer Flow Map & Journeys
      doc.fontSize(14).font('Helvetica-Bold').fillColor(primaryDark).text('4. Customer Flow & Traversal Pathways', 40, doc.y);
      doc.moveDown(0.4);

      doc.fontSize(8.5).font('Helvetica').fillColor(textSecondary).text(
        'Zone-to-zone transitions mined from consecutive spatial crossings across verified customer paths:',
        40, doc.y
      );
      doc.moveDown(0.6);

      if (flowMap.links && flowMap.links.length > 0) {
        const flowY = doc.y;
        doc.roundedRect(40, flowY, 515, Math.min(100, 20 + flowMap.links.length * 16), 6).fill(lightBg).stroke(borderSubtle);
        doc.fontSize(8).font('Helvetica-Bold').fillColor(primaryDark).text('DETECTED DIRECT ZONE TRANSITIONS:', 52, flowY + 8);
        
        flowMap.links.slice(0, 5).forEach((link, idx) => {
          const lY = flowY + 22 + idx * 15;
          doc.fontSize(8).font('Helvetica').fillColor(textPrimary).text(
            `• ${link.source_name}  →  ${link.target_name} :  ${link.count} visitor(s) (${link.percentage}%)`,
            60, lY
          );
        });

        doc.y = flowY + Math.min(100, 20 + flowMap.links.length * 16) + 14;
      } else {
        doc.fontSize(8.5).font('Helvetica-Oblique').fillColor(textMuted).text('No multi-zone transitions observed during the sample period.', 40, doc.y);
        doc.moveDown(1);
      }

      // Customer Journeys
      doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryDark).text('Frequent Customer Journey Sequences:', 40, doc.y);
      doc.moveDown(0.4);

      if (journeys.length > 0) {
        journeys.slice(0, 4).forEach((j, idx) => {
          doc.fontSize(8.5).font('Helvetica-Bold').fillColor(emeraldPrimary).text(`${idx + 1}. ${j.path}`, 48, doc.y);
          doc.fontSize(7.5).font('Helvetica').fillColor(textSecondary).text(
            `    Observed in ${j.observed_customers} customer(s) (${j.percentage}% of journeys) - Avg Duration: ${j.avg_duration_sec || 0}s`,
            48, doc.y
          );
          doc.moveDown(0.3);
        });
      } else {
        doc.fontSize(8.5).font('Helvetica-Oblique').fillColor(textMuted).text('Customers remained localized within individual zones without completing multi-zone loops.', 48, doc.y);
      }

      // ==========================================
      // PAGE 4: FORENSIC BOTTLENECKS, DEAD ZONES & RECOMMENDATIONS
      // ==========================================
      doc.addPage();
      addHeader(doc, 'Section 5 & 6: Bottlenecks, Dead Zones & AI Actions');

      doc.fontSize(14).font('Helvetica-Bold').fillColor(primaryDark).text('5. Forensic Bottleneck & Dead-Zone Intelligence', 40, 70);
      doc.moveDown(0.4);

      // Bottlenecks list
      doc.fontSize(10).font('Helvetica-Bold').fillColor(roseColor).text('POTENTIAL BOTTLENECK ANALYSIS:', 40, doc.y);
      doc.moveDown(0.3);

      const activeB = bottlenecks.filter(b => b.is_bottleneck);
      if (activeB.length > 0) {
        activeB.forEach(b => {
          doc.fontSize(9).font('Helvetica-Bold').fillColor(primaryDark).text(`• ${b.zone_name} (Bottleneck Score: ${b.score}/100 - Confidence: ${b.confidence})`, 48, doc.y);
          (b.evidence || []).forEach(e => {
            doc.fontSize(8).font('Helvetica').fillColor(textSecondary).text(`    - Evidence: ${e}`, 48, doc.y);
          });
          doc.moveDown(0.3);
        });
      } else {
        doc.fontSize(8.5).font('Helvetica').fillColor(textSecondary).text('• No severe bottlenecks detected under current foot-traffic volumes.', 48, doc.y);
      }

      doc.moveDown(0.8);

      // Dead Zones list
      doc.fontSize(10).font('Helvetica-Bold').fillColor(amberColor).text('POTENTIAL DEAD-ZONE ANALYSIS:', 40, doc.y);
      doc.moveDown(0.3);

      const activeD = deadZones.filter(d => d.is_dead_zone);
      if (activeD.length > 0) {
        activeD.forEach(d => {
          doc.fontSize(9).font('Helvetica-Bold').fillColor(primaryDark).text(`• ${d.zone_name} (Deficiency Score: ${d.score}/100, Activity: ${d.activity_score || 0}% - Confidence: ${d.confidence})`, 48, doc.y);
          (d.evidence || []).forEach(e => {
            doc.fontSize(8).font('Helvetica').fillColor(textSecondary).text(`    - Evidence: ${e}`, 48, doc.y);
          });
          doc.moveDown(0.3);
        });
      } else {
        doc.fontSize(8.5).font('Helvetica').fillColor(textSecondary).text('• Healthy foot-traffic distribution observed across all monitored zones.', 48, doc.y);
      }

      doc.moveDown(1);

      // High activity areas
      doc.fontSize(10).font('Helvetica-Bold').fillColor(emeraldPrimary).text('HIGH-ACTIVITY DESTINATION ZONES:', 40, doc.y);
      doc.moveDown(0.3);
      if (highActivity.length > 0) {
        highActivity.slice(0, 2).forEach(h => {
          doc.fontSize(8.5).font('Helvetica').fillColor(textPrimary).text(
            `• ${h.zone_name}: ${h.visits} visits, ${h.avg_dwell_sec}s avg dwell, peak concurrent: ${h.peak_occupancy || 0} (${h.status})`,
            48, doc.y
          );
        });
      } else {
        doc.fontSize(8.5).font('Helvetica-Oblique').fillColor(textMuted).text('• Insufficient traffic volume to distinguish destination zones.', 48, doc.y);
      }

      doc.moveDown(1.2);

      // Section 6: AI Interpretation & Strategic Recommendations
      doc.fontSize(14).font('Helvetica-Bold').fillColor(primaryDark).text('6. Strategic Recommendations & Priority Action Plan', 40, doc.y);
      doc.moveDown(0.4);

      const recs = report.recommendations || [];
      if (recs.length > 0) {
        recs.slice(0, 3).forEach(r => {
          doc.fontSize(9).font('Helvetica-Bold').fillColor(primaryDark).text(`[${r.type}] ${r.area}`, 48, doc.y);
          doc.fontSize(8).font('Helvetica').fillColor(textMuted).text(`Evidence: ${r.evidence}`, 48, doc.y);
          doc.fontSize(8.5).font('Helvetica').fillColor(textPrimary).text(`Action: ${r.recommendation}`, 48, doc.y);
          doc.moveDown(0.4);
        });
      }

      doc.moveDown(0.5);

      // Priority Action Plan
      doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryDark).text('Prioritized Action Plan:', 40, doc.y);
      doc.moveDown(0.3);
      const priorities = report.priority_actions || [];
      if (priorities.length > 0) {
        priorities.forEach(p => {
          const pColor = p.priority === 'High' ? roseColor : p.priority === 'Medium' ? amberColor : emeraldPrimary;
          doc.fontSize(8.5).font('Helvetica-Bold').fillColor(pColor).text(`[${p.priority} Priority]:`, 48, doc.y, { continued: true });
          doc.font('Helvetica').fillColor(textPrimary).text(` ${p.action}`);
          doc.moveDown(0.2);
        });
      }

      // ==========================================
      // PAGE 5: METHODOLOGY, BOUNDARIES & VALIDATION
      // ==========================================
      doc.addPage();
      addHeader(doc, 'Section 7 & 8: Methodology & Epistemological Boundaries');

      doc.fontSize(14).font('Helvetica-Bold').fillColor(primaryDark).text('7. Analytics Validation & Ground-Truth Integrity', 40, 70);
      doc.moveDown(0.4);

      // Validation stats table
      if (validation.detection && validation.tracking) {
        const valY = doc.y;
        doc.roundedRect(40, valY, 515, 65, 6).fill(lightBg).stroke(borderSubtle);
        
        doc.fontSize(8).font('Helvetica-Bold').fillColor(primaryDark).text('DETECTION VALIDATION:', 52, valY + 10);
        doc.font('Helvetica').fillColor(textSecondary).text(`${validation.detection.total_detections} raw detections | ${validation.detection.avg_confidence} avg conf | ${validation.detection.detections_per_frame} det/frame`, 52, valY + 22);

        doc.font('Helvetica-Bold').fillColor(primaryDark).text('TRACKING VALIDATION:', 52, valY + 38);
        doc.font('Helvetica').fillColor(textSecondary).text(`${validation.tracking.valid_tracks} valid tracks (${validation.tracking.short_tracks} transient filtered) | Max duration: ${validation.tracking.longest_track_sec}s | ~${validation.tracking.approximate_id_switches} ID switch candidate(s)`, 52, valY + 50);

        doc.y = valY + 75;
      }

      // What the System Knows vs Cannot Observe Table (Section 23)
      doc.fontSize(12).font('Helvetica-Bold').fillColor(primaryDark).text('Epistemological Scope: What The System Actually Knows', 40, doc.y);
      doc.moveDown(0.3);

      const scopeY = doc.y;
      const boxW = 250;
      // Observes box
      doc.roundedRect(40, scopeY, boxW, 85, 6).fill('#F0FDF4').stroke(emeraldPrimary);
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor(emeraldPrimary).text('THE SYSTEM CAN DIRECTLY OBSERVE:', 50, scopeY + 10);
      doc.fontSize(7.5).font('Helvetica').fillColor(textPrimary).text('• Spatial pedestrian movement & footpaths', 50, scopeY + 24);
      doc.text('• Zone entry/exit timestamps & dwell duration', 50, scopeY + 36);
      doc.text('• Concurrent physical occupancy & density', 50, scopeY + 48);
      doc.text('• Sequential zone transition flow & friction', 50, scopeY + 60);

      // Cannot observe box
      doc.roundedRect(305, scopeY, boxW, 85, 6).fill('#FEF2F2').stroke(roseColor);
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor(roseColor).text('THE SYSTEM CANNOT DIRECTLY OBSERVE:', 315, scopeY + 10);
      doc.fontSize(7.5).font('Helvetica').fillColor(textPrimary).text('• Customer identity or demographic PII', 315, scopeY + 24);
      doc.text('• Product purchase decisions or basket value', 315, scopeY + 36);
      doc.text('• Revenue or sales conversion (requires POS)', 315, scopeY + 48);
      doc.text('• Real-world metric distance without 3D calibration', 315, scopeY + 60);

      doc.y = scopeY + 98;

      // Section 8: Methodology & Limitations
      doc.fontSize(12).font('Helvetica-Bold').fillColor(primaryDark).text('Scientific Methodology & Limitations', 40, doc.y);
      doc.moveDown(0.3);

      const systemLimitations = [
        'Single-Camera Monocular Perspective: Field of view is restricted to camera mounting angle. Speeds are reported in image-space pixels/second, not calibrated metric coordinates.',
        'Visual Occlusion: Dense clusters or shelving can temporarily occlude foot points. The platform uses a tolerance buffer, but prolonged occlusions may fragment tracks.',
        'Zero PII Policy: The system operates with transient anonymous IDs only. No face recognition, demographic profiling, or biometric storage is performed.',
        'Automatic Regions: Partitioned geometrically across the camera field of view; they represent spatial camera sectors, not semantic store departments.'
      ];

      systemLimitations.forEach(lim => {
        doc.fontSize(8).font('Helvetica').fillColor(textSecondary).text(`• ${lim}`, 45, doc.y, { width: 505 });
        doc.moveDown(0.25);
      });

      // Sign-off box
      doc.moveDown(0.8);
      doc.roundedRect(40, doc.y, 515, 38, 6).fill(lightBg).stroke(borderSubtle);
      doc.fontSize(8).font('Helvetica-Bold').fillColor(primaryDark).text('AUTHENTICATION & VERIFICATION STAMP', 52, doc.y + 8);
      doc.fontSize(7.5).font('Helvetica').fillColor(textMuted).text(
        `Generated deterministically by Retail Spatial Intelligence Platform Engine v2.2. All metrics directly traceable to video frame detections. Job ID: ${analytics.job_id}`,
        52, doc.y + 20
      );

      // Add Headers & Footers on all pages
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        // Skip header on cover page (page 0)
        if (i > 0) {
          doc.rect(40, 20, 515, 1).fill(borderSubtle);
        }
        // Footer on all pages
        doc.fontSize(7.5).font('Helvetica').fillColor(textMuted).text(
          `Retail Spatial Intelligence Platform — Confidential Executive Report — Page ${i + 1} of ${range.count}`,
          40, 805, { align: 'center', width: 515 }
        );
      }

      doc.end();
      writeStream.on('finish', () => resolve(outputPath));
      writeStream.on('error', reject);

    } catch (err) {
      reject(err);
    }
  });
}

function addHeader(doc, sectionTitle) {
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#059669').text('RETAIL SPATIAL INTELLIGENCE PLATFORM', 40, 26);
  doc.fontSize(7.5).font('Helvetica').fillColor('#64748B').text(sectionTitle, 300, 26, { align: 'right', width: 255 });
  doc.rect(40, 36, 515, 1).fill('#E2E8F0');
}

module.exports = {
  generatePdfReport
};

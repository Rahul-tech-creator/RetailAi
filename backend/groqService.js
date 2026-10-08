const Groq = require('groq-sdk');

class GroqReportingService {
  constructor() {
    this.apiKey = process.env.GROQ_API_KEY || '';
    this.model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    this.client = null;
    if (this.apiKey) {
      try {
        this.client = new Groq({ apiKey: this.apiKey });
      } catch (err) {
        console.warn('[Groq] Failed to initialize client:', err.message);
      }
    }
  }

  generateDeterministicFallback(analytics) {
    const meta = analytics.videoMetadata || analytics.video_metadata || {};
    const visitors = analytics.visitorStats || analytics.visitor_summary || {};
    const zones = analytics.zoneStats || analytics.zone_statistics || [];
    const bottlenecks = analytics.bottleneckResults || analytics.bottlenecks || [];
    const deadZones = analytics.deadZoneResults || analytics.dead_zones || [];
    const highActivity = analytics.highActivityResults || analytics.high_activity_areas || [];
    const journeys = (analytics.journeyStats?.patterns) || analytics.journey_patterns || [];
    const flowMap = (analytics.journeyStats?.flow_map) || analytics.flow_map || { links: [] };
    const quality = analytics.trackingQuality || analytics.tracking_quality || {};
    const confidence = analytics.analyticsConfidence || analytics.analytics_confidence || {};

    const activeBottlenecks = bottlenecks.filter(b => b.is_bottleneck);
    const activeDeadZones = deadZones.filter(d => d.is_dead_zone);

    // Rule-based recommendations derived strictly from physical CV evidence
    const recommendations = [];
    if (activeBottlenecks.length > 0) {
      recommendations.push({
        area: activeBottlenecks[0].zone_name,
        type: 'Congestion Alleviation',
        evidence: activeBottlenecks[0].evidence.join('; '),
        recommendation: `Widen primary aisle clearance or reposition high-interaction displays in ${activeBottlenecks[0].zone_name} to alleviate observed transit bottlenecks.`
      });
    }

    if (activeDeadZones.length > 0) {
      recommendations.push({
        area: activeDeadZones[0].zone_name,
        type: 'Foot-Traffic Revitalization',
        evidence: activeDeadZones[0].evidence.join('; '),
        recommendation: `Introduce focal visual merchandising, promotional signage, or destination product categories in ${activeDeadZones[0].zone_name} to redistribute foot-traffic from congested zones.`
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        area: 'Store Floor',
        type: 'Flow Optimization',
        evidence: `Balanced observed traffic across ${zones.length} monitored spatial zones with no severe bottlenecks.`,
        recommendation: 'Maintain current layout and test incremental promotional endcaps along primary customer journey paths.'
      });
    }

    const priorities = [
      {
        priority: 'High',
        action: activeBottlenecks.length > 0
          ? `Audit aisle clearance in ${activeBottlenecks.map(b => b.zone_name).join(', ')} to eliminate movement slowdowns.`
          : 'Establish baseline dwell tracking across scheduled operational shifts.'
      },
      {
        priority: 'Medium',
        action: activeDeadZones.length > 0
          ? `Review product placement and category visibility in ${activeDeadZones.map(d => d.zone_name).join(', ')}.`
          : 'Compare peak occupancy periods with staff scheduling.'
      },
      {
        priority: 'Low',
        action: 'Conduct subsequent video analysis after implementing spatial adjustments to evaluate before/after metrics.'
      }
    ];

    const suggestedExperiments = [
      {
        hypothesis: activeDeadZones.length > 0 
          ? `Adding eye-level feature signage at the entrance to ${activeDeadZones[0].zone_name} will increase customer traversal share by at least 15%.`
          : 'Testing directional aisle signage will increase multi-zone journey completion rate.',
        metric_to_track: 'Traffic share (%) and zone entry count',
        method: 'A/B layout comparison recording 30 minutes of footage under each configuration.'
      }
    ];

    return {
      is_ai_generated: false,
      disclaimer: 'AI interpretation unavailable. Showing deterministic analytics based directly on verified computer vision facts.',
      executive_summary: `Video analysis observed ${visitors.unique_visitors || 0} unique tracked customer visits across ${meta.duration_seconds || 0}s of footage. Overall average dwell time was ${visitors.avg_dwell_time_sec || 0}s with a peak simultaneous store occupancy of ${visitors.peak_store_occupancy || 0} people. ${activeBottlenecks.length} potential bottleneck area(s) and ${activeDeadZones.length} potential dead-zone area(s) were deterministically identified.`,
      customer_flow: `Primary traffic flow centers around ${highActivity.length > 0 ? highActivity[0].zone_name : 'the central zones'}. Most common movement pathway: ${journeys.length > 0 ? journeys[0].path : 'Distributed single-zone visits'}. Observed ${flowMap.links?.length || 0} distinct zone-to-zone transitions.`,
      dwell_time_findings: `Average dwell duration across all zones was ${visitors.avg_dwell_time_sec || 0}s (median: ${visitors.median_dwell_time_sec || 0}s). Zones with above-average engagement include: ${zones.filter(z => z.avg_dwell_sec > (visitors.avg_dwell_time_sec || 0)).map(z => `${z.name} (${z.avg_dwell_sec}s)`).join(', ') || 'None'}.`,
      bottleneck_findings: activeBottlenecks.length > 0
        ? `Identified ${activeBottlenecks.length} potential bottleneck(s): ${activeBottlenecks.map(b => `${b.zone_name} (Score: ${b.score}/100, Evidence: ${b.evidence[0] || 'High occupancy'})`).join('. ')}`
        : 'No severe bottlenecks detected under current observed traffic volumes.',
      dead_zone_findings: activeDeadZones.length > 0
        ? `Identified ${activeDeadZones.length} potential dead zone(s): ${activeDeadZones.map(d => `${d.zone_name} (Score: ${d.score}/100, Deficiency: ${d.score}/100, Evidence: ${d.evidence[0] || 'Low foot traffic'})`).join('. ')}`
        : 'All monitored regions demonstrated healthy customer traversal.',
      journey_findings: journeys.length > 0
        ? `Top journey pattern is "${journeys[0].path}" observed in ${journeys[0].observed_customers} customer track(s) (${journeys[0].percentage}% of multi-zone visits).`
        : 'Foot-traffic was predominantly localized without extended multi-zone traverses.',
      recommendations,
      priority_actions: priorities,
      suggested_experiments: suggestedExperiments,
      tracking_limitations: quality.notes || 'Observation period is limited to uploaded sample video. Uncalibrated monocular camera perspective.'
    };
  }

  async generateReport(analytics) {
    if (!this.apiKey || !this.client) {
      console.log('[Groq] No GROQ_API_KEY provided or client uninitialized. Using deterministic fallback report.');
      return this.generateDeterministicFallback(analytics);
    }

    try {
      console.log(`[Groq] Requesting interpretation using model: ${this.model}`);

      // Prepare compact canonical facts payload for Groq
      const factsPayload = {
        video_metadata: analytics.videoMetadata || analytics.video_metadata,
        visitor_summary: analytics.visitorStats || analytics.visitor_summary,
        tracking_quality: analytics.trackingQuality || analytics.tracking_quality,
        zone_statistics: analytics.zoneStats || analytics.zone_statistics,
        bottlenecks: analytics.bottleneckResults || analytics.bottlenecks,
        dead_zones: analytics.deadZoneResults || analytics.dead_zones,
        high_activity_areas: analytics.highActivityResults || analytics.high_activity_areas,
        journey_patterns: (analytics.journeyStats?.patterns) || analytics.journey_patterns,
        flow_map_transitions: (analytics.journeyStats?.flow_map?.links) || analytics.flow_map?.links,
        analytics_confidence: analytics.analyticsConfidence || analytics.analytics_confidence
      };

      const systemPrompt = `You are a Principal Retail Spatial Intelligence Architect analyzing verified computer vision facts from store CCTV footage.
STRICT PRINCIPLES:
1. "CODE FOR TRUTH. AI FOR INTERPRETATION."
2. All numbers, visitor counts, dwell times, speeds, and coordinates have ALREADY been computed deterministically by the computer vision system.
3. Your role is strictly to summarize observed behavior, explain spatial dynamics, identify operational implications, suggest layout experiments, and prioritize recommendations.
4. DO NOT INVENT INFORMATION THAT DOES NOT EXIST IN THE SUPPLIED ANALYTICS.
5. If the data does not support a conclusion or is insufficient, explicitly state that.
6. NEVER fabricate or assume revenue, sales, profit, conversion rates, or customer demographic data (no age, gender, or POS data exists).
7. All recommendations MUST cite observed spatial evidence (e.g. "Because Region 3 exhibited 3.5s average dwell time and 5 visits...").
8. Output MUST be valid JSON adhering strictly to the schema requested below.`;

      const userPrompt = `Analyze the following structured computer vision facts and generate an executive retail spatial intelligence report.

STRUCTURED CANONICAL ANALYTICS FACTS:
${JSON.stringify(factsPayload, null, 2)}

Respond with a JSON object matching this schema:
{
  "is_ai_generated": true,
  "disclaimer": "AI spatial interpretation powered by Groq based strictly on verified computer vision analytics.",
  "executive_summary": "Concise 3-4 sentence store behavior summary.",
  "customer_flow": "Analysis of how customers traverse the space and zone transitions.",
  "dwell_time_findings": "Detailed breakdown of where customers stay longest vs transit quickly.",
  "bottleneck_findings": "Analysis of observed congestion, slowdowns, and trajectory overlaps.",
  "dead_zone_findings": "Analysis of under-traversed zones and potential spatial friction.",
  "journey_findings": "Analysis of common customer paths and zone transitions.",
  "recommendations": [
    {
      "area": "Zone Name",
      "type": "Recommendation Type",
      "evidence": "Specific observed metric from CV data",
      "recommendation": "Concrete spatial or merchandising action"
    }
  ],
  "suggested_experiments": [
    {
      "hypothesis": "Testable spatial or visual hypothesis",
      "metric_to_track": "Specific metric to evaluate",
      "method": "How to execute an A/B layout test"
    }
  ],
  "priority_actions": [
    { "priority": "High", "action": "Action item" },
    { "priority": "Medium", "action": "Action item" },
    { "priority": "Low", "action": "Action item" }
  ],
  "tracking_limitations": "Honest statement regarding sample duration and camera coverage."
}`;

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from Groq API');
      }

      const parsed = JSON.parse(content);
      parsed.is_ai_generated = true;
      return parsed;

    } catch (err) {
      console.warn('[Groq] API request failed or timed out:', err.message);
      console.log('[Groq] Falling back to deterministic rule-based report.');
      return this.generateDeterministicFallback(analytics);
    }
  }
}

module.exports = new GroqReportingService();

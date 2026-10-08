import React, { useState, useRef, useEffect } from 'react';
import { 
  Layers, Plus, Trash2, Check, Sparkles, AlertCircle, 
  Settings2, Eye, Play, ArrowLeft, Info, Grid3X3, Edit3
} from 'lucide-react';

const PRESET_CATEGORIES = [
  'General Retail', 'Apparel', 'Electronics', 'Grocery', 
  'Cosmetics', 'Entrance', 'Checkout', 'Promotional Aisle', 'Aisle Corridor'
];

const PRESET_COLORS = [
  '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', 
  '#EC4899', '#06B6D4', '#6366F1', '#14B8A6'
];

export default function ZoneEditor({ video, onStartAnalysis, onBack, backendUrl }) {
  const canvasRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [mode, setMode] = useState('custom'); // 'custom' or 'auto'
  
  // Custom zones
  const [zones, setZones] = useState([]);
  const [currentPolygon, setCurrentPolygon] = useState([]);
  const [zoneName, setZoneName] = useState('');
  const [zoneCategory, setZoneCategory] = useState('General Retail');
  const [zoneColor, setZoneColor] = useState(PRESET_COLORS[0]);
  const [frameImg, setFrameImg] = useState(null);

  // Automatic regions customizable names
  const [autoRegionNames, setAutoRegionNames] = useState({
    auto_region_1: 'Region 1 (Upper Left)',
    auto_region_2: 'Region 2 (Upper Right)',
    auto_region_3: 'Region 3 (Lower Left)',
    auto_region_4: 'Region 4 (Lower Right)'
  });

  // Performance & Filtering settings
  const [frameSkip, setFrameSkip] = useState(2);
  const [minTrackDuration, setMinTrackDuration] = useState(1.0);

  // Frame URL
  const frameUrl = `${backendUrl}${video.frameUrl}`;

  // Load representative frame image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = frameUrl;
    img.onload = () => {
      setFrameImg(img);
      setImageLoaded(true);
    };
  }, [frameUrl]);

  // Redraw canvas whenever points, zones, or mode change
  useEffect(() => {
    if (!canvasRef.current || !frameImg) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Match canvas coordinate system to intrinsic image dimensions
    canvas.width = frameImg.naturalWidth || 768;
    canvas.height = frameImg.naturalHeight || 432;

    // Draw background video frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);

    if (mode === 'auto') {
      // Draw automatic 4-quadrant preview
      const midX = canvas.width / 2;
      const midY = canvas.height / 2;
      const autoRegions = [
        { id: 'auto_region_1', name: autoRegionNames.auto_region_1, color: '#3B82F6', pts: [[0, 0], [midX, 0], [midX, midY], [0, midY]] },
        { id: 'auto_region_2', name: autoRegionNames.auto_region_2, color: '#10B981', pts: [[midX, 0], [canvas.width, 0], [canvas.width, midY], [midX, midY]] },
        { id: 'auto_region_3', name: autoRegionNames.auto_region_3, color: '#F59E0B', pts: [[0, midY], [midX, midY], [midX, canvas.height], [0, canvas.height]] },
        { id: 'auto_region_4', name: autoRegionNames.auto_region_4, color: '#8B5CF6', pts: [[midX, midY], [canvas.width, midY], [canvas.width, canvas.height], [midX, canvas.height]] }
      ];

      autoRegions.forEach(r => {
        ctx.fillStyle = hexToRgba(r.color, 0.18);
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);

        ctx.beginPath();
        ctx.moveTo(r.pts[0][0], r.pts[0][1]);
        r.pts.slice(1).forEach(p => ctx.lineTo(p[0], p[1]));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Label
        const cx = (r.pts[0][0] + r.pts[2][0]) / 2;
        const cy = (r.pts[0][1] + r.pts[2][1]) / 2;
        ctx.setLineDash([]);
        drawBadge(ctx, r.name, cx, cy, r.color);
      });
      return;
    }

    // Draw already saved custom zones
    zones.forEach((z) => {
      if (z.polygon.length < 3) return;
      ctx.fillStyle = hexToRgba(z.color, 0.22);
      ctx.strokeStyle = z.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.moveTo(z.polygon[0][0], z.polygon[0][1]);
      z.polygon.slice(1).forEach(p => ctx.lineTo(p[0], p[1]));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Draw label badge
      const cx = z.polygon.reduce((sum, p) => sum + p[0], 0) / z.polygon.length;
      const cy = z.polygon.reduce((sum, p) => sum + p[1], 0) / z.polygon.length;
      drawBadge(ctx, z.name, cx, cy, z.color);
    });

    // Draw in-progress polygon
    if (currentPolygon.length > 0) {
      ctx.strokeStyle = zoneColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(currentPolygon[0][0], currentPolygon[0][1]);
      currentPolygon.slice(1).forEach(p => ctx.lineTo(p[0], p[1]));
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw vertices
      currentPolygon.forEach((p, idx) => {
        ctx.fillStyle = idx === 0 ? '#FFFFFF' : zoneColor;
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p[0], p[1], 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }

  }, [frameImg, zones, currentPolygon, mode, zoneColor, autoRegionNames]);

  const handleCanvasClick = (e) => {
    if (mode === 'auto') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    // If clicking near first point (>2 points total), complete the polygon
    if (currentPolygon.length >= 3) {
      const first = currentPolygon[0];
      const dist = Math.hypot(x - first[0], y - first[1]);
      if (dist < 15) {
        completePolygon();
        return;
      }
    }

    setCurrentPolygon([...currentPolygon, [x, y]]);
  };

  const completePolygon = () => {
    if (currentPolygon.length < 3) return;
    const name = zoneName.trim() || `Zone ${zones.length + 1}`;
    const newZone = {
      id: `zone_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name,
      category: zoneCategory,
      color: zoneColor,
      polygon: currentPolygon
    };

    setZones([...zones, newZone]);
    setCurrentPolygon([]);
    setZoneName('');
    // Pick next preset color
    setZoneColor(PRESET_COLORS[(zones.length + 1) % PRESET_COLORS.length]);
  };

  const deleteZone = (id) => {
    setZones(zones.filter(z => z.id !== id));
  };

  const clearCurrent = () => {
    setCurrentPolygon([]);
  };

  const handleStart = () => {
    let customZonesPayload = null;

    if (mode === 'custom' && zones.length > 0) {
      customZonesPayload = zones;
    } else if (mode === 'auto') {
      // Build automatic regions with customized names
      const w = frameImg?.naturalWidth || 768;
      const h = frameImg?.naturalHeight || 432;
      const midX = w / 2;
      const midY = h / 2;
      customZonesPayload = [
        { id: 'auto_region_1', name: autoRegionNames.auto_region_1, category: 'Automatic Region', color: '#3B82F6', polygon: [[0, 0], [midX, 0], [midX, midY], [0, midY]] },
        { id: 'auto_region_2', name: autoRegionNames.auto_region_2, category: 'Automatic Region', color: '#10B981', polygon: [[midX, 0], [w, 0], [w, midY], [midX, midY]] },
        { id: 'auto_region_3', name: autoRegionNames.auto_region_3, category: 'Automatic Region', color: '#F59E0B', polygon: [[0, midY], [midX, midY], [midX, h], [0, h]] },
        { id: 'auto_region_4', name: autoRegionNames.auto_region_4, category: 'Automatic Region', color: '#8B5CF6', polygon: [[midX, midY], [w, midY], [w, h], [midX, h]] }
      ];
    }

    onStartAnalysis(customZonesPayload, { frameSkip, minTrackDuration });
  };

  return (
    <div style={{ maxWidth: 1280, margin: '24px auto', padding: '0 24px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <button className="btn-secondary" onClick={onBack} style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
          <ArrowLeft size={15} />
          Back to Upload
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="badge badge-neutral" style={{ fontSize: '0.8rem' }}>
            {video.metadata?.resolution || 'Unknown'} &bull; {video.metadata?.duration_seconds || 0}s &bull; {video.metadata?.fps || 0} FPS
          </span>
          <button className="btn-primary" onClick={handleStart}>
            <Play size={16} />
            Start CV Analysis
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 370px', gap: 24, alignItems: 'start' }}>
        {/* Left: Canvas Viewer & Mode Switcher */}
        <div className="glass-panel" style={{ padding: 20 }}>
          {/* Mode Selector Tabs */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
            paddingBottom: 12,
            borderBottom: '1px solid var(--border-subtle)'
          }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className={`btn-secondary ${mode === 'custom' ? 'active' : ''}`}
                onClick={() => setMode('custom')}
                style={{
                  background: mode === 'custom' ? 'var(--emerald-50)' : '#FFFFFF',
                  color: mode === 'custom' ? 'var(--emerald-700)' : 'var(--text-secondary)',
                  borderColor: mode === 'custom' ? 'var(--emerald-500)' : 'var(--border-subtle)',
                  padding: '7px 14px',
                  fontSize: '0.825rem'
                }}
              >
                <Layers size={14} />
                Mode 1: Draw Custom Zones ({zones.length})
              </button>

              <button
                className={`btn-secondary ${mode === 'auto' ? 'active' : ''}`}
                onClick={() => setMode('auto')}
                style={{
                  background: mode === 'auto' ? 'var(--blue-50)' : '#FFFFFF',
                  color: mode === 'auto' ? 'var(--blue-600)' : 'var(--text-secondary)',
                  borderColor: mode === 'auto' ? 'var(--blue-500)' : 'var(--border-subtle)',
                  padding: '7px 14px',
                  fontSize: '0.825rem'
                }}
              >
                <Grid3X3 size={14} />
                Mode 2: Automatic Camera Regions
              </button>
            </div>

            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {mode === 'custom'
                ? 'Click on video frame to plot polygon corners'
                : 'Dividing camera frame into 4 balanced regions'}
            </span>
          </div>

          {/* Interactive Frame Canvas */}
          <div style={{
            position: 'relative',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            background: '#0F172A',
            border: '1px solid var(--border-subtle)'
          }}>
            {!imageLoaded && (
              <div style={{ height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}>
                Loading representative frame...
              </div>
            )}
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              style={{
                display: imageLoaded ? 'block' : 'none',
                width: '100%',
                height: 'auto',
                cursor: mode === 'custom' ? 'crosshair' : 'default'
              }}
            />
          </div>

          {/* Canvas Help Notes */}
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <Info size={14} />
              {mode === 'custom' ? (
                <span>Click to place corner points. Click on the starting circle or press &ldquo;Complete Zone&rdquo; to close polygon.</span>
              ) : (
                <span>Deterministic camera view sectors (Region 1-4) will participate in all analytical metrics.</span>
              )}
            </div>

            {currentPolygon.length > 0 && mode === 'custom' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-secondary" onClick={clearCurrent} style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                  Cancel Points
                </button>
                <button
                  className="btn-primary"
                  onClick={completePolygon}
                  disabled={currentPolygon.length < 3}
                  style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                >
                  <Check size={12} />
                  Complete Zone ({currentPolygon.length} pts)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Zone Configuration Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {mode === 'custom' ? (
            <div className="glass-panel" style={{ padding: 20 }}>
              <h3 style={{ fontSize: '1rem', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={16} color="var(--emerald-600)" />
                Add Custom Polygon Zone
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    Zone Name
                  </label>
                  <input
                    type="text"
                    value={zoneName}
                    onChange={(e) => setZoneName(e.target.value)}
                    placeholder={`e.g. Apparel Aisle ${zones.length + 1}`}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    Category
                  </label>
                  <select
                    value={zoneCategory}
                    onChange={(e) => setZoneCategory(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.85rem',
                      background: '#FFFFFF'
                    }}
                  >
                    {PRESET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                    Zone Color
                  </label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {PRESET_COLORS.map(c => (
                      <div
                        key={c}
                        onClick={() => setZoneColor(c)}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: c,
                          cursor: 'pointer',
                          border: zoneColor === c ? '2px solid #0F172A' : '1px solid rgba(0,0,0,0.1)',
                          transform: zoneColor === c ? 'scale(1.15)' : 'none'
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div style={{
                  padding: 10,
                  background: '#F8FAFC',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.76rem',
                  color: 'var(--text-muted)'
                }}>
                  Vertices placed: <strong>{currentPolygon.length}</strong> (minimum 3 required)
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Grid3X3 size={18} color="#3B82F6" />
                <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
                  Automatic Region Settings
                </h3>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: 14 }}>
                The camera view is partitioned into 4 balanced sectors. You can optionally rename them:
              </p>

              {/* Editable Automatic Region Names (Section 8) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.keys(autoRegionNames).map((key) => (
                  <div key={key}>
                    <input
                      type="text"
                      value={autoRegionNames[key]}
                      onChange={(e) => setAutoRegionNames({ ...autoRegionNames, [key]: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.8rem'
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Zones List in Custom Mode */}
          {mode === 'custom' && (
            <div className="glass-panel" style={{ padding: 18 }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
                Active Zones ({zones.length})
              </h4>
              {zones.length === 0 ? (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  No custom zones defined. Click on the frame to draw polygon corners.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                  {zones.map((z) => (
                    <div
                      key={z.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: '#FFFFFF',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: z.color }} />
                        <div>
                          <div style={{ fontSize: '0.825rem', fontWeight: 600 }}>{z.name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{z.category}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteZone(z.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose-500)', padding: 4 }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Configuration Settings */}
          <div className="glass-panel-subtle" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Settings2 size={15} color="var(--text-secondary)" />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Analysis Configuration
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Frame Sampling:</span>
                <select
                  value={frameSkip}
                  onChange={(e) => setFrameSkip(Number(e.target.value))}
                  style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border-subtle)', fontSize: '0.75rem' }}
                >
                  <option value={1}>Every Frame (1x Thorough)</option>
                  <option value={2}>Every 2nd Frame (2x Fast CPU)</option>
                  <option value={3}>Every 3rd Frame (3x Rapid)</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Min Track Duration:</span>
                <select
                  value={minTrackDuration}
                  onChange={(e) => setMinTrackDuration(Number(e.target.value))}
                  style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border-subtle)', fontSize: '0.75rem' }}
                >
                  <option value={0.5}>0.5s (Sensitive)</option>
                  <option value={1.0}>1.0s (Standard Balanced)</option>
                  <option value={1.5}>1.5s (Strict Genuine Customers)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function hexToRgba(hex, alpha = 0.2) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) || 16;
  const g = parseInt(clean.substring(2, 4), 16) || 185;
  const b = parseInt(clean.substring(4, 6), 16) || 129;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawBadge(ctx, text, x, y, color) {
  ctx.font = 'bold 12px sans-serif';
  const width = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(x - width / 2 - 6, y - 10, width + 12, 20);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.strokeRect(x - width / 2 - 6, y - 10, width + 12, 20);

  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

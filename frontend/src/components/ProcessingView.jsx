import React from 'react';
import { Loader2, CheckCircle2, Circle, Clock, Cpu, Film, MapPin } from 'lucide-react';

const STAGES = [
  { id: 1, label: 'Video uploaded and verified', key: 'upload' },
  { id: 2, label: 'Extracting representative frames & metadata', key: 'extract' },
  { id: 3, label: 'Configuring spatial zones and regions', key: 'zones' },
  { id: 4, label: 'Person detection (YOLOv8) & Multi-Object Tracking (ByteTrack)', key: 'track' },
  { id: 5, label: 'Calculating zone dwell times and occupancy', key: 'dwell' },
  { id: 6, label: 'Generating 2D spatial foot-traffic heatmap', key: 'heatmap' },
  { id: 7, label: 'Evaluating bottlenecks & dead zones', key: 'diagnose' },
  { id: 8, label: 'Assembling customer journeys & trajectory metrics', key: 'journey' },
  { id: 9, label: 'Executive report & evidence-based interpretation', key: 'report' },
];

export default function ProcessingView({ progress, video }) {
  const currentStep = progress?.step || 1;
  const percent = progress?.percent || 0;
  const stageMsg = progress?.stage || 'Processing computer vision pipeline...';

  return (
    <div style={{ maxWidth: 760, margin: '60px auto', padding: '0 24px' }}>
      <div className="glass-panel" style={{ padding: '40px 36px', textAlign: 'center' }}>
        {/* Animated Icon */}
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'var(--emerald-50)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px auto',
          color: 'var(--emerald-600)',
          border: '1px solid rgba(16, 185, 129, 0.2)'
        }}>
          <Loader2 size={32} className="animate-spin" style={{ animation: 'spin 1.5s linear infinite' }} />
        </div>

        <h2 style={{ fontSize: '1.65rem', marginBottom: 8, color: 'var(--text-primary)' }}>
          Processing Video Analytics
        </h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: 520, margin: '0 auto 28px auto' }}>
          {stageMsg}
        </p>

        {/* Real Progress Bar */}
        <div style={{ marginBottom: 32 }}>
          <div style={{
            height: 8,
            background: '#F1F5F9',
            borderRadius: 4,
            overflow: 'hidden',
            border: '1px solid var(--border-subtle)'
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, Math.max(5, percent))}%`,
              background: 'linear-gradient(90deg, #10B981, #059669)',
              transition: 'width 0.4s ease'
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <span>Stage {currentStep} of {STAGES.length}</span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{percent}%</span>
          </div>
        </div>

        {/* Video Metadata Chip */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: '10px 18px',
          background: '#F8FAFC',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          marginBottom: 32,
          fontSize: '0.78rem',
          color: 'var(--text-secondary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Film size={14} color="#64748B" />
            <span>{video?.filename || 'video.mp4'}</span>
          </div>
          <span>&bull;</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={14} color="#64748B" />
            <span>{video?.metadata?.duration_seconds || 0}s duration</span>
          </div>
          <span>&bull;</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Cpu size={14} color="#64748B" />
            <span>{video?.metadata?.resolution || '720p'}</span>
          </div>
        </div>

        {/* Real Steps Checklist */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          textAlign: 'left',
          background: '#FFFFFF',
          padding: '24px 20px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)'
        }}>
          {STAGES.map((s) => {
            const isDone = currentStep > s.id || percent === 100;
            const isCurrent = currentStep === s.id && percent < 100;

            return (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  color: isDone ? 'var(--emerald-700)' : isCurrent ? 'var(--text-primary)' : 'var(--text-dim)',
                  fontWeight: isCurrent ? 600 : 400,
                  fontSize: '0.84rem'
                }}
              >
                {isDone ? (
                  <CheckCircle2 size={18} color="#10B981" />
                ) : isCurrent ? (
                  <div style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    border: '2px solid var(--emerald-500)',
                    borderTopColor: 'transparent',
                    animation: 'spin 1s linear infinite'
                  }} />
                ) : (
                  <Circle size={18} color="#CBD5E1" />
                )}
                <span>{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

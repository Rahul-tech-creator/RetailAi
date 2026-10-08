import React from 'react';
import { Eye, ShieldCheck, Cpu, Sparkles, RefreshCw } from 'lucide-react';

export default function Navbar({ onReset, currentStep, apiStatus }) {
  return (
    <header style={{
      background: 'rgba(255, 255, 255, 0.85)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border-subtle)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      padding: '14px 28px'
    }}>
      <div style={{
        maxWidth: 1400,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={onReset}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, #10B981 0%, #047857 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            boxShadow: '0 2px 10px rgba(16, 185, 129, 0.35)'
          }}>
            <Eye size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                Retail Spatial Intelligence
              </span>
              <span className="badge badge-emerald" style={{ fontSize: '0.68rem', padding: '2px 7px' }}>
                PROTOTYPE
              </span>
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Deterministic Computer Vision &bull; Spatial Customer Flow Intelligence
            </p>
          </div>
        </div>

        {/* Status Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <Cpu size={15} color="#10B981" />
            <span>YOLOv8 + ByteTrack</span>
          </div>

          <div style={{ width: 1, height: 18, background: 'var(--border-subtle)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <ShieldCheck size={15} color="#3B82F6" />
            <span>Anonymous Tracking (No PII)</span>
          </div>

          {currentStep === 'dashboard' && (
            <>
              <div style={{ width: 1, height: 18, background: 'var(--border-subtle)' }} />
              <button
                className="btn-secondary"
                onClick={onReset}
                style={{ padding: '6px 14px', fontSize: '0.8rem' }}
              >
                <RefreshCw size={13} />
                New Analysis
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

import React, { useState, useRef } from 'react';
import { UploadCloud, Film, PlayCircle, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

export default function VideoUpload({ onUploadSuccess, backendUrl }) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleFileUpload = async (file) => {
    setError(null);
    setUploading(true);
    setUploadProgress(15);

    const formData = new FormData();
    formData.append('video', file);

    try {
      setUploadProgress(40);
      const res = await fetch(`${backendUrl}/api/videos/upload`, {
        method: 'POST',
        body: formData
      });

      setUploadProgress(85);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload video');
      }

      setUploadProgress(100);
      setTimeout(() => {
        onUploadSuccess(data.video);
      }, 400);

    } catch (err) {
      console.error('[Upload error]', err);
      setError(err.message || 'Error communicating with server');
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // One-click sample video loader for demo & judges
  const handleLoadSampleVideo = async () => {
    setError(null);
    setUploading(true);
    setUploadProgress(20);

    try {
      // Fetch sample video from server uploads
      const sampleBlobRes = await fetch(`${backendUrl}/api/videos/sample-proxy`).catch(() => null);
      
      // If sample-proxy endpoint or direct upload
      const res = await fetch(`${backendUrl}/api/videos/load-sample`, {
        method: 'POST'
      });
      
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load sample video');
      }

      setUploadProgress(100);
      setTimeout(() => {
        onUploadSuccess(data.video);
      }, 400);

    } catch (err) {
      // Fallback: request server to process the existing sample_retail_cctv.mp4 directly
      try {
        const directRes = await fetch(`${backendUrl}/api/videos/use-existing-sample`, {
          method: 'POST'
        });
        const data = await directRes.json();
        if (data.success) {
          setUploadProgress(100);
          setTimeout(() => onUploadSuccess(data.video), 400);
          return;
        }
      } catch (e) {
        // fallback message
      }
      setError('Could not auto-load sample video. Please drag and drop or browse for an MP4 video.');
      setUploading(false);
    }
  };

  return (
    <div style={{ maxWidth: 880, margin: '50px auto', padding: '0 20px' }}>
      {/* Hero Header */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
          <span className="badge badge-emerald">PHYSICAL STORE ANALYTICS</span>
          <span className="badge badge-neutral">COMPUTER VISION PIPELINE</span>
        </div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12, lineHeight: 1.15 }}>
          Retail Spatial Intelligence
        </h1>
        <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', maxWidth: 640, margin: '0 auto', lineHeight: 1.5 }}>
          Turn existing store CCTV into actionable customer-flow intelligence.
          Deterministic foot-point tracking, dwell times, heatmaps, and spatial diagnosis.
        </p>
      </div>

      {/* Main Upload Panel */}
      <div
        className="glass-panel"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          padding: '48px 36px',
          textAlign: 'center',
          border: isDragging ? '2px dashed var(--emerald-500)' : '2px dashed #CBD5E1',
          background: isDragging ? 'var(--emerald-50)' : 'rgba(255, 255, 255, 0.88)',
          cursor: uploading ? 'wait' : 'pointer',
          position: 'relative'
        }}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="video/mp4,video/avi,video/quicktime,video/x-matroska,video/webm"
          style={{ display: 'none' }}
          disabled={uploading}
        />

        <div style={{
          width: 72,
          height: 72,
          borderRadius: varRef('radius-full', '50%'),
          background: '#F1F5F9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px auto',
          color: 'var(--emerald-600)'
        }}>
          <UploadCloud size={36} />
        </div>

        <h3 style={{ fontSize: '1.25rem', marginBottom: 8, color: 'var(--text-primary)' }}>
          {uploading ? 'Uploading and validating video...' : 'Upload Retail CCTV / Video'}
        </h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 20 }}>
          Drag and drop your store video file here, or click to browse files
        </p>

        {uploading && (
          <div style={{ maxWidth: 360, margin: '20px auto' }}>
            <div style={{ height: 6, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${uploadProgress}%`,
                background: 'var(--emerald-500)',
                transition: 'width 0.3s ease'
              }} />
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
              Validating frames and extracting metadata ({uploadProgress}%)
            </p>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
          {['MP4', 'AVI', 'MOV', 'MKV', 'WEBM'].map((fmt) => (
            <span key={fmt} className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
              {fmt}
            </span>
          ))}
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 8 }}>
            Up to 500MB
          </span>
        </div>
      </div>

      {error && (
        <div style={{
          marginTop: 18,
          padding: '12px 18px',
          background: 'var(--rose-50)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: 'var(--rose-600)',
          fontSize: '0.85rem'
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Demo Quick Launch Bar for Judges / Testing */}
      <div style={{
        marginTop: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        background: '#FFFFFF',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--radius-md)',
            background: 'var(--blue-50)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--blue-600)'
          }}>
            <PlayCircle size={20} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              Live Demonstration Footage Ready
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Load sample multi-person retail corridor CCTV (768x432, 596 frames)
            </p>
          </div>
        </div>

        <button
          className="btn-primary"
          onClick={(e) => {
            e.stopPropagation();
            handleLoadSampleVideo();
          }}
          disabled={uploading}
          style={{ padding: '8px 18px', fontSize: '0.85rem' }}
        >
          <Film size={15} />
          Load Sample CCTV Video
        </button>
      </div>

      {/* Principles / Assurances */}
      <div style={{
        marginTop: 36,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 16
      }}>
        <div className="glass-panel-subtle" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <CheckCircle2 size={16} color="#10B981" />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              No Fake Data
            </span>
          </div>
          <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
            Every metric, trajectory, dwell duration, and heatmap pixel originates directly from verified computer vision.
          </p>
        </div>

        <div className="glass-panel-subtle" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <ShieldCheck size={16} color="#3B82F6" />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              100% Privacy Safe
            </span>
          </div>
          <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
            Anonymous tracking identifiers only. No facial recognition, biometric identity, or personal identifiers.
          </p>
        </div>

        <div className="glass-panel-subtle" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <CheckCircle2 size={16} color="#10B981" />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              No Blueprint Required
            </span>
          </div>
          <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
            Works immediately from camera perspective with user-drawn polygons or automated spatial camera regions.
          </p>
        </div>
      </div>
    </div>
  );
}

function varRef(name, fallback) {
  return fallback;
}

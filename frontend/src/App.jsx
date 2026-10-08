import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import VideoUpload from './components/VideoUpload';
import ZoneEditor from './components/ZoneEditor';
import ProcessingView from './components/ProcessingView';
import Dashboard from './components/Dashboard';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function App() {
  const [currentStep, setCurrentStep] = useState('upload'); // 'upload', 'setup', 'processing', 'dashboard'
  const [videoData, setVideoData] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [progress, setProgress] = useState({ stage: 'Initializing...', percent: 0, step: 0 });
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState(null);
  const [apiStatus, setApiStatus] = useState('checking');

  const pollIntervalRef = useRef(null);

  // Check backend health on mount
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/health`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'ok') setApiStatus('online');
      })
      .catch(() => setApiStatus('offline'));
  }, []);

  // Poll job status when in 'processing' step
  useEffect(() => {
    if (currentStep === 'processing' && jobId) {
      pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await fetch(`${BACKEND_URL}/api/analysis/${jobId}/status`);
          const statusData = await res.json();

          if (statusData.status === 'FAILED') {
            clearInterval(pollIntervalRef.current);
            setError(statusData.error || 'Computer vision processing failed');
            setCurrentStep('setup');
            return;
          }

          setProgress({
            stage: statusData.stage || 'Processing...',
            percent: statusData.percent || 0,
            step: statusData.step || 1
          });

          if (statusData.status === 'COMPLETED') {
            clearInterval(pollIntervalRef.current);
            // Fetch final analytics results
            const resultsRes = await fetch(`${BACKEND_URL}/api/analysis/${jobId}/results`);
            const resultsData = await resultsRes.json();
            setAnalytics(resultsData);
            setCurrentStep('dashboard');
          }
        } catch (err) {
          console.warn('[Polling Error]', err.message);
        }
      }, 1500);

      return () => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      };
    }
  }, [currentStep, jobId]);

  // Handlers
  const handleUploadSuccess = (video) => {
    setVideoData(video);
    setError(null);
    setCurrentStep('setup');
  };

  const handleStartAnalysis = async (customZones, options) => {
    if (!videoData?.id) return;
    setError(null);
    setProgress({ stage: 'Initializing computer vision pipeline', percent: 5, step: 1 });
    setCurrentStep('processing');

    try {
      const res = await fetch(`${BACKEND_URL}/api/analysis/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: videoData.id,
          customZones: customZones || null,
          frameSkip: options?.frameSkip || 2,
          minTrackDuration: options?.minTrackDuration || 1.0
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to start analysis');
      }

      setJobId(data.jobId);

    } catch (err) {
      console.error('[Start Error]', err);
      setError(err.message || 'Error communicating with backend server');
      setCurrentStep('setup');
    }
  };

  const handleReset = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setCurrentStep('upload');
    setVideoData(null);
    setJobId(null);
    setProgress({ stage: '', percent: 0, step: 0 });
    setAnalytics(null);
    setError(null);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        onReset={handleReset}
        currentStep={currentStep}
        apiStatus={apiStatus}
      />

      <main style={{ flex: 1, paddingBottom: 60 }}>
        {error && (
          <div style={{
            maxWidth: 880,
            margin: '20px auto 0 auto',
            padding: '14px 20px',
            background: 'var(--rose-50)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--rose-600)',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'var(--rose-600)' }}
            >
              &times;
            </button>
          </div>
        )}

        {currentStep === 'upload' && (
          <VideoUpload
            onUploadSuccess={handleUploadSuccess}
            backendUrl={BACKEND_URL}
          />
        )}

        {currentStep === 'setup' && videoData && (
          <ZoneEditor
            video={videoData}
            onStartAnalysis={handleStartAnalysis}
            onBack={() => setCurrentStep('upload')}
            backendUrl={BACKEND_URL}
          />
        )}

        {currentStep === 'processing' && (
          <ProcessingView
            progress={progress}
            video={videoData}
          />
        )}

        {currentStep === 'dashboard' && analytics && (
          <Dashboard
            analytics={analytics}
            backendUrl={BACKEND_URL}
            onNewAnalysis={handleReset}
          />
        )}
      </main>

      <footer style={{
        textAlign: 'center',
        padding: '20px',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        borderTop: '1px solid var(--border-subtle)',
        background: '#FFFFFF'
      }}>
        <span>Retail Spatial Intelligence Platform &bull; Code for Truth. AI for Interpretation. &bull; Anonymous Tracking Only (No PII)</span>
      </footer>
    </div>
  );
}

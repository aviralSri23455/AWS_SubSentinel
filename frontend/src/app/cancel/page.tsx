'use client';

import { useState } from 'react';
import { Upload, Shield, AlertTriangle, Mail, Copy, Loader2, CheckCircle } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

interface DarkPattern {
  patternType: string;
  confidence: number;
  evidence: string;
  severity: number;
}

interface AnalysisResult {
  reportId: string;
  patterns: DarkPattern[];
  bypassGuide: {
    steps: Array<{
      stepNumber: number;
      action: string;
      description: string;
    }>;
  };
  negotiationDraft?: {
    emailDraft: string;
    leverage: string[];
    successRate: number;
  };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/v1';

export default function CancelPage() {
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editedDraft, setEditedDraft] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setError(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;

    setAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onload = async () => {
        const base64Data = reader.result?.toString().split(',')[1];

        const response = await fetch(`${API_URL}/defender/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image: base64Data,
            fileName: file.name,
            provider: 'Unknown',
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Analysis failed');
        }

        setResult(data);
        if (data.negotiationDraft?.emailDraft) {
          setEditedDraft(data.negotiationDraft.emailDraft);
        }
      };

      reader.onerror = () => {
        throw new Error('Failed to read file');
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const getPatternColor = (type: string) => {
    const colors: Record<string, string> = {
      OBSTRUCTION: '#ef4444',
      CONFUSION: '#f97316',
      FORCED_LABOR: '#dc2626',
      SHAME_TACTICS: '#eab308',
      MISDIRECTION: '#f59e0b',
    };
    return colors[type] || '#6366f1';
  };

  const getPatternIcon = (type: string) => {
    const icons: Record<string, string> = {
      OBSTRUCTION: '🚫',
      CONFUSION: '😵',
      FORCED_LABOR: '⛓️',
      SHAME_TACTICS: '😔',
      MISDIRECTION: '🎯',
    };
    return icons[type] || '⚠️';
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: 260, display: 'flex', flexDirection: 'column' }}>
        <Header />
        <div style={{ padding: 'var(--spacing-xl)' }}>
          <div style={{ marginBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>
              🛡️ Dark Pattern Defender
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Upload cancellation screenshot for AI-powered dark pattern detection
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: result ? '1fr 1fr' : '1fr', gap: 'var(--spacing-lg)' }}>
            {/* Upload Section */}
            <div className="glass-card">
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 'var(--spacing-md)' }}>
                Upload Screenshot
              </h3>

              <label
                htmlFor="file-upload"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 240,
                  border: '2px dashed var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  marginBottom: 'var(--spacing-md)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                  e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {file ? (
                  <>
                    <CheckCircle style={{ width: 48, height: 48, color: 'var(--color-success)', marginBottom: '1rem' }} />
                    <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{file.name}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </>
                ) : (
                  <>
                    <Upload style={{ width: 48, height: 48, color: 'var(--color-primary)', marginBottom: '1rem' }} />
                    <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Click to upload</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PNG, JPG (max 10MB)</p>
                  </>
                )}
                <input
                  id="file-upload"
                  type="file"
                  style={{ display: 'none' }}
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </label>

              <button
                onClick={handleAnalyze}
                disabled={!file || analyzing}
                className="btn btn-primary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                {analyzing ? (
                  <>
                    <Loader2 style={{ width: 18, height: 18 }} className="animate-spin" />
                    Analyzing with Bedrock...
                  </>
                ) : (
                  <>
                    <Shield style={{ width: 18, height: 18 }} />
                    Analyze Dark Patterns
                  </>
                )}
              </button>

              {error && (
                <div style={{
                  marginTop: 'var(--spacing-md)',
                  padding: 'var(--spacing-md)',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  color: '#ef4444',
                  fontSize: '0.85rem',
                }}>
                  <AlertTriangle style={{ width: 16, height: 16, display: 'inline', marginRight: '0.5rem' }} />
                  {error}
                </div>
              )}

              {/* Pipeline Visualization */}
              <div style={{ marginTop: 'var(--spacing-lg)', paddingTop: 'var(--spacing-lg)', borderTop: '1px solid var(--border-color)' }}>
                <h4 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 'var(--spacing-sm)' }}>
                  Processing Pipeline
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  <span>S3</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border-color)', margin: '0 0.5rem' }} />
                  <span>Rekognition</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border-color)', margin: '0 0.5rem' }} />
                  <span>Bedrock Vision</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border-color)', margin: '0 0.5rem' }} />
                  <span>DynamoDB</span>
                </div>
              </div>
            </div>

            {/* Results Section */}
            {result && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                {/* Dark Pattern Scores */}
                <div className="glass-card">
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 'var(--spacing-md)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertTriangle style={{ width: 20, height: 20, color: '#ef4444' }} />
                    Detected Dark Patterns
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {result.patterns.map((pattern, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: 'var(--spacing-md)',
                          background: `${getPatternColor(pattern.patternType)}10`,
                          border: `1px solid ${getPatternColor(pattern.patternType)}30`,
                          borderRadius: 'var(--radius-md)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1.25rem' }}>{getPatternIcon(pattern.patternType)}</span>
                            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                              {pattern.patternType.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: '1.25rem',
                              fontWeight: 900,
                              fontFamily: 'var(--font-mono)',
                              color: getPatternColor(pattern.patternType),
                            }}
                          >
                            {Math.round(pattern.confidence * 100)}%
                          </span>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {pattern.evidence}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bypass Guide */}
                {result.bypassGuide?.steps && result.bypassGuide.steps.length > 0 && (
                  <div className="glass-card">
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 'var(--spacing-md)' }}>
                      🛠️ Bypass Guide
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {result.bypassGuide.steps.map((step) => (
                        <div
                          key={step.stepNumber}
                          style={{
                            display: 'flex',
                            gap: '0.75rem',
                            padding: 'var(--spacing-sm)',
                            background: 'var(--bg-glass)',
                            borderRadius: 'var(--radius-sm)',
                          }}
                        >
                          <div
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              background: 'var(--color-primary)',
                              color: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {step.stepNumber}
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                              {step.action}
                            </p>
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {step.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Negotiation Draft Panel */}
          {result?.negotiationDraft && (
            <div className="glass-card" style={{ marginTop: 'var(--spacing-lg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Mail style={{ width: 20, height: 20 }} />
                  AI-Generated Negotiation Email
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: 'var(--color-success)' }}>
                      {result.negotiationDraft.successRate}%
                    </div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Success Rate
                    </div>
                  </div>
                </div>
              </div>

              <textarea
                value={editedDraft}
                onChange={(e) => setEditedDraft(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: 200,
                  padding: 'var(--spacing-md)',
                  background: 'var(--bg-glass)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  lineHeight: 1.6,
                  fontFamily: 'var(--font-sans)',
                  resize: 'vertical',
                  marginBottom: 'var(--spacing-md)',
                }}
              />

              {/* Leverage Points */}
              {result.negotiationDraft.leverage && result.negotiationDraft.leverage.length > 0 && (
                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                  <h4 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 'var(--spacing-sm)' }}>
                    Leverage Points
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {result.negotiationDraft.leverage.map((point, idx) => (
                      <span
                        key={idx}
                        style={{
                          padding: '0.35rem 0.75rem',
                          background: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid rgba(16, 185, 129, 0.2)',
                          borderRadius: 'var(--radius-full)',
                          fontSize: '0.72rem',
                          color: 'var(--color-success)',
                        }}
                      >
                        ✓ {point}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => copyToClipboard(editedDraft)}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Copy style={{ width: 16, height: 16 }} />
                  Copy Email
                </button>
                <button className="btn btn-secondary">
                  📧 Send via Gmail
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

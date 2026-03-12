'use client';

import { useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Subscription {
  subscriptionId: string;
  provider: string;
  category: string;
  amount: number;
  currency: string;
  renewalDate: string;
  frequency: string;
  status: string;
}

interface UploadResponse {
  subscriptionId: string;
  subscription: Subscription;
  message: string;
}

interface DarkPatternAnalysisResult {
  reportId: string;
  provider: string;
  hostilityScore: number;
  patterns: Array<{
    patternType: string;
    description: string;
    confidence: number;
    severity: number;
    evidence?: string;
  }>;
  bypassGuide: string[];
  toonTokensSaved: number;
  awsServices: string[];
  message?: string;
  timestamp?: string;
}

export default function ReceiptUploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [darkPatternResult, setDarkPatternResult] = useState<DarkPatternAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);

  // Connect to SSE for real-time updates
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/v1';
    const eventSource = new EventSource(`${apiUrl}/events`);

    eventSource.onopen = () => {
      console.log('✅ Connected to real-time events');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📡 SSE Event received:', data);

        // Handle pipeline progress events
        if (data.type === 'pipeline_progress') {
          const stage = data.data?.stage || '';
          const status = data.data?.status || '';

          if (status === 'processing') {
            const stageMessages: Record<string, string> = {
              's3_upload': '📤 Uploading to S3...',
              'text_extraction': '🔍 Extracting text with Textract...',
              'ai_analysis': '🤖 Analyzing with Bedrock AI...',
              'dynamodb_storage': '💾 Saving to DynamoDB...',
            };
            setProcessingStage(stageMessages[stage] || 'Processing...');
          } else if (status === 'success' && stage === 'complete') {
            setProcessingStage('✅ Complete! Redirecting to subscriptions...');
            setRedirectCountdown(3);
          }
        }

        // Handle subscription added event
        if (data.type === 'subscription_added') {
          console.log('🆕 New subscription detected!');
          setProcessingStage('✅ Subscription added! Redirecting...');
          setRedirectCountdown(3);
        }
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
      }
    };

    eventSource.onerror = (error) => {
      console.error('❌ SSE connection error:', error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // Countdown and redirect
  useEffect(() => {
    if (redirectCountdown !== null && redirectCountdown > 0) {
      const timer = setTimeout(() => {
        setRedirectCountdown(redirectCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (redirectCountdown === 0) {
      router.push('/dark-patterns?refresh=true');
    }
  }, [redirectCountdown, router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setDarkPatternResult(null);
      setError(null);
      setProcessingStage('');
      setRedirectCountdown(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setResult(null);
    setDarkPatternResult(null);
    setProcessingStage('📤 Uploading screenshot...');

    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // strip data: prefix
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setProcessingStage('🔍 Analyzing with Rekognition...');

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/dark-patterns/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64,
          fileName: file.name,
          provider: 'unknown', // Will be auto-detected
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      // Store dark pattern analysis result
      setDarkPatternResult(data);
      setProcessingStage('✅ Analysis complete!');
      
      // Set redirect countdown to navigate to dark patterns page
      setRedirectCountdown(5);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMsg);
      setProcessingStage('');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Screenshot Upload</h1>
          <p className="text-gray-300">Upload cancellation flow screenshots for dark pattern analysis</p>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
          {/* Upload Area */}
          <div className="mb-6">
            <label
              htmlFor="file-upload"
              className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-purple-400 rounded-xl cursor-pointer hover:bg-white/5 transition-colors"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {file ? (
                  <>
                    <FileText className="w-16 h-16 text-purple-400 mb-4" />
                    <p className="text-white font-medium">{file.name}</p>
                    <p className="text-gray-400 text-sm">{(file.size / 1024).toFixed(2)} KB</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-16 h-16 text-purple-400 mb-4" />
                    <p className="text-white font-medium mb-2">Click to upload screenshot</p>
                    <p className="text-gray-400 text-sm">PNG or JPG (max 10MB)</p>
                  </>
                )}
              </div>
              <input
                id="file-upload"
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
              />
            </label>
          </div>

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Upload & Analyze
              </>
            )}
          </button>

          {/* Processing Stage */}
          {processingStage && (
            <div className="mt-4 bg-blue-500/20 border border-blue-500 rounded-xl p-4 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin flex-shrink-0" />
              <div className="flex-1">
                <p className="text-blue-400 font-medium">{processingStage}</p>
                {redirectCountdown !== null && redirectCountdown > 0 && (
                  <p className="text-blue-300 text-sm mt-1">
                    Redirecting in {redirectCountdown}s...
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-6 bg-red-500/20 border border-red-500 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-400 font-medium">Upload Failed</p>
                <p className="text-red-300 text-sm mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Success Result */}
          {darkPatternResult && (
            <div className="mt-6 bg-green-500/20 border border-green-500 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="w-6 h-6 text-green-400" />
                <h3 className="text-xl font-semibold text-white">Dark Pattern Analysis Complete!</h3>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <p className="text-gray-400">Provider</p>
                  <p className="text-white font-medium">{darkPatternResult.provider}</p>
                </div>
                <div>
                  <p className="text-gray-400">Hostility Score</p>
                  <p className="text-white font-medium">{darkPatternResult.hostilityScore.toFixed(1)}/10</p>
                </div>
                <div>
                  <p className="text-gray-400">Patterns Found</p>
                  <p className="text-white font-medium">{darkPatternResult.patterns.length}</p>
                </div>
                <div>
                  <p className="text-gray-400">TOON Tokens Saved</p>
                  <p className="text-white font-medium">{darkPatternResult.toonTokensSaved}</p>
                </div>
              </div>

              {/* Patterns List */}
              {darkPatternResult.patterns.length > 0 && (
                <div className="mt-4 pt-4 border-t border-green-500/30">
                  <h4 className="text-lg font-semibold text-white mb-2">Detected Patterns:</h4>
                  <div className="space-y-2">
                    {darkPatternResult.patterns.map((pattern, index) => (
                      <div key={index} className="bg-white/5 rounded-lg p-3">
                        <div className="flex justify-between items-center">
                          <span className="text-white font-medium">{pattern.patternType}</span>
                          <span className="text-yellow-400 text-sm">
                            Confidence: {(pattern.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-gray-300 text-sm mt-1">{pattern.description}</p>
                        {pattern.evidence && (
                          <p className="text-gray-400 text-xs mt-1">Evidence: {pattern.evidence}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bypass Guide */}
              {darkPatternResult.bypassGuide.length > 0 && (
                <div className="mt-4 pt-4 border-t border-green-500/30">
                  <h4 className="text-lg font-semibold text-white mb-2">Bypass Guide:</h4>
                  <ul className="space-y-2">
                    {darkPatternResult.bypassGuide.map((step, index) => (
                      <li key={index} className="text-gray-300 text-sm flex items-start gap-2">
                        <span className="text-green-400">{index + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-green-500/30">
                <p className="text-green-300 text-sm">
                  Report ID: {darkPatternResult.reportId}
                </p>
                {redirectCountdown !== null && redirectCountdown > 0 && (
                  <p className="text-green-300 text-sm mt-1">
                    Redirecting to Dark Patterns page in {redirectCountdown}s...
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Pipeline Visualization */}
        <div className="mt-8 bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">Processing Pipeline</h3>
          <div className="flex items-center justify-between text-sm">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mb-2">
                <Upload className="w-6 h-6 text-white" />
              </div>
              <p className="text-gray-300">Upload</p>
            </div>
            <div className="flex-1 h-0.5 bg-purple-600 mx-2"></div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mb-2">
                <span className="text-white font-bold">S3</span>
              </div>
              <p className="text-gray-300">Storage</p>
            </div>
            <div className="flex-1 h-0.5 bg-purple-600 mx-2"></div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mb-2">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <p className="text-gray-300">Textract</p>
            </div>
            <div className="flex-1 h-0.5 bg-purple-600 mx-2"></div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mb-2">
                <span className="text-white font-bold">AI</span>
              </div>
              <p className="text-gray-300">Nova Pro</p>
            </div>
            <div className="flex-1 h-0.5 bg-purple-600 mx-2"></div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mb-2">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <p className="text-gray-300">DynamoDB</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

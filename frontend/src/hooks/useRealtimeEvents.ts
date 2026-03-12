// ─── Real-Time Events Hook (SSE) ────────────────────────────────
// Connects to backend SSE endpoint for real-time pipeline updates

'use client';

import { useEffect, useCallback, useRef, useState } from 'react';

export type EventType =
    | 'screenshot_uploaded'
    | 'screenshot_analyzing'
    | 'screenshot_complete'
    | 'patterns_detected'
    | 'dark_pattern_added'
    | 'gmail_scan_started'
    | 'gmail_scan_complete'
    | 'subscription_added'
    | 'agent_activity'
    | 'pipeline_progress'
    | 'negotiation_drafted'
    | 'calendar_insight'
    | 'connected';

export interface RealtimeEvent {
    type: EventType;
    data: Record<string, any>;
    timestamp: string;
}

export interface PipelineProgress {
    stage: 'upload' | 's3' | 'rekognition' | 'ai_vision' | 'dynamodb';
    status: 'started' | 'uploading' | 'analyzing' | 'complete' | 'error';
    provider?: string;
    details?: Record<string, any>;
}

export interface AgentActivity {
    agent: string;
    action: string;
    status: string;
    timestamp: string;
    details?: Record<string, any>;
}

export interface ScreenshotAnalysis {
    reportId: string;
    provider: string;
    hostilityScore: number;
    patternsCount: number;
    timestamp: string;
}

export function useRealtimeEvents() {
    const [connected, setConnected] = useState(false);
    const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
    const [pipelineProgress, setPipelineProgress] = useState<PipelineProgress | null>(null);
    const [agentActivities, setAgentActivities] = useState<AgentActivity[]>([]);
    const [latestAnalysis, setLatestAnalysis] = useState<ScreenshotAnalysis | null>(null);
    const eventSourceRef = useRef<EventSource | null>(null);
    const listenersRef = useRef<Map<EventType, Set<(data: any) => void>>>(new Map());

    // Subscribe to specific event types
    const subscribe = useCallback((eventType: EventType, callback: (data: any) => void) => {
        if (!listenersRef.current.has(eventType)) {
            listenersRef.current.set(eventType, new Set());
        }
        listenersRef.current.get(eventType)!.add(callback);

        // Return unsubscribe function
        return () => {
            listenersRef.current.get(eventType)?.delete(callback);
        };
    }, []);

    // Handle incoming events
    const handleEvent = useCallback((event: RealtimeEvent) => {
        setLastEvent(event);

        // Update specific state based on event type
        switch (event.type) {
            case 'pipeline_progress':
                setPipelineProgress({
                    stage: event.data.stage,
                    status: event.data.status,
                    provider: event.data.provider,
                    details: event.data,
                });
                break;

            case 'agent_activity':
                setAgentActivities(prev => [
                    {
                        agent: event.data.agent,
                        action: event.data.action,
                        status: event.data.status,
                        timestamp: event.timestamp,
                        details: event.data,
                    },
                    ...prev.slice(0, 49), // Keep last 50
                ]);
                break;

            case 'screenshot_complete':
                setLatestAnalysis({
                    reportId: event.data.reportId,
                    provider: event.data.provider,
                    hostilityScore: event.data.hostilityScore,
                    patternsCount: event.data.patternsCount,
                    timestamp: event.timestamp,
                });
                break;
        }

        // Notify subscribers
        const listeners = listenersRef.current.get(event.type);
        if (listeners) {
            listeners.forEach(callback => callback(event.data));
        }
    }, []);

    // Connect to SSE endpoint
    useEffect(() => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/v1';
        const eventSource = new EventSource(`${apiUrl}/events`);

        eventSource.onopen = () => {
            console.log('✅ Connected to real-time events');
            setConnected(true);
        };

        eventSource.onmessage = (e) => {
            try {
                const event: RealtimeEvent = JSON.parse(e.data);
                handleEvent(event);
            } catch (err) {
                console.error('Failed to parse SSE event:', err);
            }
        };

        eventSource.onerror = (err) => {
            console.error('SSE connection error:', err);
            setConnected(false);
            eventSource.close();
        };

        eventSourceRef.current = eventSource;

        return () => {
            eventSource.close();
            setConnected(false);
        };
    }, [handleEvent]);

    return {
        connected,
        lastEvent,
        pipelineProgress,
        agentActivities,
        latestAnalysis,
        subscribe,
    };
}

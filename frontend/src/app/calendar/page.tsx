'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

interface CalendarEvent {
    id: string;
    type: 'vacation' | 'job_change' | 'birthday' | 'move' | 'graduation' | 'relocation' | 'family';
    title: string;
    date: string;
    icon: string;
    affectedSubs: string[];
    suggestion: string;
    savings: number;
    confidence: number;
    status: 'pending' | 'applied' | 'dismissed';
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/v1';

export default function CalendarPage() {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [calendarConnected, setCalendarConnected] = useState(false);
    const [eventsScanned, setEventsScanned] = useState(0);

    useEffect(() => {
        fetchCalendarInsights();

        const eventSource = new EventSource(`${API_URL}/events`);

        eventSource.addEventListener('message', (event) => {
            try {
                const payload = JSON.parse(event.data);
                if (payload.type === 'agent_activity' &&
                    payload.data?.agent === 'Calendar' &&
                    payload.data?.status === 'success') {
                    fetchCalendarInsights();
                }
            } catch (parseError) {
                console.error('SSE parse error:', parseError);
            }
        });

        return () => {
            eventSource.close();
        };
    }, []);

    const fetchCalendarInsights = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await fetch(`${API_URL}/calendar/insights`, {
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch calendar insights: ${response.statusText}`);
            }

            const data = await response.json();
            const insights = data.insights || [];
            setCalendarConnected(Boolean(data.connected));
            setEventsScanned(Number(data.eventsFound || 0));
            setStatusMessage(data.message || null);

            const mappedEvents: CalendarEvent[] = [];

            insights.forEach((insight: any) => {
                const lifeEvents = insight.lifeEvents || [];
                const suggestions = insight.suggestions || [];

                lifeEvents.forEach((lifeEvent: any) => {
                    const relatedSuggestions = suggestions.filter(
                        (suggestion: any) => suggestion.lifeEventType === lifeEvent.type,
                    );

                    const totalSavings = relatedSuggestions.reduce(
                        (sum: number, suggestion: any) => sum + Number(suggestion.estimatedSavings || 0),
                        0,
                    );

                    const affectedProviders = relatedSuggestions
                        .map((suggestion: any) => suggestion.provider)
                        .filter(Boolean);

                    const suggestionText = relatedSuggestions.length > 0
                        ? relatedSuggestions[0].reason
                        : lifeEvent.description;

                    mappedEvents.push({
                        id: `${insight.userId}-${lifeEvent.type}-${lifeEvent.startDate}`,
                        type: lifeEvent.type,
                        title: lifeEvent.description || `${lifeEvent.type} detected`,
                        date: `${lifeEvent.startDate} to ${lifeEvent.endDate}`,
                        icon: getEventIcon(lifeEvent.type),
                        affectedSubs: affectedProviders.length > 0 ? affectedProviders : ['Subscriptions'],
                        suggestion: suggestionText,
                        savings: totalSavings,
                        confidence: lifeEvent.confidence || 0,
                        status: 'pending',
                    });
                });
            });

            setEvents(mappedEvents);
        } catch (fetchError) {
            console.error('Error fetching calendar insights:', fetchError);
            setError(fetchError instanceof Error ? fetchError.message : 'Failed to load calendar insights');
            setEvents([]);
        } finally {
            setIsLoading(false);
            setIsLoaded(true);
        }
    };

    const getEventIcon = (type: string): string => {
        const icons: Record<string, string> = {
            vacation: '🏖️',
            job_change: '💼',
            birthday: '🎂',
            move: '📦',
            relocation: '📦',
            graduation: '🎓',
            family: '👨‍👩‍👧‍👦',
            travel: '✈️',
            conference: '🎤',
            wedding: '💍',
        };
        return icons[type] || '📅';
    };

    const totalPotentialSavings = events
        .filter((event) => event.status === 'pending')
        .reduce((sum, event) => sum + event.savings, 0);

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <Sidebar />
            <main style={{ flex: 1, marginLeft: 260, display: 'flex', flexDirection: 'column' }}>
                <Header />
                <div style={{ padding: 'var(--spacing-xl)', opacity: isLoaded ? 1 : 0, transition: 'opacity 0.5s' }}>
                    {isLoading && (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                            <p>Loading calendar insights from backend...</p>
                        </div>
                    )}

                    {error && !isLoading && (
                        <div className="glass-card" style={{ padding: 'var(--spacing-lg)', marginBottom: 'var(--spacing-lg)', borderLeft: '3px solid var(--color-danger)' }}>
                            <p style={{ color: 'var(--color-danger)', fontWeight: 600 }}>⚠️ Error: {error}</p>
                            <button onClick={fetchCalendarInsights} className="btn btn-primary" style={{ marginTop: '0.5rem', fontSize: '0.78rem' }}>
                                Retry
                            </button>
                        </div>
                    )}

                    {!isLoading && (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-xl)' }}>
                                <div>
                                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>📅 Calendar Reasoner</h2>
                                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                        Life events {'->'} proactive subscription optimizations • ${totalPotentialSavings.toFixed(2)} potential savings
                                    </p>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <span className="aws-badge">AWS Bedrock</span>
                                    <button onClick={fetchCalendarInsights} className="btn btn-primary" style={{ fontSize: '0.78rem' }}>
                                        Refresh
                                    </button>
                                    <button onClick={fetchCalendarInsights} className="btn btn-secondary" style={{ fontSize: '0.78rem' }}>
                                        Sync Google Calendar
                                    </button>
                                </div>
                            </div>

                            {statusMessage && (
                                <div className="glass-card" style={{ padding: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)', borderLeft: `3px solid ${calendarConnected ? 'var(--color-success)' : 'var(--color-warning)'}` }}>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        {statusMessage}
                                    </p>
                                    <p style={{ margin: '0.35rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                        {calendarConnected
                                            ? `${eventsScanned} upcoming calendar event(s) scanned.`
                                            : 'Calendar OAuth is not configured yet. Run: go run cmd/oauth/main.go'}
                                    </p>
                                </div>
                            )}

                            {events.length === 0 && !error && (
                                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
                                    <p style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                        No calendar insights available
                                    </p>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Connect your Google Calendar to detect life events and optimize subscriptions
                                    </p>
                                </div>
                            )}

                            {events.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                                    {events.map((event, index) => (
                                        <div
                                            key={event.id || `cal-event-${index}`}
                                            className="glass-card"
                                            style={{ animation: `fadeIn 0.4s ease-out ${index * 80}ms backwards` }}
                                        >
                                            <div style={{ display: 'flex', gap: 'var(--spacing-lg)' }}>
                                                <div style={{
                                                    width: 52,
                                                    height: 52,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '1.5rem',
                                                    background: 'var(--bg-glass)',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: 'var(--radius-md)',
                                                    flexShrink: 0,
                                                }}>
                                                    {event.icon}
                                                </div>

                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                                                        <div>
                                                            <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.1rem' }}>{event.title}</h4>
                                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{event.date}</span>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                            <div style={{ textAlign: 'right' }}>
                                                                <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--color-success)' }}>
                                                                    ${event.savings.toFixed(2)}
                                                                </div>
                                                                <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Potential Save</div>
                                                            </div>
                                                            <div style={{ textAlign: 'right' }}>
                                                                <div style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-primary-light)' }}>
                                                                    {(event.confidence * 100).toFixed(0)}%
                                                                </div>
                                                                <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Conf</div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', lineHeight: 1.5 }}>
                                                        {event.suggestion}
                                                    </p>

                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                        {event.affectedSubs.map((subscription, subscriptionIndex) => (
                                                            <span key={`${subscription}-${subscriptionIndex}`} style={{
                                                                fontSize: '0.65rem',
                                                                fontWeight: 600,
                                                                padding: '0.15rem 0.5rem',
                                                                borderRadius: 'var(--radius-full)',
                                                                background: 'rgba(99, 102, 241, 0.08)',
                                                                color: 'var(--color-primary-light)',
                                                                border: '1px solid rgba(99, 102, 241, 0.15)',
                                                            }}>
                                                                {subscription}
                                                            </span>
                                                        ))}
                                                        <span style={{
                                                            marginLeft: 'auto',
                                                            fontSize: '0.62rem',
                                                            fontWeight: 600,
                                                            padding: '0.15rem 0.5rem',
                                                            borderRadius: 'var(--radius-full)',
                                                            textTransform: 'uppercase',
                                                            background: event.status === 'applied' ? 'rgba(16, 185, 129, 0.1)' : event.status === 'dismissed' ? 'rgba(100,116,139,0.1)' : 'rgba(99, 102, 241, 0.1)',
                                                            color: event.status === 'applied' ? 'var(--color-success)' : event.status === 'dismissed' ? 'var(--text-muted)' : 'var(--color-primary-light)',
                                                        }}>
                                                            {event.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}

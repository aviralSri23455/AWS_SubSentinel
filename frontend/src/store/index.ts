// ─── SubSentinel Zustand State Store ──────────────────────────
// Central state management for dashboard

import { create } from 'zustand';
import type { Subscription, DarkPatternReport, AgentActivity, AgentStatus, FinancialScore, TOONMetrics } from '@/types';

interface SubSentinelState {
    // ─── Subscriptions ───────────────────────────
    subscriptions: Subscription[];
    isLoadingSubscriptions: boolean;
    setSubscriptions: (subs: Subscription[]) => void;
    setLoadingSubscriptions: (loading: boolean) => void;

    // ─── Dark Patterns ──────────────────────────
    darkPatternReports: DarkPatternReport[];
    setDarkPatternReports: (reports: DarkPatternReport[]) => void;

    // ─── Agent Activity ─────────────────────────
    activities: AgentActivity[];
    addActivity: (activity: AgentActivity) => void;
    agentStatuses: Record<string, AgentStatus>;
    setAgentStatus: (agent: string, status: AgentStatus) => void;

    // ─── Financial Score ────────────────────────
    financialScore: FinancialScore | null;
    setFinancialScore: (score: FinancialScore) => void;

    // ─── TOON Metrics ──────────────────────────
    toonMetrics: TOONMetrics | null;
    setToonMetrics: (metrics: TOONMetrics) => void;

    // ─── UI State ──────────────────────────────
    sidebarOpen: boolean;
    toggleSidebar: () => void;
}

export const useSubSentinelStore = create<SubSentinelState>((set) => ({
    // Subscriptions
    subscriptions: [],
    isLoadingSubscriptions: false,
    setSubscriptions: (subs) => set({ subscriptions: subs }),
    setLoadingSubscriptions: (loading) => set({ isLoadingSubscriptions: loading }),

    // Dark Patterns
    darkPatternReports: [],
    setDarkPatternReports: (reports) => set({ darkPatternReports: reports }),

    // Agent Activity
    activities: [],
    addActivity: (activity) =>
        set((state) => ({
            activities: [activity, ...state.activities].slice(0, 50),
        })),
    agentStatuses: {
        auditor: 'active',
        calendar: 'active',
        negotiator: 'idle',
        defender: 'active',
        learner: 'processing',
    },
    setAgentStatus: (agent, status) =>
        set((state) => ({
            agentStatuses: { ...state.agentStatuses, [agent]: status },
        })),

    // Financial Score
    financialScore: null,
    setFinancialScore: (score) => set({ financialScore: score }),

    // TOON Metrics
    toonMetrics: null,
    setToonMetrics: (metrics) => set({ toonMetrics: metrics }),

    // UI
    sidebarOpen: true,
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));

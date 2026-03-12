// ─── SubSentinel TypeScript Types ──────────────────────────────

// ─── Subscription ──────────────────────────────────────────────
export interface Subscription {
    subscriptionId: string;
    userId: string;
    provider: string;
    amount: number;
    currency: string;
    frequency: 'monthly' | 'yearly' | 'weekly';
    renewalDate: string;
    status: 'active' | 'paused' | 'cancelled' | 'flagged';
    category: string;
    detectedVia: 'email' | 'manual' | 'calendar';
    createdAt: string;
    updatedAt: string;
}

// ─── Dark Pattern ──────────────────────────────────────────────
export type DarkPatternType =
    | 'OBSTRUCTION'
    | 'CONFUSION'
    | 'FORCED_LABOR'
    | 'SHAME_TACTICS'
    | 'MISDIRECTION';

export interface DetectedPattern {
    patternType: DarkPatternType | string;
    description: string;
    confidence: number;
    severity: number;
    evidence?: string;
    provider?: string;
}

export interface DarkPatternReport {
    reportId: string;
    userId: string;
    provider: string;
    screenshotKey?: string;
    patterns: DetectedPattern[];
    hostilityScore: number;
    confidence?: number;
    bypassGuide: string[];
    analyzedAt: string;
}

// ─── Negotiation ───────────────────────────────────────────────
export interface NegotiationDraft {
    draftId: string;
    userId?: string;
    subscriptionId?: string;
    provider: string;
    strategy: string;
    emailDraft: string;
    successPrediction: number;
    successRate?: number;
    leverage: string[];
    status?: 'ready' | 'sent' | 'won' | 'pending';
    estimatedSaving?: number;
    generatedAt: string;
}

export interface NegotiationOutcome {
    outcomeId: string;
    provider: string;
    strategy: string;
    success: boolean;
    savingsAmount: number;
    sentiment: string;
    vectorId: string;
}

// ─── Calendar ──────────────────────────────────────────────────
export interface CalendarInsight {
    insightId: string;
    userId: string;
    eventType: 'vacation' | 'relocation' | 'job_change' | 'marriage' | 'retirement';
    eventDate: string;
    affectedSubscriptions: string[];
    suggestion: string;
    confidence: number;
}

// ─── Financial Score ───────────────────────────────────────────
export interface FinancialScore {
    userId: string;
    score: number;
    savingsRatio: number;
    negotiationWins: number;
    patternsBlocked: number;
    monthlySpend: number;
    monthlySavings: number;
    calculatedAt: string;
}

// ─── Agent Activity ────────────────────────────────────────────
export type AgentName = 'auditor' | 'calendar' | 'negotiator' | 'defender' | 'learner';
export type AgentStatus = 'active' | 'idle' | 'processing' | 'error';

export interface AgentActivity {
    id: string;
    agent: AgentName;
    action: string;
    detail: string;
    timestamp: string;
    status: 'success' | 'processing' | 'warning' | 'error';
    toonSavings?: number;
}

// ─── TOON ──────────────────────────────────────────────────────
export interface TOONMetrics {
    totalJsonTokens: number;
    totalToonTokens: number;
    overallSavingsPercent: number;
    byCategory: {
        category: string;
        jsonTokens: number;
        toonTokens: number;
        savings: number;
    }[];
}

// ─── API Response ──────────────────────────────────────────────
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    toonEncoded?: boolean;
    tokensSaved?: number;
}

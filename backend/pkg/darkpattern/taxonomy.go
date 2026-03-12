// Package darkpattern provides the dark pattern detection library.
// It defines the taxonomy of manipulative UI patterns and scoring algorithms.
package darkpattern

import (
	"fmt"
	"strings"

	"github.com/subsentinel/subsentinel/internal/models"
)

// PatternType represents the category of dark pattern.
type PatternType string

const (
	Obstruction  PatternType = "OBSTRUCTION"   // Making cancellation unnecessarily difficult
	Confusion    PatternType = "CONFUSION"     // Misleading language or double-negatives
	ForcedLabor  PatternType = "FORCED_LABOR"  // Requiring excessive steps to cancel
	ShameTactics PatternType = "SHAME_TACTICS" // Guilt-tripping the user
	Misdirection PatternType = "MISDIRECTION"  // Drawing attention away from cancel option
)

// Taxonomy defines the classification system for dark patterns.
type Taxonomy struct {
	Patterns []PatternDefinition `json:"patterns"`
}

// PatternDefinition describes a single dark pattern type.
type PatternDefinition struct {
	Type        PatternType `json:"type"`
	Name        string      `json:"name"`
	Description string      `json:"description"`
	Indicators  []string    `json:"indicators"`
	Severity    float64     `json:"severity"` // 0.0-2.0
}

// DefaultTaxonomy returns the built-in dark pattern taxonomy.
func DefaultTaxonomy() *Taxonomy {
	return &Taxonomy{
		Patterns: []PatternDefinition{
			{
				Type:        Obstruction,
				Name:        "Obstruction",
				Description: "Making the cancellation process unnecessarily difficult by hiding options or requiring multiple steps",
				Indicators: []string{
					"Cancel button buried multiple levels deep",
					"Tiny or hard-to-find cancel link",
					"Requires phone call to cancel",
					"Cancel option removed from UI",
				},
				Severity: 1.5,
			},
			{
				Type:        Confusion,
				Name:        "Confusion",
				Description: "Using misleading language, double-negatives, or ambiguous wording",
				Indicators: []string{
					"Double-negative phrasing",
					"Ambiguous button labels",
					"Don't cancel / Don't not cancel",
					"Confusing checkbox states",
				},
				Severity: 1.2,
			},
			{
				Type:        ForcedLabor,
				Name:        "Forced Labor",
				Description: "Requiring excessive effort through surveys, retention flows, or unnecessary steps",
				Indicators: []string{
					"Multi-step retention survey",
					"Required reason for cancellation",
					"Multiple confirmation dialogs",
					"Forced hold for retention agent",
				},
				Severity: 2.0,
			},
			{
				Type:        ShameTactics,
				Name:        "Shame Tactics",
				Description: "Using guilt, shame, or fear to discourage cancellation",
				Indicators: []string{
					"You'll lose your data forever",
					"Sad imagery or emotional manipulation",
					"Highlighting what you'll miss",
					"Countdown timers creating urgency",
				},
				Severity: 1.4,
			},
			{
				Type:        Misdirection,
				Name:        "Misdirection",
				Description: "Drawing attention away from the cancel option toward retention offers",
				Indicators: []string{
					"Prominent 'Keep Membership' button",
					"Discount offers obscuring cancel path",
					"Visual hierarchy favoring staying",
					"Auto-selecting retention option",
				},
				Severity: 1.3,
			},
		},
	}
}

// LoadTaxonomy loads the dark pattern taxonomy from a TOON config file.
// Falls back to the default taxonomy if the file doesn't exist.
func LoadTaxonomy(path string) (*Taxonomy, error) {
	// TODO: Load from TOON file at path
	// For now, return default taxonomy
	return DefaultTaxonomy(), nil
}

// ToPrompt converts the taxonomy into a format suitable for Bedrock prompts.
func (t *Taxonomy) ToPrompt() string {
	var b strings.Builder
	b.WriteString("dark_patterns[")
	b.WriteString(fmt.Sprintf("%d", len(t.Patterns)))
	b.WriteString("]{type,name,description,severity}:\n")

	for _, p := range t.Patterns {
		b.WriteString(fmt.Sprintf("%s,%s,%s,%.1f\n",
			string(p.Type),
			p.Name,
			strings.ReplaceAll(p.Description, ",", "\\,"),
			p.Severity,
		))
	}

	return strings.TrimRight(b.String(), "\n")
}

// CalculateHostilityScore computes an overall hostility score (0-10)
// based on the detected patterns and their severities.
func CalculateHostilityScore(patterns []models.DetectedPattern) float64 {
	if len(patterns) == 0 {
		return 0.0
	}

	totalSeverity := 0.0
	totalConfidence := 0.0

	for _, p := range patterns {
		severity := p.Severity
		if severity <= 0 {
			severity = 1.0 // fallback
		}
		confidence := p.Confidence
		if confidence <= 0 {
			confidence = 0.85 // fallback if LLM omitted it or string conversion failed
		}
		totalSeverity += severity
		totalConfidence += confidence
	}

	// Hostility = weighted average of severity * confidence, scaled to 0-10
	avgSeverity := totalSeverity / float64(len(patterns))
	avgConfidence := totalConfidence / float64(len(patterns))

	score := avgSeverity * avgConfidence * 5.0 // Scale to ~0-10

	if score > 10.0 {
		score = 10.0
	}

	return score
}

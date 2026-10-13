import React from 'react';

export default function SeveritySummary({
  summary,
  riskScore,
  validation,
  activeFilter = 'all',
  onFilterChange,
  onOpenValidationModal
}) {
  if (!summary) return null;

  const handleCardClick = (severity) => {
    if (!onFilterChange) return;
    onFilterChange(activeFilter === severity ? 'all' : severity);
  };

  const handleCardKeyDown = (e, severity) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick(severity);
    }
  };

  const cards = [
    {
      id: 'high',
      label: 'High Risk',
      count: summary.high || 0,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      )
    },
    {
      id: 'medium',
      label: 'Medium Risk',
      count: summary.medium || 0,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      )
    },
    {
      id: 'low',
      label: 'Low / Audit',
      count: summary.low || 0,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      )
    },
    {
      id: 'info',
      label: 'Info / Coverage',
      count: summary.info || 0,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      )
    }
  ];

  // Resolve safe risk score object
  const scoreObj = riskScore || {
    score: 0,
    level: 'Minimal Risk',
    category: 'minimal',
    explanation: 'No deterministic security policy violations or high-risk heuristics detected.',
    formula: 'Weighted sum: High(30) + Med(15) + Low(5) + Info(1)',
    disclaimer: 'Indicative heuristic risk score based on static analysis. Not a certified rating.'
  };

  const scoreLevelClass = `level-${scoreObj.category || 'minimal'}`;

  // Circular gauge circumference computation (r = 30)
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (scoreObj.score / 100) * circumference;

  return (
    <div className="severity-summary-wrapper">
      {/* 1. Overall Workflow Risk Score Executive Card */}
      <div className={`risk-score-hero-card ${scoreLevelClass}`}>
        <div className="risk-score-main-group">
          {/* Circular Score Gauge */}
          <div className="risk-score-gauge-wrapper">
            <svg className="risk-score-svg" width="80" height="80" viewBox="0 0 80 80" aria-hidden="true">
              {/* Background track circle */}
              <circle
                className="gauge-track"
                cx="40"
                cy="40"
                r={radius}
                strokeWidth="6"
                fill="none"
              />
              {/* Active animated progress stroke */}
              <circle
                className={`gauge-progress ${scoreLevelClass}`}
                cx="40"
                cy="40"
                r={radius}
                strokeWidth="6"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform="rotate(-90 40 40)"
              />
            </svg>
            <div className="gauge-text-overlay">
              <span className="gauge-score-value">{scoreObj.score}</span>
              <span className="gauge-score-scale">/100</span>
            </div>
          </div>

          {/* Risk Details & Hierarchy */}
          <div className="risk-score-details">
            <div className="risk-score-top-line">
              <span className="risk-score-eyebrow">OVERALL WORKFLOW RISK SCORE</span>
              <span className={`risk-score-level-badge badge-${scoreObj.category || 'minimal'}`}>
                <span className="level-badge-dot" aria-hidden="true" />
                <span>{scoreObj.level || 'Minimal Risk'}</span>
              </span>
            </div>

            <p className="risk-score-explanation-text">
              {scoreObj.explanation}
            </p>

            <div className="risk-score-footnotes">
              <span className="formula-tooltip-chip" title={scoreObj.formula}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <span>Scoring Weights: High(30) · Med(15) · Low(5) · Info(1)</span>
              </span>

              <span className="disclaimer-chip">
                {scoreObj.disclaimer || 'Indicative heuristic score · Not a certified security rating.'}
              </span>
            </div>
          </div>
        </div>

        {/* Validation Pre-check Audit Link */}
        {validation && (
          <div className="risk-score-precheck-cta">
            <button
              type="button"
              className={`btn-open-precheck-audit ${validation.isValid ? (validation.summary?.warnings > 0 ? 'audit-warning' : 'audit-clean') : 'audit-error'}`}
              onClick={onOpenValidationModal}
              title="Click to view detailed workflow validation pre-check checklist"
              aria-label="View workflow validation pre-check report"
            >
              <div className="audit-cta-icon" aria-hidden="true">
                {validation.isValid ? (
                  validation.summary?.warnings > 0 ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <polyline points="9 12 11 14 15 10" />
                    </svg>
                  )
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                )}
              </div>

              <div className="audit-cta-text">
                <span className="audit-cta-label">Pre-check Audit</span>
                <span className="audit-cta-status">
                  {validation.isValid
                    ? `${validation.summary?.passed ?? 6}/6 Checks Passed`
                    : 'Blocking Errors Found'}
                </span>
              </div>

              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* 2. 4 Severity Summary Cards Grid */}
      <div className="summary-grid" role="group" aria-label="Risk Severity Summary Cards">
        {cards.map((card) => {
          const isSelected = activeFilter === card.id;
          const isZero = card.count === 0;

          return (
            <div
              key={card.id}
              className={`summary-card ${card.id} ${isSelected ? 'active-filter' : ''} ${isZero ? 'count-zero' : 'count-positive'}`}
              onClick={() => handleCardClick(card.id)}
              onKeyDown={(e) => handleCardKeyDown(e, card.id)}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              title={`Click to filter findings by ${card.label} (${card.count})`}
            >
              <div className="summary-card-header">
                <span className="summary-card-title">{card.label}</span>
                <div className="summary-card-icon-wrapper">
                  {card.icon}
                </div>
              </div>

              <div className="summary-card-bottom">
                <span className={`summary-card-count ${card.id}`}>
                  {card.count}
                </span>
                {isSelected ? (
                  <span className="summary-card-pill active-badge">Filtered</span>
                ) : isZero ? (
                  <span className="summary-card-pill zero-badge">Clean</span>
                ) : (
                  <span className="summary-card-pill item-badge">{card.count === 1 ? 'Finding' : 'Findings'}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


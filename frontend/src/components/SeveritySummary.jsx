import React from 'react';

export default function SeveritySummary({
  summary,
  activeFilter = 'all',
  onFilterChange
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

  return (
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
  );
}


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

  return (
    <div className="summary-grid" role="group" aria-label="Risk Summary Cards">
      {/* 1. High Risk Card */}
      <div
        className={`summary-card high ${activeFilter === 'high' ? 'active-filter' : ''}`}
        onClick={() => handleCardClick('high')}
        onKeyDown={(e) => handleCardKeyDown(e, 'high')}
        role="button"
        tabIndex={0}
        aria-pressed={activeFilter === 'high'}
        title="Click to filter by High Risk"
      >
        <div className="summary-card-header">
          <span className="summary-card-title">High Risk</span>
          <div className="summary-card-icon-group">
            {activeFilter === 'high' && (
              <span className="filter-badge">ACTIVE</span>
            )}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="summary-icon high" aria-hidden="true">
              <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
        </div>
        <div className="summary-card-count high">
          {summary.high || 0}
        </div>
      </div>

      {/* 2. Medium Risk Card */}
      <div
        className={`summary-card medium ${activeFilter === 'medium' ? 'active-filter' : ''}`}
        onClick={() => handleCardClick('medium')}
        onKeyDown={(e) => handleCardKeyDown(e, 'medium')}
        role="button"
        tabIndex={0}
        aria-pressed={activeFilter === 'medium'}
        title="Click to filter by Medium Risk"
      >
        <div className="summary-card-header">
          <span className="summary-card-title">Medium Risk</span>
          <div className="summary-card-icon-group">
            {activeFilter === 'medium' && (
              <span className="filter-badge">ACTIVE</span>
            )}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="summary-icon medium" aria-hidden="true">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
        </div>
        <div className="summary-card-count medium">
          {summary.medium || 0}
        </div>
      </div>

      {/* 3. Low / Audit Card */}
      <div
        className={`summary-card low ${activeFilter === 'low' ? 'active-filter' : ''}`}
        onClick={() => handleCardClick('low')}
        onKeyDown={(e) => handleCardKeyDown(e, 'low')}
        role="button"
        tabIndex={0}
        aria-pressed={activeFilter === 'low'}
        title="Click to filter by Low Risk / Audit"
      >
        <div className="summary-card-header">
          <span className="summary-card-title">Low / Audit</span>
          <div className="summary-card-icon-group">
            {activeFilter === 'low' && (
              <span className="filter-badge">ACTIVE</span>
            )}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="summary-icon low" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
        </div>
        <div className="summary-card-count low">
          {summary.low || 0}
        </div>
      </div>

      {/* 4. Info / Coverage Card */}
      <div
        className={`summary-card info ${activeFilter === 'info' ? 'active-filter' : ''}`}
        onClick={() => handleCardClick('info')}
        onKeyDown={(e) => handleCardKeyDown(e, 'info')}
        role="button"
        tabIndex={0}
        aria-pressed={activeFilter === 'info'}
        title="Click to filter by Info / Coverage"
      >
        <div className="summary-card-header">
          <span className="summary-card-title">Info / Coverage</span>
          <div className="summary-card-icon-group">
            {activeFilter === 'info' && (
              <span className="filter-badge">ACTIVE</span>
            )}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="summary-icon info" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
        </div>
        <div className="summary-card-count info">
          {summary.info || 0}
        </div>
      </div>
    </div>
  );
}

import React, { useEffect } from 'react';

export default function ValidationPrecheckModal({
  isOpen,
  onClose,
  validationResult,
  onProceedToScan,
  isScanning,
  workflowFileName
}) {
  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isScanning) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, isScanning, onClose]);

  if (!isOpen || !validationResult) return null;

  const {
    canProceed,
    summary = { totalChecks: 6, passed: 0, warnings: 0, errors: 0 },
    checks = [],
    workflowMetadata = {}
  } = validationResult;

  const hasWarnings = summary.warnings > 0;
  const hasErrors = summary.errors > 0;

  return (
    <div
      className="precheck-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Workflow Validation Pre-check Summary"
    >
      <div className="precheck-modal-card">
        {/* Modal Header */}
        <div className="precheck-modal-header">
          <div className="precheck-title-group">
            <div className="precheck-header-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
            </div>
            <div>
              <div className="precheck-eyebrow">STEP 1 OF 2 · WORKFLOW PRE-CHECK</div>
              <h2 className="precheck-modal-title">Validation Pre-check Summary</h2>
            </div>
          </div>

          <button
            type="button"
            className="btn-precheck-close"
            onClick={onClose}
            disabled={isScanning}
            aria-label="Close validation pre-check modal"
            title="Close (Esc)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Status Hero Banner */}
        <div className={`precheck-status-banner ${hasErrors ? 'status-error' : hasWarnings ? 'status-warning' : 'status-clean'}`}>
          <div className="status-banner-icon" aria-hidden="true">
            {hasErrors ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            ) : hasWarnings ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            )}
          </div>

          <div className="status-banner-content">
            <div className="status-banner-heading">
              {hasErrors
                ? 'Workflow Analysis Blocked'
                : hasWarnings
                  ? 'Workflow Valid with Non-Blocking Warnings'
                  : 'Workflow Structure Verified & Clean'}
            </div>
            <p className="status-banner-desc">
              {hasErrors
                ? 'The workflow contains structural syntax or schema errors that prevent safe static analysis. Resolve blocking issues to proceed.'
                : hasWarnings
                  ? 'All core structural requirements met. Non-blocking warnings will be automatically resolved by the graph engine.'
                  : 'All 6 pre-check validation rules passed. The workflow is ready for static heuristic inspection.'}
            </p>
          </div>
        </div>

        {/* Workflow Quick Metadata Bar */}
        <div className="precheck-meta-bar">
          <div className="precheck-meta-item">
            <span className="meta-label">WORKFLOW:</span>
            <span className="meta-value" title={workflowMetadata.name || workflowFileName || 'Workflow'}>
              {workflowMetadata.name || workflowFileName || 'Workflow'}
            </span>
          </div>
          <div className="precheck-meta-item">
            <span className="meta-label">NODES:</span>
            <span className="meta-value">{workflowMetadata.nodeCount ?? 0}</span>
          </div>
          <div className="precheck-meta-item">
            <span className="meta-label">CONNECTIONS:</span>
            <span className="meta-value">{workflowMetadata.connectionCount ?? 0}</span>
          </div>
          <div className="precheck-summary-pills">
            <span className="pill-metric passed" title="Passed Checks">
              <span className="metric-dot" /> {summary.passed} Passed
            </span>
            {summary.warnings > 0 && (
              <span className="pill-metric warning" title="Non-blocking Warnings">
                <span className="metric-dot" /> {summary.warnings} Warning{summary.warnings === 1 ? '' : 's'}
              </span>
            )}
            {summary.errors > 0 && (
              <span className="pill-metric error" title="Blocking Errors">
                <span className="metric-dot" /> {summary.errors} Blocking Error{summary.errors === 1 ? '' : 's'}
              </span>
            )}
          </div>
        </div>

        {/* Checklist Section */}
        <div className="precheck-checks-list">
          <div className="checks-list-header">
            <span>Pre-check Validation Rules (6 Audits)</span>
            <span className="checks-subtitle">Evaluated without executing workflow logic</span>
          </div>

          <div className="checks-scrollable-area">
            {checks.map((check) => {
              const isPassed = check.status === 'passed';
              const isWarning = check.status === 'warning';

              return (
                <div
                  key={check.id}
                  className={`check-card status-${check.status}`}
                >
                  <div className="check-card-header">
                    <div className="check-card-title-group">
                      <span className={`check-icon-wrapper ${check.status}`} aria-hidden="true">
                        {isPassed ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : isWarning ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="15" y1="9" x2="9" y2="15" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                          </svg>
                        )}
                      </span>
                      <span className="check-name">{check.name}</span>
                    </div>

                    <span className={`check-status-pill pill-${check.status}`}>
                      {check.status === 'passed' ? 'PASSED' : check.status === 'warning' ? 'WARNING' : 'BLOCKED'}
                    </span>
                  </div>

                  <p className="check-message">{check.message}</p>

                  {/* Detailed issues list if present */}
                  {check.details && check.details.length > 0 && (
                    <div className="check-details-box">
                      <ul className="check-details-list">
                        {check.details.map((detail, idx) => (
                          <li key={idx} className="check-detail-item">
                            {detail}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Affected nodes or connection chips */}
                  {check.affectedItems && check.affectedItems.length > 0 && (
                    <div className="check-affected-items">
                      <span className="affected-label">Affected Target(s):</span>
                      <div className="affected-chips-row">
                        {check.affectedItems.map((item, idx) => (
                          <span key={idx} className="affected-chip" title={`${item.type}: ${item.id}`}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              {item.type === 'node' ? (
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                              ) : (
                                <path d="m15 15 6 6m-6-6v4.8m0-4.8h4.8M9 9 3 3m6 6V4.2M9 9H4.2" />
                              )}
                            </svg>
                            <span>{item.name ? `${item.name} (${item.id})` : item.id}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="precheck-modal-footer">
          <div className="footer-left-info">
            <span className="footer-note">
              {canProceed
                ? 'Non-destructive static analysis only. Raw workflow data is never stored.'
                : 'Upload a valid n8n workflow file to proceed.'}
            </span>
          </div>

          <div className="footer-actions-group">
            <button
              type="button"
              className="btn-precheck-secondary"
              onClick={onClose}
              disabled={isScanning}
            >
              {canProceed ? 'Cancel' : 'Choose Another Workflow'}
            </button>

            {canProceed && (
              <button
                type="button"
                className="btn-precheck-proceed"
                onClick={onProceedToScan}
                disabled={isScanning}
              >
                {isScanning ? (
                  <>
                    <span className="btn-spinner" aria-hidden="true" />
                    <span>Analyzing Workflow...</span>
                  </>
                ) : (
                  <>
                    <span>Proceed to Security Scan</span>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

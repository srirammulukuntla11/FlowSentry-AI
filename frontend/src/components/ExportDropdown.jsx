import React, { useState, useRef, useEffect } from 'react';

export default function ExportDropdown({ scanResult, nodeLookup = {} }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationType, setGenerationType] = useState(null); // 'pdf' | 'json' | null
  const [error, setError] = useState(null);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleExportPdf = async () => {
    if (isGenerating) return;
    setError(null);
    setIsGenerating(true);
    setGenerationType('pdf');

    try {
      const { generatePdfReport } = await import('../utils/pdfGenerator.js');
      generatePdfReport(scanResult, nodeLookup);
      setIsOpen(false);
    } catch (err) {
      console.error('[Export Error] Failed to generate PDF report:', err);
      setError('Could not generate PDF report. Please verify scan data and try again.');
    } finally {
      setIsGenerating(false);
      setGenerationType(null);
    }
  };

  const handleExportJson = async () => {
    if (isGenerating) return;
    setError(null);
    setIsGenerating(true);
    setGenerationType('json');

    try {
      const { downloadJsonReport } = await import('../utils/jsonReportGenerator.js');
      downloadJsonReport(scanResult, nodeLookup);
      setIsOpen(false);
    } catch (err) {
      console.error('[Export Error] Failed to generate JSON report:', err);
      setError('Could not generate JSON report. Please verify scan data and try again.');
    } finally {
      setIsGenerating(false);
      setGenerationType(null);
    }
  };

  return (
    <div className="export-dropdown-wrapper" ref={dropdownRef}>
      <button
        type="button"
        className={`btn-export-report ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="Export Security Report options"
        disabled={isGenerating}
        title="Download executive PDF or structured JSON report of this scan"
      >
        {isGenerating ? (
          <span className="export-spinner" aria-hidden="true" />
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        )}
        <span>
          {isGenerating
            ? generationType === 'pdf' ? 'Generating PDF...' : 'Preparing JSON...'
            : 'Export Report'}
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`export-chevron ${isOpen ? 'open' : ''}`}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className="export-dropdown-menu" role="menu" aria-label="Export Report Options">
          <div className="export-dropdown-header">
            <span>DOWNLOAD AUDIT REPORT</span>
          </div>

          <button
            type="button"
            className="export-menu-item"
            role="menuitem"
            onClick={handleExportPdf}
            disabled={isGenerating}
          >
            <div className="export-item-icon pdf" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div className="export-item-details">
              <span className="export-item-title">Export as PDF</span>
              <span className="export-item-desc">Executive summary, detailed findings, and evidence</span>
            </div>
          </button>

          <button
            type="button"
            className="export-menu-item"
            role="menuitem"
            onClick={handleExportJson}
            disabled={isGenerating}
          >
            <div className="export-item-icon json" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            </div>
            <div className="export-item-details">
              <span className="export-item-title">Export as JSON</span>
              <span className="export-item-desc">Structured, schema-validated dataset with metadata</span>
            </div>
          </button>
        </div>
      )}

      {error && (
        <div className="export-error-toast" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="export-error-close"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

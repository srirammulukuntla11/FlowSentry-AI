import React, { useState, useRef } from 'react';

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

export default function UploadDropzone({ onFileSelected, isLoading, onSampleSelected }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [clientError, setClientError] = useState(null);
  const fileInputRef = useRef(null);

  const processFile = (file) => {
    setClientError(null);

    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
      setClientError('Invalid file type: Please select an exported n8n workflow .json file.');
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setClientError(`File exceeds 2 MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB). Please select a file under 2 MB.`);
      return;
    }

    if (file.size === 0) {
      setClientError('The selected file is empty.');
      return;
    }

    onFileSelected(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isLoading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!isLoading) setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleKeyDown = (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !isLoading) {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="homepage-container">
      {/* Centered Main Content Area with Radial Glow */}
      <div className="homepage-main-section">
        <div className="hero-glow-backdrop" aria-hidden="true" />

        {/* 1. Uppercase Eyebrow Label */}
        <div className="hero-eyebrow">
          <span className="eyebrow-dot" aria-hidden="true" />
          AI-POWERED WORKFLOW SECURITY
        </div>

        {/* 2. Main Heading with Cyan Highlight */}
        <h1 className="hero-headline">
          Understand Your Workflow's <span className="hero-highlight">Security Risks</span>
        </h1>

        {/* 3. Concise Description */}
        <p className="hero-subtext">
          FlowSentry AI analyzes workflow JSON for potential security risks without executing it.
        </p>

        {/* 4. Workflow Upload Panel */}
        <div
          className={`upload-panel ${isDragOver ? 'drag-over' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !isLoading && fileInputRef.current?.click()}
          onKeyDown={handleKeyDown}
          role="button"
          tabIndex={0}
          aria-label="Import an n8n workflow JSON file"
        >
          <input
            type="file"
            ref={fileInputRef}
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleInputChange}
            disabled={isLoading}
          />

          <div className="upload-icon-wrapper" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>

          <h2 className="upload-title">Drop your workflow JSON here</h2>
          <p className="upload-instructions">
            Drag & drop your exported workflow file, or browse locally
          </p>

          <button
            type="button"
            className="btn-upload-action"
            disabled={isLoading}
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            Choose workflow JSON
          </button>

          <div className="upload-metadata">
            JSON format · Maximum 2 MB
          </div>

          {clientError && (
            <div className="upload-error-message" role="alert">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{clientError}</span>
            </div>
          )}
        </div>

        {/* 5. Safe Sample and Risky Sample directly beneath upload panel */}
        <div className="samples-grid" role="group" aria-label="Sample workflow options">
          {/* Safe Sample Card */}
          <button
            type="button"
            className="sample-option safe"
            disabled={isLoading}
            onClick={() => onSampleSelected('safe')}
          >
            <div className="sample-icon safe" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
            </div>
            <div className="sample-text">
              <div className="sample-heading-row">
                <span className="sample-name">Safe Sample</span>
                <span className="sample-pill safe">0 Findings</span>
              </div>
              <p className="sample-description">
                Explore a clean workflow with no deterministic security warnings.
              </p>
            </div>
          </button>

          {/* Risky Sample Card */}
          <button
            type="button"
            className="sample-option risky"
            disabled={isLoading}
            onClick={() => onSampleSelected('risky')}
          >
            <div className="sample-icon risky" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div className="sample-text">
              <div className="sample-heading-row">
                <span className="sample-name">Risky Sample</span>
                <span className="sample-pill risky">Multi-Risk Demo</span>
              </div>
              <p className="sample-description">
                Inspect a workflow with hardcoded secrets, data egress, and SQL operations.
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

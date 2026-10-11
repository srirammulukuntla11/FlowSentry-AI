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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div
        className={`upload-card ${isDragOver ? 'drag-over' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isLoading && fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleInputChange}
          disabled={isLoading}
        />

        <div className="upload-icon">⚡</div>
        <h2 className="upload-title">Inspect n8n Workflow Export</h2>
        <p className="upload-sub">Drag and drop your exported workflow JSON here, or click to browse</p>

        <div className="upload-constraints">
          <span>Format: <strong>.json</strong> only</span>
          <span>•</span>
          <span>Max file size: <strong>2 MB</strong></span>
          <span>•</span>
          <span>Passive analysis</span>
        </div>

        {clientError && (
          <div style={{ marginTop: '1rem', color: '#f87171', fontSize: '0.85rem', fontWeight: 500 }}>
            ⚠️ {clientError}
          </div>
        )}

        <div className="quick-sample-bar" onClick={(e) => e.stopPropagation()}>
          <span className="sample-label">Or load synthetic test fixture:</span>
          <button
            type="button"
            className="btn-sample"
            disabled={isLoading}
            onClick={() => onSampleSelected('safe')}
          >
            🟢 Safe Sample (0 Findings)
          </button>
          <button
            type="button"
            className="btn-sample"
            disabled={isLoading}
            onClick={() => onSampleSelected('risky')}
          >
            🔴 Risky Sample (Multi-Risk Demo)
          </button>
        </div>
      </div>

      <div className="privacy-banner">
        <span>🛡️</span>
        <div>
          <strong>Privacy & Execution Safety Guarantee:</strong> Uploaded workflows are parsed in memory, statically audited, and discarded immediately. FlowSentry AI <em>never</em> executes workflows, triggers webhooks, or stores raw parameter payloads.
        </div>
      </div>
    </div>
  );
}

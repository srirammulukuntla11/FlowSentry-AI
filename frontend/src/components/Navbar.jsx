import React from 'react';

export default function Navbar({ onReset }) {
  return (
    <header className="navbar">
      <div className="brand" onClick={onReset} style={{ cursor: 'pointer' }}>
        <div className="brand-shield">🛡️</div>
        <div>
          <div className="brand-title">FlowSentry <span>AI</span></div>
        </div>
        <span className="brand-tag">v1.0 MVP</span>
      </div>

      <div className="nav-badges">
        <div className="security-badge">
          <span>🔒</span>
          <span>Static Analysis Only • Never Executed</span>
        </div>
      </div>
    </header>
  );
}

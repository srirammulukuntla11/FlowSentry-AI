import React from 'react';

export default function Navbar({ onReset }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onReset?.();
    }
  };

  return (
    <header className="navbar">
      <div
        className="brand"
        onClick={onReset}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label="FlowSentry AI Home / Reset"
      >
        <div className="brand-shield" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="var(--color-brand-shield-bg, #DDEBE6)" stroke="var(--brand-teal, #4F8277)" />
            <path d="m9 12 2 2 4-4" stroke="var(--brand-teal, #4F8277)" strokeWidth="2.2" />
          </svg>
        </div>
        <div className="brand-title">FlowSentry <span className="brand-title-accent">AI</span></div>
      </div>
    </header>
  );
}

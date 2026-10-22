'use client';
import {useState,useId} from 'react';
// Info-Tooltip Komponente
export const InfoTooltip = ({ id, title, text, activeId, onToggle }: { id: string, title: string, text: string | React.ReactNode, activeId: string | null, onToggle: (id: string) => void }) => {
  const isActive = activeId === id;
  return (
    <button
      type="button"
      className="tooltip-container tooltip-trigger"
      onClick={(e) => { e.stopPropagation(); onToggle(id); }}
      aria-expanded={isActive}
      aria-controls={`${id}-tooltip`}
      aria-label={`${title}: Erklärung anzeigen`}
    >
      <svg className="tooltip-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
      <span id={`${id}-tooltip`} role="tooltip" className={`tooltip-text ${isActive ? 'is-active' : ''}`}>
        <strong>{title}</strong><br /><br />
        {text}
      </span>
    </button>
  );
};

// Wiederverwendbare klappbare Sektion
export const CollapsibleSection = ({ title, icon, children, defaultOpen = true, badge }: {
  title: string, icon: React.ReactNode, children: React.ReactNode, defaultOpen?: boolean, badge?: string | number
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = useId();
  return (
    <div style={{ marginBottom: isOpen ? 0 : '-0.5rem' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={contentId}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.6rem 1rem',
          background: isOpen ? 'var(--glass-bg)' : 'var(--glass-bg)',
          border: `1px solid ${isOpen ? 'var(--accent-color)' : 'var(--glass-border)'}`,
          borderRadius: isOpen ? '16px 16px 0 0' : '16px',
          cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,
          color: isOpen ? 'var(--accent-color)' : 'var(--text-main)',
          transition: 'all 0.25s ease',
          backdropFilter: 'blur(12px)'
        }}
      >
        {icon}
        <span style={{ flex: 1, textAlign: 'left' }}>{title}</span>
        {badge && !isOpen && (
          <span style={{
            background: 'var(--accent-color)', color: '#fff', borderRadius: '999px',
            padding: '0.1rem 0.5rem', fontSize: '0.7rem', fontWeight: 700
          }}>{badge}</span>
        )}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ transition: 'transform 0.25s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
      {isOpen && (
        <div id={contentId} style={{
          border: '1px solid var(--accent-color)', borderTop: 'none',
          borderRadius: '0 0 16px 16px', overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          {children}
        </div>
      )}
    </div>
  );
};


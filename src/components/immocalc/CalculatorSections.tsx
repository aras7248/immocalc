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

export const CollapsibleSection = ({ title, icon, children, defaultOpen = true, badge }: {
 title:string;icon:React.ReactNode;children:React.ReactNode;defaultOpen?:boolean;badge?:string|number
}) => {
 const [isOpen,setIsOpen]=useState(defaultOpen);const contentId=useId();
 return <div className={`collapsible ${isOpen?'is-open':'is-closed'}`}>
  <button type="button" className="collapsible__button" onClick={()=>setIsOpen(v=>!v)} aria-expanded={isOpen} aria-controls={contentId}>
   {icon}<span className="collapsible__title">{title}</span>
   {badge&&!isOpen&&<span className="collapsible__badge">{badge}</span>}
   <svg className="collapsible__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
  </button>
  {isOpen&&<div id={contentId} className="collapsible__content">{children}</div>}
 </div>;
};

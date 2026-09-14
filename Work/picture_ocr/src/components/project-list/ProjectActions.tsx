import React, { useEffect, useRef, useState } from 'react';
import { LIST_ACTION_CLASS } from './projectListUi';

export interface ProjectListAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  className?: string;
}
interface ProjectActionsProps {
  label: string;
  actions: ProjectListAction[];
}

// 原生 disclosure 内使用普通按钮和 Tab 顺序，不声明需要方向键协议的 ARIA menu。
const ProjectActions: React.FC<ProjectActionsProps> = ({ label, actions }) => {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<React.CSSProperties>({ position: 'fixed', visibility: 'hidden' });
  const close = (restoreFocus = false) => {
    const details = detailsRef.current;
    if (!details?.open) return;
    details.open = false;
    if (restoreFocus) details.querySelector('summary')?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (!open) return;
    const pointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !detailsRef.current?.contains(event.target)) close();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && detailsRef.current?.open) {
        event.preventDefault();
        close(true);
      }
    };
    const scroll = (event: Event) => {
      if (!(event.target instanceof Node) || !detailsRef.current?.contains(event.target)) close();
    };
    const resize = () => close();
    document.addEventListener('pointerdown', pointer);
    document.addEventListener('keydown', key);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', resize);
    return () => {
      document.removeEventListener('pointerdown', pointer);
      document.removeEventListener('keydown', key);
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', resize);
    };
  }, [open]);

  return (
    <details ref={detailsRef} name="project-list-actions" className="relative" onBlur={event => {
      if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) close();
    }} onToggle={event => {
      const details = event.currentTarget;
      setOpen(details.open);
      if (!details.open) return;
      const rect = details.querySelector('summary')?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(208, window.innerWidth - 16);
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const showBelow = below >= Math.min(actions.length * 44 + 8, 320) || below >= above;
      setPosition({ position: 'fixed', width, left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
        top: showBelow ? rect.bottom + 4 : undefined, bottom: showBelow ? undefined : window.innerHeight - rect.top + 4,
        maxHeight: Math.max(44, showBelow ? below : above) });
    }}>
      <summary aria-label={label} className={`${LIST_ACTION_CLASS} cursor-pointer list-none border-slate-300 bg-white text-slate-700 hover:bg-slate-100`}>更多</summary>
      <div style={position} className="z-30 overflow-y-auto rounded border border-slate-300 bg-white p-1 shadow-sm">
        {actions.map(action => <button key={action.label} type="button" disabled={action.disabled}
          className={`min-h-11 w-full px-3 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50 ${action.danger ? 'border-t border-slate-200 text-red-700 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-100'} ${action.className ?? ''}`}
          onClick={() => { close(true); action.onClick(); }}>{action.label}</button>)}
      </div>
    </details>
  );
};

export default ProjectActions;

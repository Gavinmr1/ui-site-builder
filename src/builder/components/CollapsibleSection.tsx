import { useState } from 'react';
import { Icon } from './Icon';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: string;
  contentClassName?: string;
}

export function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  icon,
  contentClassName = 'pb-3',
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-slate-800">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full cursor-pointer items-center justify-between gap-2 border-0 bg-transparent py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:text-slate-100"
      >
        <div className="flex items-center gap-1.5">
          {icon && <Icon name={icon as any} size={16} />}
          {title}
        </div>
        <Icon
          name={isOpen ? 'chevron-down' : 'chevron-right'}
          size={16}
        />
      </button>

      {isOpen && (
        <div className={`animate-[slideDown_0.2s_ease-out] ${contentClassName}`}>
          {children}
        </div>
      )}

      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

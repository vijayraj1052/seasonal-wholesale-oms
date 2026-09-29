import { type ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({
  title,
  subtitle,
  action,
  className = '',
}: CardHeaderProps) {
  return (
    <div
      className={`flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-100 ${className}`}
    >
      <div>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {subtitle && (
          <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

interface CardBodyProps {
  children: ReactNode;
  className?: string;
}

export function CardBody({ children, className = '' }: CardBodyProps) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}

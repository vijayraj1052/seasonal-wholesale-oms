import { type ReactNode } from 'react';
import { Boxes } from 'lucide-react';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg mb-4">
            <Boxes className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Wholesale OMS</h1>
          <p className="text-sm text-slate-500 mt-1">
            Seasonal Order Management
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8">
          <h2 className="text-xl font-semibold text-slate-900 mb-1">{title}</h2>
          {subtitle && <p className="text-sm text-slate-500 mb-6">{subtitle}</p>}
          {!subtitle && <div className="mb-6" />}
          {children}
        </div>
      </div>
    </div>
  );
}

import { type InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, required, className = '', id, ...props }, ref) => {
    const inputId = id || props.name;
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`block w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            error
              ? 'border-red-300 bg-red-50'
              : 'border-slate-300 bg-white hover:border-slate-400'
          } ${className}`}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        {hint && !error && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

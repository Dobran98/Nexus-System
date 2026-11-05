import React from 'react';

// ============================================================
// @intranet/ui — Primitivas de Interfaz Design System
// Tailwind CSS / React 18+
// ============================================================

// 1. BUTTON
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'success' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', isLoading = false, children, disabled, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center font-medium rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none';
    
    const variants = {
      primary: 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-900/30 focus:ring-blue-500',
      secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-100 shadow-sm focus:ring-slate-400',
      danger: 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-900/30 focus:ring-rose-500',
      warning: 'bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-900/30 focus:ring-amber-500',
      success: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/30 focus:ring-emerald-500',
      outline: 'border-2 border-slate-700 hover:bg-slate-800 text-slate-200 focus:ring-slate-500',
      ghost: 'bg-transparent hover:bg-slate-800 text-slate-300 focus:ring-slate-500',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2.5 text-sm',
      lg: 'px-6 py-3.5 text-base',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {isLoading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

// 2. CARD PRIMITIVES
export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', ...props }) => (
  <div className={`bg-slate-900/90 border border-slate-800/80 rounded-2xl shadow-xl backdrop-blur-sm overflow-hidden ${className}`} {...props} />
);

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', ...props }) => (
  <div className={`p-6 border-b border-slate-800/60 ${className}`} {...props} />
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className = '', ...props }) => (
  <h3 className={`text-xl font-bold tracking-tight text-white ${className}`} {...props} />
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className = '', ...props }) => (
  <p className={`text-sm text-slate-400 mt-1 ${className}`} {...props} />
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', ...props }) => (
  <div className={`p-6 ${className}`} {...props} />
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', ...props }) => (
  <div className={`p-6 border-t border-slate-800/60 flex items-center justify-between ${className}`} {...props} />
);

// 3. BADGE
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

export const Badge: React.FC<BadgeProps> = ({ className = '', variant = 'default', children, ...props }) => {
  const variants = {
    default: 'bg-slate-800 text-slate-300 border-slate-700',
    success: 'bg-emerald-950/70 text-emerald-400 border-emerald-800/60',
    warning: 'bg-amber-950/70 text-amber-400 border-amber-800/60',
    danger: 'bg-rose-950/70 text-rose-400 border-rose-800/60',
    info: 'bg-blue-950/70 text-blue-400 border-blue-800/60',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border tracking-wide uppercase ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};

// 4. PROGRESS BAR
export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0 a 100
  color?: 'blue' | 'emerald' | 'amber' | 'rose';
}

export const Progress: React.FC<ProgressProps> = ({ value, color = 'blue', className = '', ...props }) => {
  const clamped = Math.min(100, Math.max(0, value));
  const colors = {
    blue: 'bg-blue-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
  };

  return (
    <div className={`w-full bg-slate-800 rounded-full h-3 overflow-hidden ${className}`} {...props}>
      <div
        className={`h-full transition-all duration-300 ease-out rounded-full ${colors[color]}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
};

// 5. INPUT
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, disabled, id, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={id} className="block text-xs font-medium text-slate-300 tracking-wide uppercase">
            {label}
          </label>
        )}
        <input
          id={id}
          ref={ref}
          disabled={disabled}
          className={`w-full px-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:bg-slate-900 disabled:cursor-not-allowed ${
            error ? 'border-rose-500 focus:ring-rose-500' : ''
          } ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-rose-400 mt-1">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

// 6. ALERT
export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'warning' | 'danger' | 'success';
}

export const Alert: React.FC<AlertProps> = ({ variant = 'info', className = '', children, ...props }) => {
  const styles = {
    info: 'bg-blue-950/40 border-blue-800/60 text-blue-200',
    warning: 'bg-amber-950/40 border-amber-800/60 text-amber-200',
    danger: 'bg-rose-950/40 border-rose-800/60 text-rose-200',
    success: 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200',
  };

  return (
    <div className={`p-4 rounded-xl border text-sm flex gap-3 items-start ${styles[variant]} ${className}`} {...props}>
      {children}
    </div>
  );
};

export const AlertTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className = '', ...props }) => (
  <h5 className={`font-semibold tracking-tight text-white mb-1 ${className}`} {...props} />
);

export const AlertDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className = '', ...props }) => (
  <p className={`text-xs opacity-90 leading-relaxed ${className}`} {...props} />
);

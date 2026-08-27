import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/** Label + optional hint/error wrapper shared by inputs. */
export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-4', className)}>
      {label && (
        <label htmlFor={htmlFor} className="label">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 text-sm font-medium text-rose-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-sm text-ink-400">{hint}</p>
      ) : null}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  leading?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, leading, ...rest },
  ref,
) {
  if (leading) {
    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-semibold text-ink-400">
          {leading}
        </span>
        <input
          ref={ref}
          className={cn('input pl-14', invalid && 'border-rose-300 focus:border-rose-400 focus:ring-rose-100', className)}
          {...rest}
        />
      </div>
    );
  }
  return (
    <input
      ref={ref}
      className={cn('input', invalid && 'border-rose-300 focus:border-rose-400 focus:ring-rose-100', className)}
      {...rest}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn('input min-h-[92px] resize-y', className)} {...rest} />;
  },
);

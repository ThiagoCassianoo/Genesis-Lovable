import type { ReactNode } from 'react';
import { Label } from '@/components/ui/Label';

export interface FormFieldRenderProps {
  id: string;
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
}

export interface FormFieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  opcional?: boolean;
  children: (props: FormFieldRenderProps) => ReactNode;
}

/** Liga label, dica e erro ao campo via htmlFor e aria-describedby. */
export function FormField({ id, label, hint, error, opcional, children }: FormFieldProps) {
  const hintId = hint ? `${id}-dica` : undefined;
  const errorId = error ? `${id}-erro` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <Label htmlFor={id}>
        {label}
        {opcional && <span className="font-normal text-tinta-suave"> (opcional)</span>}
      </Label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}
      {hint && (
        <p id={hintId} className="mt-1 text-sm text-tinta-suave">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-sm font-semibold text-erro">
          {error}
        </p>
      )}
    </div>
  );
}

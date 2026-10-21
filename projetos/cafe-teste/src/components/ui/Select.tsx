import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { fieldBase } from './fieldStyles';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/** <select> nativo de propósito: no celular abre o seletor do sistema, sem JS extra. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ className, ...props }, ref) {
  return <select ref={ref} className={cn(fieldBase, 'min-h-12', className)} {...props} />;
});

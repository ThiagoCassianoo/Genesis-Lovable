import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { fieldBase } from './fieldStyles';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(fieldBase, 'min-h-12', className)} {...props} />;
});

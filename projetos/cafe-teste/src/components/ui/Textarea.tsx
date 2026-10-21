import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { fieldBase } from './fieldStyles';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, ...props },
  ref,
) {
  return <textarea ref={ref} className={cn(fieldBase, 'min-h-24 py-2', className)} {...props} />;
});

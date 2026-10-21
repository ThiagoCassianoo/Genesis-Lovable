import type { LabelHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className, ...props }: LabelProps) {
  return <label className={cn('mb-1 block text-sm font-semibold text-tinta', className)} {...props} />;
}

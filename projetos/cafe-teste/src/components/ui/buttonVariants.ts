import { cva, type VariantProps } from 'class-variance-authority';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 min-h-12 px-4 text-base',
  {
    variants: {
      variant: {
        primary: 'bg-mata text-white hover:bg-mata-escuro',
        secondary: 'border border-mata bg-white text-mata hover:bg-papel',
        ghost: 'text-mata underline-offset-4 hover:underline',
        danger: 'border border-erro bg-white text-erro hover:bg-red-50',
      },
      size: {
        md: '',
        sm: 'min-h-10 px-3 text-sm',
        full: 'w-full',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;

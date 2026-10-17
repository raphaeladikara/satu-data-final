import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'dark' | 'outline' | 'ghost' | 'light';
type Size = 'sm' | 'md' | 'lg';

const base =
  'group/btn relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium tracking-[-0.01em] transition-[background-color,color,box-shadow,transform] duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50';
const variants: Record<Variant, string> = {
  primary: 'bg-teal text-primary-foreground shadow-[0_1px_0_rgba(255,255,255,.18)_inset,0_10px_24px_-10px_rgba(25,87,100,.7)] hover:bg-teal-600',
  dark: 'bg-teal-900 text-mint hover:bg-teal-800',
  outline: 'border border-ink/15 bg-paper/70 text-ink backdrop-blur hover:border-ink/30 hover:bg-paper',
  ghost: 'text-ink hover:bg-ink/5',
  light: 'bg-mint text-teal-900 hover:bg-white',
};
const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-5 text-[15px]',
  lg: 'h-13 px-7 text-base',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }>(
  ({ variant, size, className, ...p }, ref) => <button ref={ref} className={buttonClass(variant, size, className)} {...p} />,
);
Button.displayName = 'Button';

export function ButtonLink({ variant, size, className, ...p }: LinkProps & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...p} />;
}

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export type ButtonVariant = "default" | "secondary" | "ghost" | "danger" | "outline";
export type ButtonSize = "sm" | "md" | "icon";

const variants: Record<ButtonVariant, string> = {
  default: "bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]",
  secondary: "bg-[var(--surface-muted)] text-[var(--text-1)] border border-[var(--border-subtle)] hover:bg-[var(--surface-hover)]",
  ghost: "text-[var(--text-2)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-1)]",
  danger: "bg-[var(--red)] text-white hover:opacity-90",
  outline: "border border-[var(--border-strong)] text-[var(--text-1)] hover:bg-[var(--surface-muted)]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[12.5px] gap-1.5",
  md: "h-10 px-4 text-[13.5px] gap-2",
  icon: "h-9 w-9",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--radius-control)] font-semibold transition-[color,background-color,border-color,opacity,transform,box-shadow] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";

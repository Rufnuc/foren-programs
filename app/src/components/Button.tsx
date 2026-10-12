"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  full?: boolean;
  children: ReactNode;
}

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent/90 focus-visible:ring-focus shadow-sm",
  secondary:
    "bg-surface text-ink border border-muted/40 hover:border-ink/40 focus-visible:ring-focus",
  ghost: "bg-transparent text-ink hover:bg-surface focus-visible:ring-focus",
  danger:
    "bg-danger text-white hover:bg-danger/90 focus-visible:ring-focus shadow-sm",
};

const SIZE: Record<Size, string> = {
  sm: "px-3 py-2 text-sm rounded-md",
  md: "px-4 py-3 text-base rounded-lg",
  lg: "px-6 py-4 text-lg rounded-xl",
};

/**
 * Accessible primitive button. All call sites should rely on this so we
 * keep focus rings, sizing, and contrast tokens in one place.
 */
export function Button({
  variant = "primary",
  size = "md",
  full = false,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={[
        "inline-flex items-center justify-center font-medium",
        "transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        VARIANT[variant],
        SIZE[size],
        full ? "w-full" : "",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

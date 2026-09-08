import React from "react";
import { clsx } from "clsx";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant = "secondary", size = "md", icon, className, disabled, ...props }, ref) => {
    const variantStyles = {
      primary: "bg-accent hover:bg-accent/90 text-accent-foreground border border-accent font-medium shadow-sm active:scale-[0.98]",
      secondary: "bg-surfaceRaised hover:bg-surfaceOverlay text-foreground border border-border hover:border-borderMuted active:scale-[0.98]",
      outline: "bg-transparent hover:bg-surfaceRaised text-foreground border border-border active:scale-[0.98]",
      danger: "bg-danger/15 hover:bg-danger/25 text-danger border border-danger/30 active:scale-[0.98]",
      ghost: "bg-transparent hover:bg-surfaceRaised text-mutedForeground hover:text-foreground border border-transparent",
    }[variant];

    const sizeStyles = {
      sm: "text-xs px-2.5 py-1 rounded gap-1.5 h-7",
      md: "text-xs px-3.5 py-1.5 rounded-md gap-2 h-9",
      lg: "text-sm px-5 py-2.5 rounded-md gap-2.5 h-11",
    }[size];

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={clsx(
          "inline-flex items-center justify-center font-mono font-medium transition-all duration-150 select-none disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-1 focus-visible:ring-accent",
          variantStyles,
          sizeStyles,
          className
        )}
        {...props}
      >
        {icon && <span className="shrink-0">{icon}</span>}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

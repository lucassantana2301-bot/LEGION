import React from "react";
import { clsx } from "clsx";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "outline" | "accent";
  size?: "sm" | "md";
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "default",
  size = "md",
  className,
  ...props
}) => {
  const variantStyles = {
    default: "bg-surfaceRaised text-foreground border-border",
    accent: "bg-accent/15 text-accent border-accent/30",
    success: "bg-success/15 text-success border-success/30",
    warning: "bg-warning/15 text-warning border-warning/30",
    danger: "bg-danger/15 text-danger border-danger/30",
    info: "bg-info/15 text-info border-info/30",
    outline: "bg-transparent text-mutedForeground border-border",
  }[variant];

  const sizeStyles = {
    sm: "text-[10px] px-1.5 py-0.5 font-medium uppercase tracking-wider",
    md: "text-xs px-2 py-0.5 font-medium tracking-wide",
  }[size];

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded border font-mono font-medium transition-colors",
        variantStyles,
        sizeStyles,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};

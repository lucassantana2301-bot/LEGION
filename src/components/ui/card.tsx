import React from "react";
import { clsx } from "clsx";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "raised" | "ghost" | "interactive";
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = "default",
  className,
  ...props
}) => {
  const variantStyles = {
    default: "bg-surface border border-border shadow-subtle",
    raised: "bg-surfaceRaised border border-border shadow-card",
    ghost: "bg-transparent border border-borderMuted",
    interactive: "bg-surface hover:bg-surfaceRaised border border-border hover:border-accent/40 transition-all duration-150 cursor-pointer shadow-subtle",
  }[variant];

  return (
    <div className={clsx("rounded-lg p-4", variantStyles, className)} {...props}>
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  ...props
}) => (
  <div className={clsx("flex items-center justify-between pb-3 border-b border-borderMuted mb-3", className)} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className,
  ...props
}) => (
  <h3 className={clsx("text-xs font-mono font-semibold uppercase tracking-wider text-mutedForeground", className)} {...props}>
    {children}
  </h3>
);

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover border border-transparent",
  secondary: "bg-card text-ink border border-line hover:bg-subtle",
  ghost: "bg-transparent text-ink-2 border border-transparent hover:bg-segment",
  danger: "bg-card text-danger border border-danger-border hover:bg-[#fcf2f1]",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-2.5 text-xs rounded-lg",
  md: "h-9 px-3 text-[0.8125rem] rounded-[0.5625rem]",
  lg: "h-10 px-4 text-sm rounded-control",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 font-medium whitespace-nowrap transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});

export type IconButtonProps = Omit<ButtonProps, "aria-label" | "size"> & {
  /** Required: icon-only buttons have no visible text. */
  label: string;
  size?: "sm" | "md" | "touch";
};

const iconSizes = { sm: "size-7 rounded-md", md: "size-8 rounded-lg", touch: "size-11 rounded-xl" };

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = "md", variant = "ghost", className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center text-muted transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        iconSizes[size],
        className,
      )}
      {...props}
    />
  );
});

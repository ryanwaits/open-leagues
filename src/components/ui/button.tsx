import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * One system, three weights. `primary` is a flat ink pill; secondary actions
 * take `outline` (1px ring) or `muted` (grey fill); never bolder than 500.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[opacity,background-color,box-shadow,color] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-deep disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        primary: "bg-fg text-bg hover:opacity-90",
        ghost: "bg-transparent text-muted hover:bg-raised hover:text-fg",
        outline:
          "bg-transparent text-fg shadow-[0_0_0_1px_var(--color-line-strong)] hover:bg-raised",
        muted: "bg-raised text-fg hover:bg-line",
      },
      size: {
        sm: "h-8 rounded-pill px-3 text-[13px]",
        md: "h-9 rounded-pill px-4 text-sm",
        lg: "h-11 rounded-pill px-5 text-[15px]",
        icon: "size-9 rounded-pill",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

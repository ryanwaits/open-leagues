import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * One system, three weights. `primary` is the push button — it has physical
 * thickness and depresses on :active, so the press is the feedback. Use one
 * push per primary moment; secondary actions take `muted` or `outline`.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[opacity,background-color,box-shadow,color] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-deep disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        primary: "push bg-accent text-accent-fg",
        ghost: "bg-transparent text-fg hover:bg-raised",
        outline:
          "bg-transparent text-accent-strong shadow-[0_0_0_1px_var(--color-line-strong)] hover:bg-raised",
        muted: "bg-raised text-fg hover:bg-line",
      },
      size: {
        sm: "h-9 rounded-pill px-4 text-sm",
        md: "h-11 rounded-pill px-5 text-sm",
        lg: "h-12 rounded-pill px-6 text-base",
        icon: "size-11 rounded-pill",
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

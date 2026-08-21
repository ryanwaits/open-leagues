import { type InputHTMLAttributes, useId } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, id, name, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <input
      {...props}
      id={fieldId}
      name={name ?? fieldId}
      className={cn(
        "h-11 w-full rounded-md bg-raised px-3 text-sm text-fg ring-card placeholder:text-faint",
        "transition-[box-shadow] duration-150 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        className,
      )}
    />
  );
}

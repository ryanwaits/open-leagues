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
        "field h-10 w-full bg-surface px-3 text-base text-fg placeholder:text-faint sm:text-sm",
        "transition-[box-shadow] duration-150 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        className,
      )}
    />
  );
}

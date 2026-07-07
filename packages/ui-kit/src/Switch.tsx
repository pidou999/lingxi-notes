import {
  forwardRef,
  type InputHTMLAttributes,
} from "react";
import { cn } from "./cn";

export interface SwitchProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label?: string;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, checked, onChange, disabled, className, id, ...props }, ref) => {
    const switchId =
      id || `switch-${label?.toLowerCase().replace(/\s+/g, "-")}`;

    return (
      <label
        htmlFor={switchId}
        className={cn(
          "inline-flex items-center gap-3",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          className
        )}
      >
        <div className="relative">
          <input
            ref={ref}
            id={switchId}
            type="checkbox"
            checked={checked}
            onChange={onChange}
            disabled={disabled}
            className="peer sr-only"
            role="switch"
            aria-checked={checked}
            {...props}
          />
          <div className="h-6 w-11 rounded-full bg-gray-300 transition-colors peer-checked:bg-brand-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-500 peer-focus:ring-offset-2 dark:bg-gray-600 dark:peer-checked:bg-brand-500 dark:peer-focus:ring-offset-gray-900" />
          <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
        </div>
        {label && (
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </span>
        )}
      </label>
    );
  }
);

Switch.displayName = "Switch";

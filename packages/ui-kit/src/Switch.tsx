import { forwardRef, type InputHTMLAttributes } from "react";
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
          "inline-flex items-center gap-2.5",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          className
        )}
      >
        <span className="relative inline-block h-5 w-9 shrink-0">
          <input
            ref={ref}
            id={switchId}
            type="checkbox"
            checked={checked}
            onChange={onChange}
            disabled={disabled}
            className="peer absolute inset-0 z-10 cursor-pointer opacity-0"
            role="switch"
            aria-checked={checked}
            {...props}
          />
          {/* 背景轨道 */}
          <span className="block h-full w-full rounded-full bg-gray-300 transition-colors peer-checked:bg-brand-600 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2 dark:bg-gray-600 dark:peer-checked:bg-brand-500 dark:peer-focus-visible:ring-offset-gray-900" />
          {/* 滑块圆点 */}
          <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
        </span>
        {label && (
          <span className="select-none text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </span>
        )}
      </label>
    );
  }
);

Switch.displayName = "Switch";

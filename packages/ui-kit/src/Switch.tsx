import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "./cn";

export interface SwitchProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label?: string;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, checked, onChange, disabled, className, id, ...props }, ref) => {
    const fallbackId = useId();
    const switchId = id || fallbackId;

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
            className="absolute inset-0 z-10 cursor-pointer opacity-0"
            role="switch"
            aria-checked={checked}
            {...props}
          />
          {/* 背景轨道 */}
          <span
            className="block h-full w-full rounded-full transition-colors"
            style={{
              backgroundColor: checked
                ? "var(--switch-checked-bg, #6366f1)"
                : "var(--switch-unchecked-bg, #d1d5db)",
            }}
          />
          {/* 滑块圆点 */}
          <span
            className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform"
            style={{
              transform: checked ? "translateX(1rem)" : "translateX(0)",
            }}
          />
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

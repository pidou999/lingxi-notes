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
        style={{ cursor: disabled ? "not-allowed" : "pointer" }}
      >
        {/* 容器：固定 36x20 */}
        <span
          style={{
            position: "relative",
            display: "inline-block",
            width: "36px",
            height: "20px",
            flexShrink: 0,
          }}
        >
          {/* 原生 checkbox（透明但可点击） */}
          <input
            ref={ref}
            id={switchId}
            type="checkbox"
            checked={checked}
            onChange={onChange}
            disabled={disabled}
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 10,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: 0,
              margin: 0,
            }}
            role="switch"
            aria-checked={checked}
            {...props}
          />
          {/* 背景轨道 */}
          <span
            style={{
              display: "block",
              height: "100%",
              width: "100%",
              borderRadius: "999px",
              backgroundColor: checked ? "#6366f1" : "#d1d5db",
              transition: "background-color 0.15s ease",
            }}
          />
          {/* 滑块圆点 */}
          <span
            style={{
              position: "absolute",
              left: "2px",
              top: "2px",
              height: "16px",
              width: "16px",
              borderRadius: "999px",
              backgroundColor: "#ffffff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              transition: "transform 0.15s ease",
              transform: checked ? "translateX(16px)" : "translateX(0)",
            }}
          />
        </span>
        {label && (
          <span
            style={{
              userSelect: "none",
              fontSize: "14px",
              fontWeight: 500,
              color: "inherit",
            }}
          >
            {label}
          </span>
        )}
      </label>
    );
  }
);

Switch.displayName = "Switch";

import {
  forwardRef,
  useState,
  useRef,
  useEffect,
  type ReactNode,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
} from "react";
import { cn } from "./cn";
import { ChevronDown } from "@ai-notes/icons";

export interface DropdownItem {
  label: string;
  value: string;
  disabled?: boolean;
  icon?: ReactNode;
}

export interface DropdownGroup {
  label?: string;
  items: DropdownItem[];
}

export interface DropdownProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  groups: DropdownGroup[];
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
}

export const Dropdown = forwardRef<HTMLButtonElement, DropdownProps>(
  (
    { groups, placeholder = "请选择", value, onChange, className, ...props },
    ref
  ) => {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedLabel = groups
      .flatMap((g) => g.items)
      .find((i) => i.value === value)?.label;

    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(e.target as Node)
        ) {
          setOpen(false);
        }
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setOpen(false);
        }
      };

      if (open) {
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
      }

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }, [open]);

    return (
      <div ref={containerRef} className="relative inline-block">
        <button
          ref={ref}
          type="button"
          onClick={() => setOpen(!open)}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-gray-500",
            !selectedLabel && "text-gray-400 dark:text-gray-500",
            className
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
          {...props}
        >
          <span>{selectedLabel || placeholder}</span>
          <ChevronDown
            size={16}
            className={cn(
              "transition-transform",
              open && "rotate-180"
            )}
          />
        </button>
        {open && (
          <div
            className="absolute z-40 mt-1 w-full min-w-[200px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
            role="listbox"
          >
            {groups.map((group, gi) => (
              <div key={gi}>
                {gi > 0 && (
                  <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
                )}
                {group.label && (
                  <div className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                    {group.label}
                  </div>
                )}
                {group.items.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    disabled={item.disabled}
                    onClick={() => {
                      onChange?.(item.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                      value === item.value
                        ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800",
                      item.disabled && "cursor-not-allowed opacity-50"
                    )}
                    role="option"
                    aria-selected={value === item.value}
                  >
                    {item.icon && (
                      <span className="text-gray-400">{item.icon}</span>
                    )}
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
);

Dropdown.displayName = "Dropdown";

import {
  forwardRef,
  useEffect,
  useRef,
  type ReactNode,
  type HTMLAttributes,
} from "react";
import { cn } from "./cn";
import { Close } from "@ai-notes/icons";

export interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export const Modal = forwardRef<HTMLDivElement, ModalProps>(
  ({ open, onClose, title, children, className, ...props }, ref) => {
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!open) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onClose();
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "";
      };
    }, [open, onClose]);

    if (!open) return null;

    return (
      <div
        ref={overlayRef}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div
          ref={ref}
          className={cn(
            "relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900",
            "animate-in fade-in zoom-in-95",
            className
          )}
          {...props}
        >
          {title && (
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {title}
              </h2>
              <button
                onClick={onClose}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                aria-label="关闭"
              >
                <Close size={20} />
              </button>
            </div>
          )}
          {children}
        </div>
      </div>
    );
  }
);

Modal.displayName = "Modal";

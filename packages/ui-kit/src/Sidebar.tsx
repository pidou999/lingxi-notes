import {
  forwardRef,
  useState,
  type ReactNode,
  type HTMLAttributes,
} from "react";
import { cn } from "./cn";
import { ChevronDown } from "@ai-notes/icons";

export interface SidebarItem {
  id: string;
  label: string;
  icon?: ReactNode;
  href?: string;
  active?: boolean;
  children?: SidebarItem[];
}

export interface SidebarProps extends HTMLAttributes<HTMLElement> {
  items: SidebarItem[];
  collapsed?: boolean;
  onItemClick?: (item: SidebarItem) => void;
}

function SidebarMenuItem({
  item,
  collapsed,
  onItemClick,
  depth = 0,
}: {
  item: SidebarItem;
  collapsed?: boolean;
  onItemClick?: (item: SidebarItem) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(
    item.active || item.children?.some((c) => c.active) || false
  );
  const hasChildren = item.children && item.children.length > 0;

  if (collapsed && depth === 0) {
    return (
      <button
        onClick={() => onItemClick?.(item)}
        className={cn(
          "flex w-full items-center justify-center rounded-lg p-3 transition-colors",
          item.active
            ? "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
            : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        )}
        title={item.label}
        aria-label={item.label}
      >
        {item.icon}
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) {
            setExpanded(!expanded);
          } else {
            onItemClick?.(item);
          }
        }}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          item.active && !hasChildren
            ? "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
            : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        )}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        aria-expanded={hasChildren ? expanded : undefined}
        aria-label={item.label}
      >
        {item.icon && (
          <span className="flex-shrink-0">{item.icon}</span>
        )}
        <span className="flex-1 text-left">{item.label}</span>
        {hasChildren && (
          <ChevronDown
            size={14}
            className={cn(
              "flex-shrink-0 transition-transform",
              expanded && "rotate-180"
            )}
          />
        )}
      </button>
      {hasChildren && expanded && (
        <div className="mt-0.5">
          {item.children!.map((child) => (
            <SidebarMenuItem
              key={child.id}
              item={child}
              collapsed={collapsed}
              onItemClick={onItemClick}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export const Sidebar = forwardRef<HTMLElement, SidebarProps>(
  ({ items, collapsed, onItemClick, className, ...props }, ref) => {
    return (
      <nav
        ref={ref}
        className={cn(
          "flex flex-col gap-1 overflow-y-auto py-2",
          collapsed ? "items-center px-2" : "px-3",
          className
        )}
        aria-label="侧边栏导航"
        role="navigation"
        {...props}
      >
        {items.map((item) => (
          <SidebarMenuItem
            key={item.id}
            item={item}
            collapsed={collapsed}
            onItemClick={onItemClick}
          />
        ))}
      </nav>
    );
  }
);

Sidebar.displayName = "Sidebar";

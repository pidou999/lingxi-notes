import { IconProps } from "./types";

export function Note({ size = 24, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M4 4a2 2 0 0 1 2-2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1={9} y1={12} x2={15} y2={12} />
      <line x1={9} y1={16} x2={13} y2={16} />
    </svg>
  );
}

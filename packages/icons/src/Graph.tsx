import { IconProps } from "./types";

export function Graph({ size = 24, className, ...props }: IconProps) {
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
      <circle cx="5" cy="6" r="3" />
      <circle cx="19" cy="6" r="3" />
      <circle cx="12" cy="19" r="3" />
      <line x1="7.5" y1="7.5" x2="10" y2="17" />
      <line x1="16.5" y1="7.5" x2="14" y2="17" />
      <line x1="8" y1="6" x2="16" y2="6" />
    </svg>
  );
}

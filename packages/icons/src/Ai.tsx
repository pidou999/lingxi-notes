import { IconProps } from "./types";

export function Ai({ size = 24, className, ...props }: IconProps) {
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
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
      <circle cx={12} cy={7} r={1} fill="currentColor" />
      <circle cx={12} cy={12} r={1} fill="currentColor" />
      <circle cx={12} cy={17} r={1} fill="currentColor" />
    </svg>
  );
}

import { IconProps } from "./types";

export function MoreHorizontal({ size = 24, className, ...props }: IconProps) {
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
      <circle cx={12} cy={12} r={1} fill="currentColor" />
      <circle cx={5} cy={12} r={1} fill="currentColor" />
      <circle cx={19} cy={12} r={1} fill="currentColor" />
    </svg>
  );
}

"use client";

interface LingxiLogoProps {
  size?: number;
  collapsed?: boolean;
}

export function LingxiLogo({ size = 32, collapsed = false }: LingxiLogoProps) {
  return (
    <div className="flex items-center gap-3">
      {/* Logo icon */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        {/* Rhino horn curve - represents "犀" */}
        <path
          d="M16 28 C16 28 6 22 6 12 C6 6 10 2 16 2 C22 2 26 6 26 12 C26 22 16 28 16 28Z"
          fill="url(#hornGrad)"
          opacity="0.15"
        />
        <path
          d="M16 26 C16 26 8 20.5 8 12 C8 7 11 4 16 4 C21 4 24 7 24 12 C24 20.5 16 26 16 26Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          className="text-brand-600 dark:text-brand-400"
        />

        {/* Horn tip - stylized rhino horn */}
        <path
          d="M16 4 C16 4 19 1 22 2"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          className="text-brand-600 dark:text-brand-400"
        />

        {/* Inspiration star at the tip - represents "灵" */}
        <path
          d="M23 1L23.5 2.5L25 3L23.5 3.5L23 5L22.5 3.5L21 3L22.5 2.5Z"
          fill="currentColor"
          className="text-brand-500 dark:text-brand-300"
        />

        {/* Eye / insight dot */}
        <circle
          cx="14"
          cy="13"
          r="2"
          fill="currentColor"
          className="text-brand-600 dark:text-brand-400"
        />

        <defs>
          <linearGradient id="hornGrad" x1="16" y1="2" x2="16" y2="28">
            <stop stopColor="currentColor" className="text-brand-500" />
            <stop offset="1" stopColor="currentColor" className="text-brand-300" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      {/* Text */}
      {!collapsed && (
        <span className="text-lg font-bold tracking-tight text-gray-800 dark:text-gray-100">
          灵犀
        </span>
      )}
    </div>
  );
}

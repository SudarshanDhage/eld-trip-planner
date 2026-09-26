import type * as React from "react";

interface SpotterLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

export function SpotterLogo({ size = 28, className, ...props }: SpotterLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      role="img"
      aria-label="Spotter Logo"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <title>Spotter Logo</title>
      <defs>
        <linearGradient id="spotterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>
      </defs>
      {/* Outer rounded hexagon shield */}
      <rect x="2" y="2" width="36" height="36" rx="9" fill="url(#spotterGrad)" />
      {/* Route paths & pinpoint */}
      <path
        d="M10 28L18 16L24 22L30 12"
        stroke="white"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Route pulse nodes */}
      <circle cx="10" cy="28" r="2.5" fill="white" />
      <circle cx="18" cy="16" r="2.2" fill="white" />
      <circle cx="24" cy="22" r="2.2" fill="white" />
      <circle cx="30" cy="12" r="3.2" fill="url(#accentGrad)" stroke="white" strokeWidth="1.5" />
    </svg>
  );
}

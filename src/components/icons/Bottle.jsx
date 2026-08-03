import React from 'react';

/** Lucide-compatible water bottle outline icon */
export function Bottle({ className, size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M9 2h6" />
      <path d="M10 2v2.2L8.5 6.5A2 2 0 0 0 8 7.8V9a2 2 0 0 0-1 1.7V20a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-9.3A2 2 0 0 0 16 9V7.8a2 2 0 0 0-.5-1.3L14 4.2V2" />
      <path d="M8 13h8" />
    </svg>
  );
}

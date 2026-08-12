import React from "react";

export const ChevronDown: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" {...props}>
    <path
      d="M6 9l6 6 6-6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const Sparkles: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" {...props}>
    <path
      d="M12 2l2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4zM20 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2zM4 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

import React from 'react';

interface LogoProps {
  size?: number;
}

export const CuralithraLogo: React.FC<LogoProps> = ({ size = 34 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <rect width="40" height="40" rx="10" fill="#1B2420" stroke="#287A59" strokeWidth="1.5" />
    <path
      d="M20 7.5C20 7.5 11 10.6 11 18.8C11 26.2 20 32.5 20 32.5C20 32.5 29 26.2 29 18.8C29 10.6 20 7.5 20 7.5Z"
      fill="#101412"
      stroke="#287A59"
      strokeWidth="1.5"
    />
    <path
      d="M12.5 20H16.2L18.1 14.5L21.1 24.5L23.2 18.2L24.7 20H27.6"
      stroke="#B8F36B"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

export const PhoenixIcon: React.FC<IconProps> = ({ size = 32, className }) => (
  <img
    src="/images/phoenix.png"
    alt="Phoenix"
    width={size}
    height={size}
    className={className}
    style={{ display: 'block', objectFit: 'contain', filter: 'drop-shadow(0 0 6px rgba(255, 140, 0, 0.7))' }}
  />
);

export const GuardIcon: React.FC<IconProps> = ({ size = 32, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={{ display: 'block', filter: 'drop-shadow(0 0 6px rgba(196, 255, 194, 0.6))' }}>
    <defs>
      <linearGradient id="guard-icon" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#c4ffc2" />
        <stop offset="100%" stopColor="#6abf69" />
      </linearGradient>
    </defs>
    {/* Shield shape */}
    <path
      d="M12 2 L4 6 L4 12 C4 17 8 21 12 22 C16 21 20 17 20 12 L20 6 Z"
      fill="url(#guard-icon)"
      opacity="0.85"
    />
    {/* Inner shield detail */}
    <path
      d="M12 5 L7 7.5 L7 12 C7 15.5 9.5 18.5 12 19.5 C14.5 18.5 17 15.5 17 12 L17 7.5 Z"
      fill="none"
      stroke="rgba(255,255,255,0.3)"
      strokeWidth="0.8"
    />
    {/* Cross emblem */}
    <line x1="12" y1="8" x2="12" y2="16" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="8.5" y1="12" x2="15.5" y2="12" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const DecoyIcon: React.FC<IconProps> = ({ size = 32, className }) => (
  <img
    src="/images/decoy.png"
    alt="Decoy"
    width={size}
    height={size}
    className={className}
    style={{ display: 'block', objectFit: 'contain', filter: 'drop-shadow(0 0 6px rgba(200, 200, 210, 0.6))' }}
  />
);

import React from 'react';

interface PhoenixLogoProps {
  size?: number;
  className?: string;
}

const PhoenixLogo: React.FC<PhoenixLogoProps> = ({ size = 48, className }) => (
  <img
    src="/images/phoenix.png"
    alt="The Phoenix Throne"
    width={size}
    height={size}
    className={className}
    style={{ objectFit: 'contain' }}
  />
);

export default PhoenixLogo;

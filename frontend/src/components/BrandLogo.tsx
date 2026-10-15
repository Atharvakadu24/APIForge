import React from 'react';

export interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showWordmark?: boolean;
  wordmarkClassName?: string;
  className?: string;
  iconOnly?: boolean;
  variant?: 'dark' | 'light';
}

export interface BrandIconProps {
  sizePx?: number;
  className?: string;
  title?: string;
}

export const BrandIcon: React.FC<BrandIconProps> = ({
  sizePx = 32,
  className = '',
  title = 'APIForge Logo',
}) => {
  // Use React.useId() sanitized into safe XML ID tokens to guarantee unique gradient references per instance
  const reactId = React.useId();
  const safeId = reactId.replace(/[^a-zA-Z0-9_-]/g, '') || '0';
  const bgGradId = `af-emblem-bg-${safeId}`;
  const blueGradId = `af-emblem-blue-${safeId}`;
  const violetGradId = `af-emblem-violet-${safeId}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={sizePx}
      height={sizePx}
      fill="none"
      className={`shrink-0 ${className}`}
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : 'presentation'}
    >
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={bgGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0B0F19" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>

        <linearGradient id={blueGradId} x1="10%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="35%" stopColor="#00A3FF" />
          <stop offset="80%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>

        <linearGradient id={violetGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#818CF8" />
          <stop offset="45%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#A855F7" />
        </linearGradient>
      </defs>

      {/* Rounded Container Box */}
      <rect
        width="100"
        height="100"
        rx="24"
        fill={`url(#${bgGradId})`}
        stroke="#1E293B"
        strokeWidth="2"
      />

      {/* Geometric 'A' Glyph with Energy/Forge Notch (evenodd ensures counter is always cut out cleanly) */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M 50 18
           C 51.5 18 52.8 18.8 53.6 20.2
           L 66.5 45.5
           C 67.2 46.9 66.4 48.5 64.8 48.8
           L 56.5 50.2
           C 54.8 50.5 53.8 52.2 54.5 53.8
           L 46.8 77.2
           C 46.2 78.8 44.0 79.1 43.1 77.6
           L 37.2 67.8
           C 36.5 66.6 35.1 66.0 33.7 66.4
           L 26.5 68.5
           C 24.5 69.1 22.8 67.4 23.3 65.4
           L 46.4 20.2
           C 47.2 18.8 48.5 18 50 18 Z
           M 49.8 32
           C 49.3 32 48.9 32.3 48.7 32.8
           L 39.5 52.5
           C 39.1 53.3 39.7 54.2 40.6 54.2
           L 55.4 54.2
           C 56.3 54.2 56.9 53.3 56.5 52.5
           L 50.9 32.8
           C 50.7 32.3 50.3 32 49.8 32 Z"
        fill={`url(#${blueGradId})`}
      />

      {/* Accent Detached Lower-Right Leg Capsule */}
      <rect
        x="60.5"
        y="56"
        width="12.5"
        height="24"
        rx="6.25"
        transform="rotate(-28 66.75 68)"
        fill={`url(#${violetGradId})`}
      />
    </svg>
  );
};

export default function BrandLogo({
  size = 'md',
  showWordmark = true,
  wordmarkClassName = '',
  className = '',
  iconOnly = false,
  variant = 'dark',
}: BrandLogoProps) {
  const sizeMap = {
    sm: { px: 24, text: 'text-sm' },
    md: { px: 28, text: 'text-base' },
    lg: { px: 44, text: 'text-2xl' },
    xl: { px: 56, text: 'text-3xl' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  if (iconOnly || !showWordmark) {
    return <BrandIcon sizePx={currentSize.px} className={className} />;
  }

  const isLight = variant === 'light';
  const apiColor = isLight ? 'text-slate-900' : 'text-white';
  const forgeGradient = isLight
    ? 'bg-gradient-to-r from-sky-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent'
    : 'bg-gradient-to-r from-sky-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent';

  return (
    <div className={`flex items-center space-x-2.5 ${className}`}>
      <BrandIcon sizePx={currentSize.px} />
      <span
        className={`font-black tracking-tight ${currentSize.text} ${wordmarkClassName}`}
      >
        <span className={apiColor}>API</span>
        <span className={forgeGradient}>
          Forge
        </span>
      </span>
    </div>
  );
}

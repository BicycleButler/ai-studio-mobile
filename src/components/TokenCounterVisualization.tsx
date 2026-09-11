import React from "react";

interface TokenCounterVisualizationProps {
  tokens: number;
  maxTokens?: number;
  onClick?: () => void;
  className?: string;
}

export const formatTokenNumber = (num: number): string => {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (num >= 10_000) {
    return `${(num / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return num.toLocaleString();
};

export const TokenCounterVisualization: React.FC<TokenCounterVisualizationProps> = ({
  tokens = 0,
  maxTokens = 1_000_000,
  onClick,
  className = "",
}) => {
  const safeTokens = Math.max(0, Math.round(tokens));
  const safeMax = Math.max(1, maxTokens);
  const ratio = Math.min(1, safeTokens / safeMax);
  const percentage = ratio * 100;

  // Visual SVG ring calculations
  const size = 18;
  const strokeWidth = 2.2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Ensure a tiny visible notch when tokens > 0 even if ratio is tiny
  const minStrokeOffset = safeTokens > 0 ? Math.min(circumference - 3, circumference * (1 - ratio)) : circumference;

  // Dynamic status color based on context window utilization
  let ringColor = "#38bdf8"; // Sky blue default
  let badgeBg = "rgba(56, 189, 248, 0.12)";
  let textColor = "text-sky-300";

  if (percentage >= 80) {
    ringColor = "#f43f5e"; // Rose high usage
    badgeBg = "rgba(244, 63, 94, 0.15)";
    textColor = "text-rose-300";
  } else if (percentage >= 50) {
    ringColor = "#fbbf24"; // Amber medium-high
    badgeBg = "rgba(251, 191, 36, 0.15)";
    textColor = "text-amber-300";
  }

  const tooltipText = `${safeTokens.toLocaleString()} / ${formatTokenNumber(safeMax)} tokens (${percentage.toFixed(percentage < 1 && percentage > 0 ? 2 : 1)}% context used)${onClick ? " • Tap to tune parameters" : ""}`;

  return (
    <button
      type="button"
      id="header-token-counter-viz"
      onClick={onClick}
      className={`h-8 flex items-center gap-1.5 px-2 sm:px-2.5 rounded-lg bg-[#1a1b20] hover:bg-[#25272e] border border-[#2c2e35] hover:border-[#3d404a] text-left transition-all active:scale-[0.98] group cursor-pointer ${className}`}
      title={tooltipText}
      aria-label={`Token count: ${tooltipText}`}
    >
      {/* SVG Radial Meter */}
      <div className="relative flex items-center justify-center shrink-0 w-[18px] h-[18px]">
        <svg
          width={size}
          height={size}
          className="-rotate-90 transform"
          viewBox={`0 0 ${size} ${size}`}
          aria-hidden="true"
        >
          {/* Background track circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#2e313b"
            strokeWidth={strokeWidth}
          />
          {/* Active progress fill */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={ringColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={minStrokeOffset}
            strokeLinecap="round"
            className="transition-all duration-300 ease-out"
          />
        </svg>

        {/* Center glowing dot indicator */}
        <span
          className="absolute w-1.5 h-1.5 rounded-full transition-colors"
          style={{ backgroundColor: ringColor, boxShadow: `0 0 6px ${badgeBg}` }}
          aria-hidden="true"
        />
      </div>

      {/* Token Counter Numbers & Context Label */}
      <div className="flex items-baseline gap-1 min-w-0 font-mono">
        <span className={`text-xs font-semibold tracking-tight ${textColor} group-hover:text-white transition-colors`}>
          {formatTokenNumber(safeTokens)}
        </span>
        <span className="text-[10px] text-[#71767b] hidden xs:inline font-normal">
          / {formatTokenNumber(safeMax)}
        </span>
      </div>
    </button>
  );
};

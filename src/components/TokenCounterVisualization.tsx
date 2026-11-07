import React from "react";

export interface TokenCounterVisualizationProps {
  tokens: number;
  maxTokens?: number;
  onClick?: () => void;
  className?: string;
  borderless?: boolean;
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
  borderless = false,
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

  // Status styling based on context window utilization per ADR 0036 (neutral at rest)
  const ringColorClass = "text-primary";
  const textColorClass = "text-foreground";

  const tooltipText = `${safeTokens.toLocaleString()} / ${formatTokenNumber(safeMax)} tokens (${percentage.toFixed(percentage < 1 && percentage > 0 ? 2 : 1)}% context used)${onClick ? " • Tap to tune parameters" : ""}`;

  return (
    <button
      type="button"
      id="header-token-counter-viz"
      onClick={onClick}
      className={`h-9 flex items-center gap-2 px-2.5 rounded-lg text-start transition active:scale-[0.98] group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        borderless
          ? "bg-transparent hover:bg-muted text-foreground border-none shadow-none"
          : "bg-card hover:bg-muted border border-border text-foreground shadow-xs"
      } ${className}`}
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
            stroke="currentColor"
            className="text-border"
            strokeWidth={strokeWidth}
          />
          {/* Active progress fill */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={minStrokeOffset}
            strokeLinecap="round"
            className={`transition-[stroke-dashoffset,stroke] duration-300 ease-out ${ringColorClass}`}
          />
        </svg>

        {/* Center indicator dot */}
        <span
          className="absolute w-1.5 h-1.5 rounded-full bg-primary transition"
          aria-hidden="true"
        />
      </div>

      {/* Token Counter Numbers & Context Label */}
      <div className="flex items-baseline gap-1 min-w-0 font-mono">
        <span className={`text-xs font-semibold tracking-tight ${textColorClass} transition`}>
          {formatTokenNumber(safeTokens)}
        </span>
        <span className="text-[10px] text-muted-foreground hidden xs:inline font-normal">
          / {formatTokenNumber(safeMax)}
        </span>
      </div>
    </button>
  );
};

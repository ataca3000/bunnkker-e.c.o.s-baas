interface QualityScoreGaugeProps {
  score: number;
  size?: number;
}

export function QualityScoreGauge({ score, size = 160 }: QualityScoreGaugeProps) {
  const radius = (size / 2) * 0.75;
  const strokeWidth = size * 0.075;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, score));
  const offset = circumference - (clampedScore / 100) * circumference;

  const color =
    clampedScore >= 90 ? '#22c55e' :
    clampedScore >= 80 ? '#f59e0b' :
    clampedScore >= 60 ? '#f97316' :
    '#ef4444';

  const label =
    clampedScore >= 90 ? 'Excellent' :
    clampedScore >= 80 ? 'Good' :
    clampedScore >= 60 ? 'Fair' :
    'Poor';

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Track */}
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted-foreground/20"
        />
        {/* Progress arc */}
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        {/* Score text */}
        <text
          x={cx} y={cy - size * 0.04}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={size * 0.22}
          fontWeight="700"
          fill={color}
        >
          {clampedScore}
        </text>
        <text
          x={cx} y={cy + size * 0.165}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={size * 0.09}
          fill="currentColor"
          opacity="0.5"
        >
          / 100
        </text>
      </svg>
      <span className="text-sm font-medium" style={{ color }}>{label}</span>
    </div>
  );
}

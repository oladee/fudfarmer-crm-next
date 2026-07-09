type MetricValueProps = Readonly<{
  value: string | number;
  className?: string;
}>;

function valueSizeClass(value: string): string {
  const compactLen = value.replace(/\s+/g, '').length;
  if (compactLen >= 20) return 'text-xs';
  if (compactLen >= 16) return 'text-sm';
  if (compactLen >= 12) return 'text-base';
  if (compactLen >= 9) return 'text-lg';
  return 'text-2xl';
}

export function MetricValue({ value, className = '' }: MetricValueProps) {
  const text = String(value ?? '—');
  return (
    <p
      className={`${valueSizeClass(text)} font-black leading-tight break-words ${className}`.trim()}
      title={text}
    >
      {text}
    </p>
  );
}

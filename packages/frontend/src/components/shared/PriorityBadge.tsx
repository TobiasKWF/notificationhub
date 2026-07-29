import { Badge } from '@/components/ui/badge';

const VARIANTS: Record<string, string> = {
  EMERGENCY: 'bg-purple-700 text-white border-purple-700',
  CRITICAL:  'bg-red-600   text-white border-red-600',
  ERROR:     'bg-red-500   text-white border-red-500',
  WARNING:   'bg-yellow-500 text-black border-yellow-500',
  INFO:      'bg-blue-500  text-white border-blue-500',
  SUCCESS:   'bg-green-600 text-white border-green-600',
};

export function PriorityBadge({ priority }: { priority: string }) {
  const cls = VARIANTS[priority.toUpperCase()] ?? 'bg-muted text-muted-foreground';
  return (
    <Badge className={`text-[10px] px-1.5 py-0 font-semibold uppercase tracking-wide border ${cls}`}>
      {priority}
    </Badge>
  );
}

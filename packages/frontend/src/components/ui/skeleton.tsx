import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-md bg-muted animate-shimmer',
        'bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%]',
        className,
      )}
      {...props}
    />
  );
}

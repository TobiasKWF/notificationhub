import * as Toast from '@radix-ui/react-toast';
import { useToastStore } from '@/stores/toast';
import { cn } from '@/lib/utils';

export function Toaster() {
  const { toasts, dismiss } = useToastStore();
  return (
    <Toast.Provider swipeDirection="right">
      {toasts.map((t) => (
        <Toast.Root
          key={t.id}
          open
          onOpenChange={(open) => !open && dismiss(t.id)}
          className={cn(
            'group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-4 shadow-lg transition-all',
            'bg-background border-border',
            t.variant === 'destructive' && 'border-destructive bg-destructive text-destructive-foreground',
          )}
        >
          <div className="grid gap-1">
            {t.title && <Toast.Title className="text-sm font-semibold">{t.title}</Toast.Title>}
            {t.description && <Toast.Description className="text-sm opacity-90">{t.description}</Toast.Description>}
          </div>
          <Toast.Close className="opacity-60 hover:opacity-100 transition-opacity text-lg leading-none">×</Toast.Close>
        </Toast.Root>
      ))}
      <Toast.Viewport className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-96 max-w-[100vw]" />
    </Toast.Provider>
  );
}

import { Switch } from "@/components/ui/switch";

export function SyncToggle({
  enabled,
  isPending,
  onChange,
}: {
  enabled: boolean;
  isPending: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div
      onClick={() => !isPending && onChange(!enabled)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (!isPending) onChange(!enabled);
        }
      }}
      className="inline-flex cursor-pointer select-none items-center gap-3 rounded-full border border-border bg-secondary/60 px-3.5 py-1.5 text-xs transition-colors hover:bg-secondary/90 hover:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary"
    >
      <span
        className={`size-2.5 rounded-full transition-colors ${
          enabled ? "bg-success ring-2 ring-success/30" : "bg-muted-foreground/50"
        }`}
        aria-hidden
      />

      <span className="font-semibold uppercase tracking-wide text-foreground">
        Sync: {enabled ? "ON" : "OFF"}
      </span>
      <Switch
        checked={enabled}
        disabled={isPending}
        onCheckedChange={onChange}
        onClick={(e) => e.stopPropagation()}
        aria-label={enabled ? "Turn attendance sync off" : "Turn attendance sync on"}
      />
    </div>
  );
}

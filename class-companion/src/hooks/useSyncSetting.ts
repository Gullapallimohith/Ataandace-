import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "class-companion:sync-enabled";

function getStoredValue(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const val = window.localStorage.getItem(STORAGE_KEY);
    return val === "true";
  } catch {
    return false;
  }
}

export function useSyncSetting() {
  const queryClient = useQueryClient();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    const stored = getStoredValue();
    queryClient.setQueryData(["app_settings"], (old: boolean | undefined) => old ?? stored);
  }, [queryClient]);

  const query = useQuery({
    queryKey: ["app_settings"],
    queryFn: async (): Promise<boolean> => {
      try {
        const { data, error } = await supabase
          .from("app_settings")
          .select("sync_enabled")
          .eq("id", 1)
          .maybeSingle();

        if (error) {
          console.warn("[useSyncSetting] Could not fetch remote sync setting, using local state:", error.message);
          return getStoredValue();
        }

        const value = Boolean(data?.sync_enabled);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_KEY, String(value));
        }
        return value;
      } catch (err) {
        console.warn("[useSyncSetting] Supabase connection error:", err);
        return getStoredValue();
      }
    },
    enabled: hydrated,
    initialData: getStoredValue,
  });

  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      // Persist locally immediately so the UI toggle is instant and never breaks
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(STORAGE_KEY, String(next));
        } catch {}
      }

      // Sync to Supabase in the background if connected
      try {
        const { error } = await supabase
          .from("app_settings")
          .update({ sync_enabled: next, updated_at: new Date().toISOString() })
          .eq("id", 1);
        if (error) {
          console.warn("[useSyncSetting] Supabase update warning:", error.message);
        }
      } catch (err) {
        console.warn("[useSyncSetting] Supabase network error on toggle:", err);
      }
      return next;
    },
    onMutate: async (next: boolean) => {
      // Optimistic update for instant feedback
      await queryClient.cancelQueries({ queryKey: ["app_settings"] });
      const prev = queryClient.getQueryData<boolean>(["app_settings"]);
      queryClient.setQueryData(["app_settings"], next);
      return { prev };
    },
    onError: (_err, _next, context) => {
      if (context?.prev !== undefined) {
        queryClient.setQueryData(["app_settings"], context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["app_settings"] });
    },
  });

  useEffect(() => {
    try {
      const channel = supabase
        .channel("app-settings-live")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "app_settings" },
          () => queryClient.invalidateQueries({ queryKey: ["app_settings"] }),
        )
        .subscribe();
      return () => {
        void supabase.removeChannel(channel);
      };
    } catch {}
  }, [queryClient]);

  const enabled = query.data ?? getStoredValue();

  return {
    enabled,
    isPending: toggle.isPending,
    setEnabled: (next: boolean) => toggle.mutate(next),
  };
}

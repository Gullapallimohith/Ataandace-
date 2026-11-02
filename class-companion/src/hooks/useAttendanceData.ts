import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Snapshot = {
  coursecode: string;
  coursedesc: string | null;
  ltps: string | null;
  section: string;
  total_conducted: number;
  total_attended: number;
  updated_at: string;
};

export type HistoryEntry = {
  id: string;
  coursecode: string;
  coursedesc: string | null;
  section: string | null;
  status: string;
  date: string;
  note: string | null;
  created_at: string;
};

export function useAttendanceData(enabled = true, semesterKey = "2026-2027_odd") {
  const queryClient = useQueryClient();

  const snapshots = useQuery({
    queryKey: ["attendance_snapshot", semesterKey],
    queryFn: async (): Promise<Snapshot[]> => {
      // First try fetching from backend with semesterKey filter
      try {
        const res = await fetch(`/api/public/get-attendance?semesterKey=${encodeURIComponent(semesterKey)}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const json = await res.json();
          if (json.snapshots && json.snapshots.length > 0) {
            return json.snapshots as Snapshot[];
          }
        }
      } catch {}

      // Fallback to Supabase if default semester
      if (semesterKey === "2026-2027_odd") {
        try {
          const { data, error } = await supabase
            .from("attendance_snapshot")
            .select("*")
            .order("coursecode");
          if (!error && data && data.length > 0) {
            return data as Snapshot[];
          }
        } catch {}
      }

      return [];
    },
    enabled: true,
    refetchOnWindowFocus: enabled,
    refetchInterval: enabled ? 10_000 : false,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });

  const history = useQuery({
    queryKey: ["attendance_history", semesterKey],
    queryFn: async (): Promise<HistoryEntry[]> => {
      try {
        const res = await fetch(`/api/public/get-attendance?semesterKey=${encodeURIComponent(semesterKey)}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const json = await res.json();
          if (json.history && json.history.length > 0) {
            return json.history as HistoryEntry[];
          }
        }
      } catch {}

      if (semesterKey === "2026-2027_odd") {
        try {
          const { data, error } = await supabase
            .from("attendance_history")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(100);
          if (!error && data && data.length > 0) {
            return data as HistoryEntry[];
          }
        } catch {}
      }

      return [];
    },
    enabled: true,
    refetchOnWindowFocus: enabled,
    refetchInterval: enabled ? 10_000 : false,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });

  useEffect(() => {
    if (!enabled || semesterKey !== "2026-2027_odd") return;
    const channel = supabase
      .channel("attendance-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_snapshot" },
        () => queryClient.invalidateQueries({ queryKey: ["attendance_snapshot"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_history" },
        () => queryClient.invalidateQueries({ queryKey: ["attendance_history"] }),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, enabled, semesterKey]);

  return { snapshots, history };
}

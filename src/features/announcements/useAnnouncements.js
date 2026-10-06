import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase.js";
import { useAuth } from "../auth/AuthContext.jsx";

const FIELDS = "id, title, body, group_no, pinned, author_id, author_name, author_role, created_at, updated_at";

/** Announcements visible to the current student (database filters by group). Pinned first. */
export function useAnnouncements(limit = 50) {
  const { status: authStatus } = useAuth();
  const [state, setState] = useState({ status: "loading", items: [] });

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("announcements")
      .select(FIELDS)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    setState(error ? { status: "error", items: [] } : { status: "ready", items: data });
  }, [limit]);

  useEffect(() => {
    if (authStatus === "signedIn") load();
  }, [authStatus, load]);

  return { ...state, reload: load };
}

export async function saveAnnouncement(id, values) {
  const payload = {
    title: values.title.trim(),
    body: values.body.trim() || null,
    group_no: values.groupNo === "both" ? null : Number(values.groupNo),
    pinned: Boolean(values.pinned),
  };
  const { error } = id
    ? await supabase.from("announcements").update(payload).eq("id", id)
    : await supabase.from("announcements").insert(payload);
  if (error) throw error;
}

export async function deleteAnnouncement(id) {
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) throw error;
}

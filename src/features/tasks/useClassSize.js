import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase.js";
import { useAuth } from "../auth/AuthContext.jsx";

/**
 * Admin only: how many students an assignment targets (for "7/18 done").
 * Returns a function (groupNo|null) => count, or null for non-admins.
 */
export function useClassSize() {
  const { isAdmin } = useAuth();
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("students")
      .select("group_no")
      .then(({ data, error }) => {
        if (error || !data) return;
        const byGroup = { 1: 0, 2: 0 };
        for (const row of data) byGroup[row.group_no] += 1;
        setCounts(byGroup);
      });
  }, [isAdmin]);

  if (!isAdmin || !counts) return null;
  return (groupNo) => (groupNo ? counts[groupNo] : counts[1] + counts[2]);
}

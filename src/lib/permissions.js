// Mirrors the database rules (private.can_post_to_group / can_manage_group_item).
// Only decides which buttons to show — the database enforces the real permission.

/** Group choices a student may post to: admin → any; others → shared or own group. */
export function groupChoices(student, isAdmin, sharedLabel = "Екі топқа") {
  if (isAdmin) return [{ id: "both", label: sharedLabel }, { id: "1", label: "1-топ" }, { id: "2", label: "2-топ" }];
  return [{ id: "both", label: sharedLabel }, { id: String(student?.group_no), label: `${student?.group_no}-топ` }];
}

/** Author, the monitor of that item's group, or the admin. */
export function canManageItem(student, isAdmin, createdBy, groupNo) {
  if (!student) return false;
  if (isAdmin) return true;
  if (createdBy && createdBy === student.id) return true;
  return Boolean(student.is_monitor && groupNo && groupNo === student.group_no);
}

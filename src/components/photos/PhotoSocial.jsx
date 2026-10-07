import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, Trash2, X } from "lucide-react";
import { REACTIONS, addComment, deleteComment, fetchSocial, setReaction } from "../../features/photos/photoSocial.js";
import { useAuth } from "../../features/auth/AuthContext.jsx";
import { formatDateTime } from "../../lib/due.js";

function whoReacted(reactions) {
  const names = [...new Set(reactions.map((row) => row.student_name).filter(Boolean))];
  if (names.length === 0) return null;
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} және тағы ${names.length - 3}`;
}

/**
 * Reactions bar + comments sheet for one photo inside the viewer.
 * canModerate(comment) decides whether the delete button shows (the database decides for real).
 */
export default function PhotoSocial({ photo, commentsOpen, onCommentsOpenChange, onChanged }) {
  const { student, isAdmin } = useAuth();
  const [state, setState] = useState({ status: "loading", reactions: [], comments: [] });
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const listRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", reactions: [], comments: [] });
    setError(null);
    fetchSocial(photo.id)
      .then((data) => !cancelled && setState({ status: "ready", ...data }))
      .catch(() => !cancelled && setState({ status: "error", reactions: [], comments: [] }));
    return () => {
      cancelled = true;
    };
  }, [photo.id]);

  useEffect(() => {
    if (commentsOpen && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [commentsOpen, state.comments.length]);

  const mine = new Set(state.reactions.filter((row) => row.student_id === student?.id).map((row) => row.emoji));
  const counts = Object.fromEntries(REACTIONS.map((emoji) => [emoji, state.reactions.filter((row) => row.emoji === emoji).length]));

  async function toggle(emoji) {
    const on = !mine.has(emoji);
    const previous = state.reactions;
    // Optimistic: update at once, roll back if the server says no.
    setState((current) => ({
      ...current,
      reactions: on
        ? [...current.reactions, { student_id: student.id, student_name: student.full_name, emoji }]
        : current.reactions.filter((row) => !(row.student_id === student.id && row.emoji === emoji)),
    }));
    try {
      await setReaction(photo.id, emoji, on);
      onChanged?.();
    } catch {
      setState((current) => ({ ...current, reactions: previous }));
    }
  }

  async function send(event) {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const comment = await addComment(photo.id, draft);
      setState((current) => ({ ...current, comments: [...current.comments, comment] }));
      setDraft("");
      onChanged?.();
    } catch (sendError) {
      setError(sendError?.message?.includes("comment limit") ? "Тым көп пікір. Сәл кейін жаз." : "Жіберілмеді. Қайта көр.");
    }
    setSending(false);
  }

  async function remove(comment) {
    if (!window.confirm("Пікірді жою керек пе?")) return;
    try {
      await deleteComment(comment.id);
      setState((current) => ({ ...current, comments: current.comments.filter((item) => item.id !== comment.id) }));
      onChanged?.();
    } catch {
      setError("Жойылмады.");
    }
  }

  const canRemove = (comment) =>
    isAdmin ||
    comment.student_id === student?.id ||
    photo.uploaded_by === student?.id ||
    (student?.is_monitor && photo.group_no && photo.group_no === student.group_no);

  const who = whoReacted(state.reactions);

  return (
    <>
      <div className="social">
        <div className="social__reactions">
          <div className="social__emojis" role="group" aria-label="Реакциялар">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className={`reaction${mine.has(emoji) ? " is-mine" : ""}`}
              onClick={() => toggle(emoji)}
              aria-pressed={mine.has(emoji)}
              disabled={state.status !== "ready"}
            >
              <span className="reaction__emoji">{emoji}</span>
              {counts[emoji] > 0 && <span className="reaction__count">{counts[emoji]}</span>}
            </button>
          ))}
          </div>
          <button type="button" className="reaction reaction--comments" onClick={() => onCommentsOpenChange(true)} aria-label="Пікірлер">
            <MessageCircle size={17} />
            {state.comments.length > 0 && <span className="reaction__count">{state.comments.length}</span>}
          </button>
        </div>
        {who && <p className="social__who">{who}</p>}
      </div>

      {commentsOpen && (
        <div className="comments" role="dialog" aria-label="Пікірлер">
          <div className="comments__head">
            <strong>Пікірлер {state.comments.length > 0 && <span className="muted">{state.comments.length}</span>}</strong>
            <button type="button" className="icon-button icon-button--glass" onClick={() => onCommentsOpenChange(false)} aria-label="Жабу">
              <X size={18} />
            </button>
          </div>
          <ul className="comments__list" ref={listRef}>
            {state.status === "ready" && state.comments.length === 0 && <li className="comments__empty">Әзірге пікір жоқ. Бірінші болып жаз!</li>}
            {state.status === "error" && <li className="comments__empty">Пікірлер жүктелмеді.</li>}
            {state.comments.map((comment) => (
              <li key={comment.id} className={`comment${comment.student_id === student?.id ? " is-mine" : ""}`}>
                <span className="comment__avatar" aria-hidden="true">{(comment.author_name ?? "?").slice(0, 1)}</span>
                <div className="comment__body">
                  <div className="comment__meta">
                    <strong>{comment.author_name ?? "—"}</strong>
                    <span>{formatDateTime(comment.created_at)}</span>
                  </div>
                  <p>{comment.body}</p>
                </div>
                {canRemove(comment) && (
                  <button type="button" className="comment__delete" onClick={() => remove(comment)} aria-label="Пікірді жою">
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {error && <p className="form__error comments__error" role="alert">{error}</p>}
          <form className="comments__form" onSubmit={send}>
            <input
              className="input"
              value={draft}
              maxLength={500}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Пікір жаз…"
              aria-label="Пікір"
              enterKeyHint="send"
            />
            <button type="submit" className="button button--primary comments__send" disabled={!draft.trim() || sending} aria-label="Жіберу">
              <Send size={17} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

import { useEffect, useRef, useState } from "react";
import { CloudOff, ImagePlus, Megaphone, Plus, X } from "lucide-react";
import PageHeader from "../components/ui/PageHeader.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Modal from "../components/ui/Modal.jsx";
import Segmented from "../components/ui/Segmented.jsx";
import AnnouncementCard from "../components/AnnouncementCard.jsx";
import {
  ANNOUNCEMENT_BUCKET,
  MAX_ANNOUNCEMENT_IMAGES,
  addAnnouncementImages,
  announcementImages,
  deleteAnnouncement,
  removeAnnouncementImages,
  saveAnnouncement,
  useAnnouncements,
} from "../features/announcements/useAnnouncements.js";
import { signedUrls } from "../lib/signedUrls.js";
import { holdBusy } from "../lib/busy.js";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { useMarkSeen } from "../features/unread/UnreadContext.jsx";

function AnnouncementForm({ item, onClose, onSaved }) {
  const { isAdmin, student } = useAuth();
  const groupOptions = isAdmin
    ? [{ id: "both", label: "Барлығына" }, { id: "1", label: "1-топ" }, { id: "2", label: "2-топ" }]
    : [{ id: "both", label: "Барлығына" }, { id: String(student.group_no), label: `${student.group_no}-топ` }];
  const [values, setValues] = useState({
    title: item?.title ?? "",
    body: item?.body ?? "",
    groupNo: item?.group_no ? String(item.group_no) : "both",
    pinned: item?.pinned ?? false,
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (key) => (value) => setValues((current) => ({ ...current, [key]: value }));

  // Photos: the ones already saved (can be removed) and new ones picked on this device.
  const [kept, setKept] = useState(() => announcementImages(item));
  const [removed, setRemoved] = useState([]);
  const [added, setAdded] = useState([]); // { file, preview }
  const [keptUrls, setKeptUrls] = useState({});
  const fileInput = useRef(null);
  const addedRef = useRef(added);
  addedRef.current = added;
  const total = kept.length + added.length;

  useEffect(() => {
    const paths = announcementImages(item).map((image) => image.storage_path);
    if (paths.length) signedUrls(ANNOUNCEMENT_BUCKET, paths).then(setKeptUrls).catch(() => {});
  }, [item]);
  useEffect(() => () => addedRef.current.forEach((entry) => URL.revokeObjectURL(entry.preview)), []);

  function pick(event) {
    const files = [...(event.target.files ?? [])].filter((file) => file.type.startsWith("image/"));
    event.target.value = "";
    const room = MAX_ANNOUNCEMENT_IMAGES - total;
    if (files.length > room) setError(`Бір хабарландыруға ${MAX_ANNOUNCEMENT_IMAGES} фотоға дейін.`);
    setAdded((current) => [...current, ...files.slice(0, Math.max(room, 0)).map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
  }

  async function submit(event) {
    event.preventDefault();
    if (!values.title.trim()) return setError("Тақырыбын жаз.");
    setBusy(true);
    setError(null);
    const release = holdBusy();
    let savedId = item?.id ?? null;
    try {
      savedId = await saveAnnouncement(item?.id, values);
      await removeAnnouncementImages(removed);
      const nextPosition = kept.reduce((max, image) => Math.max(max, image.position + 1), 0);
      await addAnnouncementImages(savedId, added.map((entry) => entry.file), nextPosition);
      await onSaved();
      onClose();
    } catch (saveError) {
      if (savedId && savedId !== item?.id) await onSaved(); // the text is saved even if a photo failed
      setError(
        saveError?.code === "42501"
          ? "Бұл топқа хабарландыру жариялауға рұқсатың жоқ."
          : savedId
            ? "Мәтін сақталды, бірақ кейбір фото жүктелмеді. Қайта көр."
            : "Сақталмады. Қайта көр."
      );
      setBusy(false);
    } finally {
      release();
    }
  }

  return (
    <Modal title={item ? "Хабарландыруды өзгерту" : "Жаңа хабарландыру"} onClose={busy ? () => {} : onClose}>
      <form className="upload" onSubmit={submit}>
        <div className="field">
          <label className="field__label" htmlFor="an-title">Тақырып</label>
          <input id="an-title" className="input" maxLength={120} value={values.title} onChange={(event) => set("title")(event.target.value)} placeholder="Мысалы: Ертең Аэродинамика 10Б-1-де емес, 114-те" />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="an-body">Мәтін <span className="muted">(міндетті емес)</span></label>
          <textarea id="an-body" className="input input--textarea" rows={4} maxLength={3000} value={values.body} onChange={(event) => set("body")(event.target.value)} />
        </div>
        <div className="field">
          <span className="field__label">Кімге</span>
          <Segmented label="Кімге" options={groupOptions} value={values.groupNo} onChange={set("groupNo")} />
        </div>
        <div className="field">
          <span className="field__label">
            Фото <span className="muted">(міндетті емес, {MAX_ANNOUNCEMENT_IMAGES}-ке дейін)</span>
          </span>
          <div className="ann-photos">
            {kept.map((image) => (
              <div key={image.id} className="ann-photos__item">
                {keptUrls[image.storage_path] && <img src={keptUrls[image.storage_path]} alt="" />}
                <button
                  type="button"
                  className="ann-photos__remove"
                  aria-label="Фотоны алып тастау"
                  onClick={() => {
                    setKept((current) => current.filter((entry) => entry.id !== image.id));
                    setRemoved((current) => [...current, image]);
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {added.map((entry) => (
              <div key={entry.preview} className="ann-photos__item">
                <img src={entry.preview} alt="" />
                <button
                  type="button"
                  className="ann-photos__remove"
                  aria-label="Фотоны алып тастау"
                  onClick={() => {
                    URL.revokeObjectURL(entry.preview);
                    setAdded((current) => current.filter((other) => other !== entry));
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {total < MAX_ANNOUNCEMENT_IMAGES && (
              <button type="button" className="ann-photos__add" onClick={() => fileInput.current?.click()}>
                <ImagePlus size={20} />
                <span>Қосу</span>
              </button>
            )}
          </div>
          <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={pick} />
        </div>
        {isAdmin && (
          <label className="toggle">
            <span>Басты бетте бекіту</span>
            <input type="checkbox" checked={values.pinned} onChange={(event) => set("pinned")(event.target.checked)} />
            <span className="toggle__track" aria-hidden="true" />
          </label>
        )}
        {error && <p className="form__error" role="alert">{error}</p>}
        <button type="submit" className="button button--primary button--block" disabled={busy}>
          {busy ? (added.length ? "Фото жүктелуде…" : "Жариялануда…") : item ? "Сақтау" : "Жариялау"}
        </button>
      </form>
    </Modal>
  );
}

export default function AnnouncementsPage() {
  useMarkSeen("announcements");
  const { status, items, reload } = useAnnouncements();
  const { isAdmin, student } = useAuth();
  const canPost = isAdmin || student?.is_monitor;
  const [editing, setEditing] = useState(null); // null | {} (new) | item

  async function remove(item) {
    if (!window.confirm(`«${item.title}» хабарландыруын жою керек пе?`)) return;
    try {
      await deleteAnnouncement(item.id);
      reload();
    } catch {
      window.alert("Жойылмады.");
    }
  }

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Сынып"
        title="Хабарландырулар"
        description="Әкімші мен топ старосталарының хабарландырулары: аудитория ауысуы, сабақ уақыты, емтихан туралы."
        actions={
          canPost && (
            <button type="button" className="button button--primary" onClick={() => setEditing({})}>
              <Plus size={17} /> Жариялау
            </button>
          )
        }
      />

      {status === "loading" && <div className="skeleton-list" aria-busy="true"><span /><span /></div>}
      {status === "error" && (
        <EmptyState icon={CloudOff} title="Жүктелмеді" action={<button type="button" className="button button--ghost" onClick={reload}>Қайта көру</button>} />
      )}
      {status === "ready" && items.length === 0 && (
        <EmptyState icon={Megaphone} title="Әзірге хабарландыру жоқ" compact>
          {canPost ? "Алғашқы хабарландыруды жарияла." : "Жаңа хабарландыру осында шығады."}
        </EmptyState>
      )}
      {status === "ready" && items.length > 0 && (
        <div className="announcement-list">
          {items.map((item) => (
            <AnnouncementCard
              key={item.id}
              item={item}
              canManage={isAdmin || item.author_id === student?.id}
              onEdit={() => setEditing(item)}
              onDelete={() => remove(item)}
            />
          ))}
        </div>
      )}

      {editing && (
        <AnnouncementForm item={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={reload} />
      )}
    </div>
  );
}

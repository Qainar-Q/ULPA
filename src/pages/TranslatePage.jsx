import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Copy, ImagePlus, Languages, NotebookPen, Trash2, Type, X } from "lucide-react";
import PageHeader from "../components/ui/PageHeader.jsx";
import Segmented from "../components/ui/Segmented.jsx";
import Markdown from "../components/ui/Markdown.jsx";
import { deleteTranslation, listTranslations, translate } from "../features/classlife/classlifeApi.js";
import { storeDraft } from "../features/notes/notesApi.js";
import { resizeToJpeg } from "../features/photos/imageProcessing.js";
import { formatDateTime } from "../lib/due.js";

const MAX_IMAGES = 5;
const ERRORS = {
  not_configured: "Аударма әлі іске қосылмаған — әкімші Claude API кілтін қосуы керек.",
  limit: "Бүгінгі лимитің бітті (күніне 15 аударма). Ертең қайта көр.",
  class_limit: "Бүгін бүкіл топтың лимиті бітті. Ертең қайта көр.",
  busy: "Claude қазір бос емес. Бір минуттан кейін қайта көр.",
  no_credit: "API балансы бітті — әкімшіге айт.",
  bad_key: "API кілті қате — әкімшіге айт.",
  bad_image: "Бұл суретті оқи алмадым. JPG/PNG скриншот не фото жібер.",
  too_long: "Мәтін тым ұзын. Бөліп жібер (12 000 таңбаға дейін).",
  network: "Интернет байланысын тексер.",
};

function copyText(text) {
  return navigator.clipboard?.writeText(text).then(
    () => true,
    () => false
  );
}

function ResultCard({ item, onSaveNote, onDelete }) {
  const [copied, setCopied] = useState(false);
  return (
    <article className="panel translation">
      <header className="translation__head">
        <span className="muted small">
          {item.label ?? (item.source_kind === "image" ? "Сурет" : "Мәтін")} · {formatDateTime(item.created_at)}
        </span>
        <div className="translation__actions">
          <button
            type="button"
            className="button button--ghost button--sm"
            onClick={async () => {
              setCopied(await copyText(item.result));
              setTimeout(() => setCopied(false), 1800);
            }}
          >
            <Copy size={14} /> {copied ? "Көшірілді ✓" : "Көшіру"}
          </button>
          <button type="button" className="button button--ghost button--sm" onClick={() => onSaveNote(item)}>
            <NotebookPen size={14} /> Конспектіге
          </button>
          {onDelete && (
            <button type="button" className="icon-button icon-button--danger" onClick={() => onDelete(item)} aria-label="Жою">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </header>
      {item.truncated && <p className="muted small">Мәтін өте ұзын болды — соңы қысқарған болуы мүмкін. Бетті бөліп жібер.</p>}
      <Markdown text={item.result} />
    </article>
  );
}

export default function TranslatePage() {
  const navigate = useNavigate();
  const [source, setSource] = useState("image");
  const [images, setImages] = useState([]); // [{ file, url }]
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(null); // "2/3"
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const [history, setHistory] = useState([]);
  const [remaining, setRemaining] = useState(null);
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

  useEffect(() => {
    listTranslations().then(setHistory).catch(() => {});
  }, []);

  const imagesRef = useRef(images);
  imagesRef.current = images;
  useEffect(() => () => imagesRef.current.forEach((image) => URL.revokeObjectURL(image.url)), []);

  function addFiles(list) {
    const files = [...list].filter((file) => file.type.startsWith("image/"));
    if (files.length === 0) return;
    setError(null);
    setImages((current) => [...current, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))].slice(0, MAX_IMAGES));
  }

  // Paste a screenshot with Ctrl+V.
  useEffect(() => {
    function onPaste(event) {
      const files = [...(event.clipboardData?.files ?? [])];
      if (files.some((file) => file.type.startsWith("image/"))) {
        setSource("image");
        addFiles(files);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  async function run() {
    setError(null);
    const jobs = source === "image" ? images.map((image, index) => ({ image, label: `${index + 1}-бет` })) : [{ text: text.trim(), label: "Мәтін" }];
    if (source === "image" && jobs.length === 0) return setError("Алдымен сурет таңда.");
    if (source === "text" && !text.trim()) return setError("Орысша мәтінді қой.");
    const done = [];
    for (let i = 0; i < jobs.length; i += 1) {
      setBusy(jobs.length > 1 ? `${i + 1}/${jobs.length}` : "1");
      try {
        const job = jobs[i];
        const imageBlob = job.image ? await resizeToJpeg(job.image.file, 1568, 0.85) : null;
        const data = await translate({ imageBlob, text: job.text ?? "" });
        done.push({ id: data.id, result: data.result, created_at: data.created_at ?? new Date().toISOString(), source_kind: job.image ? "image" : "text", label: job.label, truncated: data.truncated });
        setRemaining(data.remaining);
        setResults([...done]);
      } catch (translateError) {
        setError(ERRORS[translateError?.message] ?? "Аударылмады. Қайта көр.");
        break;
      }
    }
    if (done.length) {
      setHistory((current) => [...done.slice().reverse(), ...current]);
      if (source === "image") {
        images.forEach((image) => URL.revokeObjectURL(image.url));
        setImages([]);
      }
    }
    setBusy(null);
  }

  function saveAsNote(item) {
    const firstHeading = /^#{1,3}\s+(.+)$/m.exec(item.result)?.[1];
    storeDraft(null, { title: (firstHeading ?? "Аударма").slice(0, 120), body: item.result, courseSlug: "", lessonDate: "" });
    navigate("/notes/new");
  }

  async function remove(item) {
    if (!window.confirm("Бұл аударманы тарихтан жою керек пе?")) return;
    try {
      await deleteTranslation(item.id);
      setHistory((current) => current.filter((row) => row.id !== item.id));
    } catch {
      setError("Жойылмады.");
    }
  }

  const shownIds = new Set(results.map((item) => item.id));

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Claude AI"
        title="Орысша → қазақша"
        description="Орысша оқулықтың бетін суретке түсір не скриншот жібер — Claude оқып, формулаларын сақтап, қазақшаға аударады."
      />

      <section className="panel translate-input">
        <Segmented
          label="Не аударамыз"
          options={[
            { id: "image", label: "Сурет / скриншот" },
            { id: "text", label: "Мәтін" },
          ]}
          value={source}
          onChange={setSource}
        />

        {source === "image" ? (
          <>
            <div className="translate-drop">
              {images.length === 0 ? (
                <p className="muted">
                  <ImagePlus size={28} aria-hidden="true" />
                  <br />
                  Бір немесе бірнеше бет (5-ке дейін). Компьютерде скриншотты Ctrl+V арқылы қоюға болады.
                </p>
              ) : (
                <ul className="translate-thumbs">
                  {images.map((image, index) => (
                    <li key={image.url}>
                      <img src={image.url} alt={`${index + 1}-бет`} />
                      <button type="button" className="icon-button" onClick={() => {
                          URL.revokeObjectURL(image.url);
                          setImages(images.filter((_, i) => i !== index));
                        }} aria-label="Алып тастау" disabled={Boolean(busy)}>
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="translate-pick">
                <button type="button" className="button button--ghost" onClick={() => cameraRef.current?.click()} disabled={Boolean(busy) || images.length >= MAX_IMAGES}>
                  <Camera size={16} /> Суретке түсіру
                </button>
                <button type="button" className="button button--ghost" onClick={() => galleryRef.current?.click()} disabled={Boolean(busy) || images.length >= MAX_IMAGES}>
                  <ImagePlus size={16} /> Галереядан
                </button>
              </div>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />
              <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />
            </div>
          </>
        ) : (
          <textarea
            className="input input--textarea"
            rows={8}
            maxLength={12000}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Орысша мәтінді осында қой…"
            aria-label="Орысша мәтін"
          />
        )}

        {error && <p className="form__error" role="alert">{error}</p>}
        <button type="button" className="button button--primary button--block" onClick={run} disabled={Boolean(busy)}>
          {source === "image" ? <Languages size={18} /> : <Type size={18} />}{" "}
          {busy ? `Claude оқып жатыр… ${busy !== "1" ? busy : ""}` : "Қазақшаға аудару"}
        </button>
        <p className="muted small">
          {busy ? "Бір бетке әдетте 15–40 секунд кетеді. Бетті жаппа." : "Күніне 15 аударма. Аударма — көмекші құрал: маңызды терминдерді оқулықпен салыстырып тексер."}
          {remaining !== null && !busy && ` Бүгін тағы ${remaining} қалды.`}
        </p>
      </section>

      {results.map((item) => (
        <ResultCard key={item.id ?? item.label} item={item} onSaveNote={saveAsNote} />
      ))}

      {history.filter((item) => !shownIds.has(item.id)).length > 0 && (
        <section className="stack">
          <h2 className="panel-title">Менің аудармаларым</h2>
          {history
            .filter((item) => !shownIds.has(item.id))
            .map((item) => (
              <details key={item.id} className="translation-old">
                <summary>
                  <span>{formatDateTime(item.created_at)} · {item.source_kind === "image" ? "Сурет" : "Мәтін"}</span>
                  <span className="muted">{item.result.replace(/[#*`]/g, "").slice(0, 120)}</span>
                </summary>
                <ResultCard item={item} onSaveNote={saveAsNote} onDelete={remove} />
              </details>
            ))}
        </section>
      )}
    </div>
  );
}

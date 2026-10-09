import { useEffect, useState } from "react";
import { ScanText } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { holdBusy } from "../../lib/busy.js";
import { indexPhoto } from "../../features/classlife/studyAi.js";

/**
 * Admin: photos uploaded before photo search existed have no text yet.
 * One button lets the AI read them one by one (new uploads are read automatically).
 */
export default function PhotoTextIndex() {
  const [pending, setPending] = useState(null);
  const [progress, setProgress] = useState(null);
  const [failed, setFailed] = useState(0);

  useEffect(() => {
    supabase
      .from("course_photos")
      .select("id")
      .eq("uploaded", true)
      .is("ocr_at", null)
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data, error }) => setPending(error ? [] : data.map((row) => row.id)));
  }, []);

  if (!pending?.length && !progress) return null;

  async function run() {
    const release = holdBusy();
    let done = 0;
    let errors = 0;
    setProgress({ done, total: pending.length });
    for (const id of pending) {
      try {
        await indexPhoto(id);
      } catch (error) {
        errors += 1;
        if (error.message === "class_limit") break;
      }
      done += 1;
      setProgress({ done, total: pending.length });
      await new Promise((resolve) => setTimeout(resolve, 1500)); // gentle on the free AI quota
    }
    setFailed(errors);
    setPending([]);
    release();
  }

  const running = progress && progress.done < progress.total;
  return (
    <section className="usage panel">
      <div className="usage__head">
        <ScanText size={18} aria-hidden="true" />
        <strong>Фотолардағы жазу (іздеу үшін)</strong>
        <span className="usage__numbers">{progress ? `${progress.done} / ${progress.total}` : `${pending.length} фото`}</span>
      </div>
      {!progress && (
        <>
          <p className="usage__note">
            Бұрын жүктелген {pending.length} фотодағы тақта жазуын AI әлі оқымаған. Оқытсаң, іздеу тақтадағы сөздерді де табады. Жаңа фотолар өздігінен оқылады.
          </p>
          <button type="button" className="button button--ghost button--sm" onClick={run}>
            AI-ға оқыту
          </button>
        </>
      )}
      {running && <p className="usage__note">Оқып жатыр… бетті жаппа.</p>}
      {progress && !running && <p className="usage__note">Дайын ✓{failed ? ` (${failed} фото оқылмады — кейін қайта көр)` : ""}</p>}
    </section>
  );
}

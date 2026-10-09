import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import { STATUS, courseSheet, courseStats, percent } from "./teacherApi.js";

const SHORT = { present: "+", late: "к", absent: "н", excused: "с" };

const LATIN = {
  а: "a", ә: "a", б: "b", в: "v", г: "g", ғ: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "i", к: "k", қ: "q", л: "l", м: "m", н: "n", ң: "n",
  о: "o", ө: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ұ: "u", ү: "u", ф: "f", х: "h", һ: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ы: "y", і: "i", э: "e", ю: "yu", я: "ya",
};

/** File names in Latin letters only: some phones and browsers drop Cyrillic download names. */
function latin(text) {
  const out = [...String(text ?? "").toLowerCase()].map((ch) => LATIN[ch] ?? ch).join("");
  return out.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "course";
}

/** Excel-friendly CSV (UTF-8 BOM, ";" separator): one row per student, one column per lesson. */
function exportCsv(course, stats, sheet) {
  const lessons = [...new Map(sheet.map((row) => [`${row.session_date} ${row.start_time.slice(0, 5)}`, row])).keys()].sort();
  const cell = new Map(sheet.map((row) => [`${row.student_id}|${row.session_date} ${row.start_time.slice(0, 5)}`, row.status]));
  const esc = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const header = ["Код", "Аты-жөні", "Топ", ...lessons, "Келді", "Кешікті", "Жоқ", "Себепті", "%"];
  const lines = stats.map((row) => [
    row.code,
    row.full_name,
    row.group_no,
    ...lessons.map((lesson) => SHORT[cell.get(`${row.student_id}|${lesson}`)] ?? ""),
    row.present,
    row.late,
    row.absent,
    row.excused,
    percent(row) ?? "",
  ]);
  const csv = "﻿" + [header, ...lines].map((line) => line.map(esc).join(";")).join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = `qatysu-${latin(course.code)}-${new Date().toISOString().slice(0, 10)}.csv`;
  // The link must be in the page, or some browsers drop the file name.
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}

export default function CourseStatsView({ course, base }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    courseStats(course.id).then(setStats).catch(() => setError("Жүктелмеді."));
  }, [course.id]);

  async function download() {
    setBusy(true);
    try {
      exportCsv(course, stats, await courseSheet(course.id));
    } catch {
      setError("Файл жасалмады.");
    }
    setBusy(false);
  }

  return (
    <div className="stack-lg">
      <Link to={base || "/"} className="text-link">
        <ArrowLeft size={14} /> Артқа
      </Link>
      <section className="panel roll-head">
        <span className="tag">{course.code}</span>
        <h1 className="roll-head__title">{course.name}</h1>
        <p className="muted">Қатысу қорытындысы. Пайыз: (келді + кешікті) / (келді + кешікті + жоқ). Себепті сабақтар есептелмейді.</p>
        <div className="roll-actions">
          <button type="button" className="button button--primary" onClick={download} disabled={!stats || busy}>
            <Download size={16} /> Excel-ге жүктеу (CSV)
          </button>
        </div>
      </section>
      {error && <p className="form__error">{error}</p>}
      {!stats && !error && <p className="muted">Жүктелуде…</p>}
      {stats && (
        <div className="panel stats-table-wrap">
          <table className="stats-table">
            <thead>
              <tr>
                <th>Студент</th>
                <th title={STATUS.present.label}>✓</th>
                <th title={STATUS.late.label}>⏰</th>
                <th title={STATUS.absent.label}>✕</th>
                <th title={STATUS.excused.label}>📝</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((row) => {
                const value = percent(row);
                return (
                  <tr key={row.student_id} className={value !== null && value < 70 ? "is-low" : ""}>
                    <td>
                      <strong>{row.full_name}</strong>
                      <small>{row.group_no}-топ</small>
                    </td>
                    <td>{row.present}</td>
                    <td>{row.late}</td>
                    <td>{row.absent}</td>
                    <td>{row.excused}</td>
                    <td className="stats-table__pct">{value === null ? "—" : `${value}%`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="muted small">70%-дан төмендері қызылмен белгіленген.</p>
        </div>
      )}
    </div>
  );
}

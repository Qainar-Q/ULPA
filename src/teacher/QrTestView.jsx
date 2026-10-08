import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { QrSvg } from "./CheckinView.jsx";

/** Practice screen: shows what students will see. Nothing is opened or saved. */
export default function QrTestView({ base = "" }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  const window20 = Math.floor(now / 20000);
  const code = String((window20 * 48271) % 1000000).padStart(6, "0");
  const left = 20 - (Math.floor(now / 1000) % 20);
  return (
    <div className="stack-lg">
      <Link to={base || "/"} className="text-link">
        <ArrowLeft size={14} /> Артқа
      </Link>
      <section className="panel checkin__panel">
        <span className="tag">Сынақ режимі — ешкім белгіленбейді</span>
        <div className="checkin__qr">
          <QrSvg text={`${window.location.origin}/checkin?c=${code}&test=1`} />
        </div>
        <p className="checkin__hint">Сабақта осылай көрінеді: студенттер телефон камерасымен сканерлейді немесе кодты ULPA → «Белгілену» бетіне енгізеді.</p>
        <p className="checkin__code">
          {code.slice(0, 3)} {code.slice(3)}
        </p>
        <div className="checkin__timer" style={{ "--p": `${(left / 20) * 100}%` }}>
          <span>Код {left} секундтан кейін ауысады</span>
        </div>
      </section>
      <section className="panel">
        <h2 className="panel-title">Сабақта қалай қолданылады</h2>
        <ol className="t-steps">
          <li>Басты беттегі «Бүгінгі сабақтар» ішінен сабақтың <strong>QR</strong> батырмасын басыңыз.</li>
          <li>Экранды проекторға шығарыңыз не телефонды студенттерге көрсетіңіз (үлкен экран батырмасы бар).</li>
          <li>Студенттер сканерлейді — аттары тізімде бірден шығады. 15 минуттан кейін келгендер «кешікті» болады.</li>
          <li>«Аяқтау» басыңыз — тізімді қолмен түзете аласыз (себепті, жоқ т.б.).</li>
        </ol>
      </section>
    </div>
  );
}

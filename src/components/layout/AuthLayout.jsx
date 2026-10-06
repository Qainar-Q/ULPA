import BrandMark from "./BrandMark.jsx";
import { CLASS_LABEL, PROGRAM_NAME } from "../../config/app.js";
import bgWide from "../../assets/login-bg-1672.webp";
import bgMedium from "../../assets/login-bg-1080.webp";
import bgPortrait from "../../assets/login-bg-portrait.webp";

/** Sign-in and activation layout: full-bleed space photo + glass card. */
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth">
      <picture className="auth__media" aria-hidden="true">
        <source media="(max-width: 719px)" srcSet={bgPortrait} />
        <img src={bgWide} srcSet={`${bgMedium} 1080w, ${bgWide} 1672w`} sizes="100vw" alt="" decoding="async" />
      </picture>
      <div className="auth__shade" aria-hidden="true" />

      <div className="auth__inner">
        <main className="auth__card">
          <div className="auth__brand">
            <BrandMark size={40} />
            <div>
              <strong>ULPA</strong>
              <small>{CLASS_LABEL}</small>
            </div>
          </div>
          <h1 className="auth__title">{title}</h1>
          {subtitle && <p className="auth__subtitle">{subtitle}</p>}
          {children}
          {footer && <div className="auth__footer">{footer}</div>}
        </main>
        <p className="auth__program">{PROGRAM_NAME}</p>
      </div>
    </div>
  );
}

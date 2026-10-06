import BrandMark from "./BrandMark.jsx";
import { CLASS_LABEL, PROGRAM_NAME } from "../../config/app.js";

/** Centered card layout for sign-in and activation. */
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth">
      <div className="auth__bg" aria-hidden="true" />
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
  );
}

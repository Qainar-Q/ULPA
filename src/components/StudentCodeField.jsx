import { Check } from "lucide-react";
import { useStudentName } from "../features/auth/useStudentName.js";

/** Two-digit code input that shows the matching student's name once typed. */
export default function StudentCodeField({ id, label = "Студент коды", value, onChange, invalid, autoFocus }) {
  const lookup = useStudentName(value);

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className="code-field">
        <input
          id={id}
          className="input input--code code-field__input"
          inputMode="numeric"
          autoComplete="username"
          placeholder="01"
          maxLength={2}
          value={value}
          autoFocus={autoFocus}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))}
          aria-invalid={invalid || lookup.state === "missing" || undefined}
          aria-describedby={`${id}-name`}
          required
        />
        <div id={`${id}-name`} className={`code-field__name code-field__name--${lookup.state}`} aria-live="polite">
          {lookup.state === "found" && (
            <>
              <span className="avatar avatar--sm" aria-hidden="true">
                {lookup.name.slice(0, 1)}
              </span>
              <strong>{lookup.name}</strong>
              <Check size={16} className="code-field__check" aria-hidden="true" />
            </>
          )}
          {lookup.state === "loading" && <span className="code-field__dots" aria-label="Іздеу">•••</span>}
          {lookup.state === "missing" && <span>Мұндай код жоқ</span>}
          {lookup.state === "idle" && <span className="code-field__placeholder">Кодыңды енгіз</span>}
        </div>
      </div>
    </div>
  );
}

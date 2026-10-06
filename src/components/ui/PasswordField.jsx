import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function PasswordField({ id, label, value, onChange, autoComplete, hint, invalid }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className="input-affix">
        <input
          id={id}
          className="input"
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          aria-invalid={invalid || undefined}
          required
        />
        <button
          type="button"
          className="input-affix__button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Құпия сөзді жасыру" : "Құпия сөзді көрсету"}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {hint && <p className="field__hint">{hint}</p>}
    </div>
  );
}

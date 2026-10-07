import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { onUpdateReady, updateNow } from "../lib/pwaUpdate.js";

/** Small bottom toast when a new ULPA version is ready. */
export default function UpdateToast() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => onUpdateReady(() => setVisible(true)), []);

  if (!visible || dismissed) return null;
  return (
    <div className="update-toast" role="status">
      <RefreshCw size={16} aria-hidden="true" />
      <span>ULPA-ның жаңа нұсқасы дайын</span>
      <button type="button" className="button button--primary button--sm" onClick={updateNow}>
        Жаңарту
      </button>
      <button type="button" className="update-toast__close" onClick={() => setDismissed(true)} aria-label="Кейінірек">
        <X size={16} />
      </button>
    </div>
  );
}

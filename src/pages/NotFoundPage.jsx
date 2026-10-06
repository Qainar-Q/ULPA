import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import EmptyState from "../components/ui/EmptyState.jsx";

export default function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      title="Бет табылмады"
      action={<Link to="/" className="button button--primary">Басты бетке</Link>}
    >
      Сілтеме қате немесе бет жойылған.
    </EmptyState>
  );
}

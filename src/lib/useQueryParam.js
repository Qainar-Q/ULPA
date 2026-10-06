import { useSearchParams } from "react-router-dom";

/** Keep a filter value in the URL (?key=value) so links and refresh keep it. */
export function useQueryParam(key, fallback = "") {
  const [params, setParams] = useSearchParams();
  const value = params.get(key) ?? fallback;

  function setValue(next) {
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        if (next === "" || next === fallback) updated.delete(key);
        else updated.set(key, next);
        return updated;
      },
      { replace: true }
    );
  }

  return [value, setValue];
}

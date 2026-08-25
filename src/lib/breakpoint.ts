import { useEffect, useState } from "react";

/**
 * One phone question, one answer: `max-width: 639px`, the Tailwind `sm`
 * boundary. SSR has no `window`, so it answers false and corrects on mount.
 */
export function useIsPhone() {
  const [phone, setPhone] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const on = () => setPhone(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}

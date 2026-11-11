import { useEffect } from "react";
import { dismiss, notify } from "../components/ui/Toast";
import "./pwa.css";
import { applyUpdate, registerServiceWorker, useUpdateWaiting } from "./register";

/**
 * "A new version is ready", with Reload, once a new service worker waits: a
 * toast that stays until the owner presses Reload. It never reloads on its
 * own: only the press does, so the camera on Add a book is never restarted
 * underneath the owner. The app mounts this once, at startup, beside the
 * `ToastHost` that shows it.
 */
export function UpdatePrompt() {
  // Registered from here so main.tsx stays as it is.
  useEffect(registerServiceWorker, []);
  const waiting = useUpdateWaiting();
  useEffect(() => {
    if (!waiting) return;
    const id = notify({ title: "A new version is ready", action: { label: "Reload", onClick: applyUpdate } });
    return () => dismiss(id);
  }, [waiting]);
  return null;
}

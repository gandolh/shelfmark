import { useEffect } from "react";
import { Button } from "../components/Button";
import { Sheet } from "../components/Sheet";
import "./pwa.css";
import { applyUpdate, registerServiceWorker, useUpdateWaiting } from "./register";

/**
 * "A new version is ready", with Reload, once a new service worker waits. It
 * never reloads on its own: only the press does, so the camera on Add a book
 * is never restarted underneath the owner.
 */
export function UpdatePrompt() {
  // Registered from here so main.tsx stays as it is; the app mounts this once, at startup.
  useEffect(registerServiceWorker, []);
  if (!useUpdateWaiting()) return null;
  return (
    <div className="update-prompt">
      <Sheet label="Update" className="update-prompt__sheet" role="status">
        <p className="update-prompt__text">A new version is ready</p>
        <Button variant="primary" size="compact" onClick={applyUpdate}>
          Reload
        </Button>
      </Sheet>
    </div>
  );
}

import { Toast } from "@base-ui/react/toast";
import { Button } from "../Button";

/**
 * The app's one toast manager, so code outside React can raise a toast. Today
 * the only toast is the update prompt: it carries an action and never times
 * out (`timeout: 0`), and Base UI keeps its live region.
 */
const manager = Toast.createToastManager();

export interface NotifyOptions {
  title: string;
  /** Milliseconds before it closes; 0 keeps it until it is dismissed. */
  timeout?: number;
  action?: { label: string; onClick: () => void };
}

/** Shows a toast and returns its id. */
export function notify({ title, timeout = 0, action }: NotifyOptions): string {
  return manager.add({
    title,
    timeout,
    actionProps: action ? { children: action.label, onClick: action.onClick } : undefined,
  });
}

/** Closes one toast by id, or every toast. */
export function dismiss(id?: string): void {
  manager.close(id);
}

/** Mount once, near the root. */
export function ToastHost() {
  return (
    <Toast.Provider toastManager={manager} limit={1}>
      <Toast.Portal>
        <Toast.Viewport className="update-prompt">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((toast) => (
    <Toast.Root key={toast.id} toast={toast} className="sheet update-prompt__sheet">
      <Toast.Title className="update-prompt__text" />
      <Toast.Action render={<Button variant="primary" size="compact" />} />
    </Toast.Root>
  ));
}

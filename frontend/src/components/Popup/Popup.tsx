import { useState } from "react";

import styles from "./Popup.module.css";

type PopupProps = {
  text: string;
  /** used for non-confirmation */
  closeText?: string;
  confirmText?: string;
  /** used for confirmation */
  cancelText?: string;
  closeOnConfirm?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
};

export function Popup({
  text,
  closeText = "Close",
  confirmText = "Confirm",
  cancelText = "Cancel",
  closeOnConfirm = true,
  onConfirm,
  onCancel,
}: PopupProps) {
  const [isOpen, setIsOpen] = useState(true);
  const isConfirmation = onConfirm !== undefined;

  if (!isOpen) return null;

  function close() {
    setIsOpen(false);
  }

  function confirm() {
    onConfirm?.();
    if (closeOnConfirm) {
      close();
    }
  }

  function cancel() {
    close();
    onCancel?.();
  }

  return (
    <div className={styles.overlay} role="presentation">
      <div className={styles.popup} role="dialog" aria-modal="true">
        <p>{text}</p>

        <div className={styles.actions}>
          {isConfirmation ? (
            <>
              <button type="button" onClick={confirm}>
                {confirmText}
              </button>
              <button type="button" onClick={cancel}>
                {cancelText}
              </button>
            </>
          ) : (
            <button type="button" onClick={close}>
              {closeText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

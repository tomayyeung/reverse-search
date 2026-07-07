import { useState } from "react";

import styles from "./Popup.module.css";

type DescriptionPopupProps = {
  text: string;
  maxLength: number;
  submitText?: string;
  cancelText?: string;
  onSubmit: (description: string) => void;
  onCancel: () => void;
};

export function DescriptionPopup({
  text,
  maxLength,
  submitText = "Submit",
  cancelText = "Cancel",
  onSubmit,
  onCancel,
}: DescriptionPopupProps) {
  const [description, setDescription] = useState("");

  return (
    <div className={styles.overlay} role="presentation">
      <form
        className={styles.popup}
        role="dialog"
        aria-modal="true"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(description);
        }}
      >
        <p>{text}</p>

        <label className={styles.textEntry} htmlFor="puzzle-description">
          <span>Description</span>
          <textarea
            id="puzzle-description"
            name="puzzle-description"
            value={description}
            maxLength={maxLength}
            rows={2}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <div className={styles.characterCount}>
          {description.length}/{maxLength}
        </div>

        <div className={styles.actions}>
          <button type="submit">{submitText}</button>
          <button type="button" onClick={onCancel}>
            {cancelText}
          </button>
        </div>
      </form>
    </div>
  );
}

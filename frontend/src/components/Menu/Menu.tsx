import { useState } from "react";
import type { ReactNode } from "react";

import styles from "./Menu.module.css";

type MenuProps = {
  label: ReactNode;
  ariaLabel: string;
  children: ReactNode;
};

/** Small disclosure menu. Clicking any panel content closes the menu. */
export function Menu({ label, ariaLabel, children }: MenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={styles.menu}>
      <button
        type="button"
        className={styles.trigger}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        {label}
      </button>

      {isOpen ? (
        <div className={styles.panel} onClick={() => setIsOpen(false)}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

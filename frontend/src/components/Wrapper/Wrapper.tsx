import styles from "./Wrapper.module.css";

/** Shared board/word-list layout wrapper for create and play pages. */
export function Wrapper({ children }: { children: React.ReactNode }) {
  return <div className={styles.wrapper}>{children}</div>;
}

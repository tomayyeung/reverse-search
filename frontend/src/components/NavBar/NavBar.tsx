import { Link, NavLink } from "react-router-dom";

import styles from "./NavBar.module.css";

export function NavBar() {
  return (
    <header className={styles.navbarShell}>
      <div className={styles.navbar}>
        <Link className={styles.brand} to="/">
          Reweave
        </Link>
        <nav className={styles.links} aria-label="Primary navigation">
          <NavLink
            className={({ isActive }) =>
              isActive ? `${styles.link} ${styles.active}` : styles.link
            }
            to="/"
          >
            Puzzles
          </NavLink>
          <span className={styles.placeholderLink}>How to play</span>
          <span className={styles.placeholderLink}>Archive</span>
          <span className={styles.placeholderLink}>Stats</span>
          <NavLink
            className={({ isActive }) =>
              isActive ? `${styles.link} ${styles.active}` : styles.link
            }
            to="/abc"
          >
            Tmp
          </NavLink>
          <NavLink
            className={({ isActive }) =>
              isActive
                ? `${styles.primaryLink} ${styles.primaryActive}`
                : styles.primaryLink
            }
            to="/create"
          >
            Create puzzle
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

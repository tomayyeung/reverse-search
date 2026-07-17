import { Link, NavLink } from "react-router-dom";
import { SignInButton, UserButton, useAuth } from "@clerk/react";

import styles from "./NavBar.module.css";

export function NavBar() {
  const { isLoaded, isSignedIn } = useAuth();

  return (
    <header className={styles.navbarShell}>
      <div className={styles.navbar}>
        <Link className={styles.brand} to="/">
          Reverse Search
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
          <NavLink
            className={({ isActive }) =>
              isActive ? `${styles.link} ${styles.active}` : styles.link
            }
            to="/how-to-play"
          >
            How to play
          </NavLink>
          <NavLink
            className={({ isActive }) =>
              isActive ? `${styles.link} ${styles.active}` : styles.link
            }
            to="/search"
          >
            Search
          </NavLink>
          <span className={styles.placeholderLink}>Archive</span>
          <span className={styles.placeholderLink}>Stats</span>
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
          {isLoaded && !isSignedIn ? (
            <SignInButton mode="modal">
              <button type="button" className={styles.authButton}>
                Log in
              </button>
            </SignInButton>
          ) : null}
          {isLoaded && isSignedIn ? <UserButton /> : null}
        </nav>
      </div>
    </header>
  );
}

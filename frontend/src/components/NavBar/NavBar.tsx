import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { SignInButton, UserButton, useAuth } from "@clerk/react";
import { Menu } from "@/components/Menu";
import { API_URL } from "@/config";

import styles from "./NavBar.module.css";

type MeResponse = {
  username: string;
};

export function NavBar() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [profileUsername, setProfileUsername] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;

    async function syncProfile() {
      if (!isLoaded || !isSignedIn) {
        setProfileUsername(undefined);
        return;
      }

      try {
        const token = await getToken();
        const headers: HeadersInit = {};

        if (token !== null) {
          headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(`${API_URL}/api/me`, { headers });
        const data = (await response.json()) as MeResponse;

        if (!response.ok) {
          throw new Error("Failed to load account profile");
        }

        if (!cancelled) {
          setProfileUsername(data.username);
        }
      } catch {
        if (!cancelled) {
          setProfileUsername(undefined);
        }
      }
    }

    void syncProfile();

    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

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
          {isLoaded && isSignedIn ? (
            <Menu label="..." ariaLabel="Account menu">
              {profileUsername !== undefined ? (
                <Link
                  className={styles.menuLink}
                  to={`/profile/${profileUsername}`}
                >
                  Profile
                </Link>
              ) : null}
            </Menu>
          ) : null}
          {isLoaded && isSignedIn ? <UserButton /> : null}
        </nav>
      </div>
    </header>
  );
}

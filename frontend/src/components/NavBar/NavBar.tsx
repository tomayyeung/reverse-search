import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { SignInButton, UserButton, useAuth } from "@clerk/react";
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
            <UserButton
              appearance={{
                elements: {
                  userButtonAvatarBox: styles.userButtonAvatar,
                  userButtonPopoverCard: styles.userButtonPopoverCard,
                  userButtonPopoverMain: styles.userButtonPopoverMain,
                  userButtonPopoverActionButton: styles.userButtonAction,
                  userButtonPopoverActionButtonText: styles.userButtonActionText,
                  userButtonPopoverActionButtonIcon: styles.userButtonActionIcon,
                  userButtonPopoverCustomItemButton: styles.userButtonAction,
                  userButtonPopoverCustomItemButtonText:
                    styles.userButtonActionText,
                  userButtonPopoverCustomItemButtonIcon:
                    styles.userButtonActionIcon,
                  userButtonPopoverFooter: styles.userButtonFooter,
                },
              }}
              userProfileProps={{
                appearance: {
                  elements: {
                    modalBackdrop: styles.clerkModalBackdrop,
                    modalContent: styles.clerkModalContent,
                    card: styles.clerkAccountCard,
                    rootBox: styles.clerkRootBox,
                    headerTitle: styles.clerkHeaderTitle,
                    headerSubtitle: styles.clerkHeaderSubtitle,
                    navbar: styles.clerkAccountNav,
                    navbarButton: styles.clerkAccountNavButton,
                    navbarButtonText: styles.clerkAccountNavButtonText,
                    pageScrollBox: styles.clerkAccountScrollBox,
                    profileSection: styles.clerkProfileSection,
                    profileSectionTitle: styles.clerkProfileSectionTitle,
                    profileSectionContent: styles.clerkProfileSectionContent,
                    accordionTriggerButton: styles.clerkAccordionButton,
                    accordionContent: styles.clerkAccordionContent,
                    formFieldLabel: styles.clerkFormLabel,
                    formFieldInput: styles.clerkFormInput,
                    formButtonPrimary: styles.clerkPrimaryButton,
                    formButtonReset: styles.clerkSecondaryButton,
                    footer: styles.clerkAccountFooter,
                  },
                },
              }}
            >
              {profileUsername !== undefined ? (
                <UserButton.MenuItems>
                  <UserButton.Link
                    label="Profile"
                    labelIcon={<span className={styles.profileIcon}>@</span>}
                    href={`/profile/${profileUsername}`}
                  />
                </UserButton.MenuItems>
              ) : null}
            </UserButton>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

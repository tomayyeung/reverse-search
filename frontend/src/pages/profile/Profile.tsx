import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@clerk/react";

import { PuzzleCard } from "@/components/PuzzleCard";
import type { PuzzleSummary } from "@/components/PuzzleCard";
import { API_URL } from "@/config";
import { useCurrentUser } from "@/useCurrentUser";

import styles from "./Profile.module.css";

/** Profile completion entry returned by `/api/profile`. */
type CompletedPuzzle = {
  puzzle: PuzzleSummary;
  completionTimeSeconds: number;
  usedHint: boolean;
  completedAt: string;
};

/** Public profile response including created and completed puzzles. */
type ProfileResponse = {
  user: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    official: boolean;
    createdAt: string;
  };
  createdPuzzles: PuzzleSummary[];
  completedPuzzles: CompletedPuzzle[];
};

/** `/api/me` response used after editing the current user's display name. */
type MeResponse = {
  username: string;
  displayName: string | null;
  official: boolean;
};

/** Formats backend timestamp strings for profile display. */
function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Formats completion times shown in profile history. */
function formatDuration(totalSeconds: number) {
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

/** Public profile page with owner-only display-name editing. */
export default function ProfilePage() {
  const { user } = useParams();
  const { getToken } = useAuth();
  const currentUser = useCurrentUser();
  const [profile, setProfile] = useState<ProfileResponse | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | undefined>();
  const [isEditingDisplayName, setIsEditingDisplayName] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [saveError, setSaveError] = useState<string | undefined>();
  const [savingDisplayName, setSavingDisplayName] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function fetchProfile() {
      setLoading(true);
      setLoadError(undefined);

      try {
        if (user === undefined || user.trim() === "") {
          throw new Error("Missing profile username");
        }

        const params = new URLSearchParams({ username: user });
        const response = await fetch(`${API_URL}/api/profile?${params}`, {
          signal: controller.signal,
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load profile");
        }

        if (!cancelled) {
          setProfile(data as ProfileResponse);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        if (!cancelled) {
          setProfile(undefined);
          setLoadError(
            error instanceof Error ? error.message : "Failed to load profile",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchProfile();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [user]);

  const isOwnProfile =
    profile !== undefined && currentUser?.username === profile.user.username;

  function updatePuzzle(updatedPuzzle: PuzzleSummary) {
    // A puzzle can appear in both profile lists, so update both references.
    setProfile((currentProfile) => {
      if (currentProfile === undefined) {
        return currentProfile;
      }

      return {
        ...currentProfile,
        createdPuzzles: currentProfile.createdPuzzles.map((puzzle) =>
          puzzle.id === updatedPuzzle.id ? updatedPuzzle : puzzle,
        ),
        completedPuzzles: currentProfile.completedPuzzles.map((completion) =>
          completion.puzzle.id === updatedPuzzle.id
            ? { ...completion, puzzle: updatedPuzzle }
            : completion,
        ),
      };
    });
  }

  function openDisplayNameEditor() {
    setDisplayNameInput(profile?.user.displayName ?? "");
    setSaveError(undefined);
    setIsEditingDisplayName(true);
  }

  async function saveDisplayName() {
    setSavingDisplayName(true);
    setSaveError(undefined);

    try {
      const token = await getToken();
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token !== null) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/api/me`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ displayName: displayNameInput }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update display name");
      }

      const updatedUser = data as MeResponse;

      setProfile((currentProfile) => {
        if (currentProfile === undefined) {
          return currentProfile;
        }

        return {
          ...currentProfile,
          user: {
            ...currentProfile.user,
            displayName: updatedUser.displayName,
          },
        };
      });
      setIsEditingDisplayName(false);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Failed to update display name",
      );
    } finally {
      setSavingDisplayName(false);
    }
  }

  return (
    <main className={styles.profile}>
      {loading ? <p className={styles.status}>Loading profile...</p> : null}
      {loadError !== undefined ? (
        <p className={styles.status}>Could not load profile: {loadError}</p>
      ) : null}

      {profile !== undefined ? (
        <>
          <section className={styles.header} aria-labelledby="profile-title">
            {profile.user.avatarUrl !== null ? (
              <img
                className={styles.avatar}
                src={profile.user.avatarUrl}
                alt=""
              />
            ) : (
              <div className={styles.avatarFallback} aria-hidden="true">
                {profile.user.username.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <div className={styles.nameLine}>
                <h2 id="profile-title">
                  {profile.user.displayName ?? profile.user.username}
                </h2>
                {profile.user.official ? <span>Official</span> : null}
                {isOwnProfile ? (
                  <button
                    type="button"
                    className={styles.editNameButton}
                    onClick={openDisplayNameEditor}
                  >
                    Edit display name
                  </button>
                ) : null}
              </div>
              <p>@{profile.user.username}</p>
              <p>Joined {formatDate(profile.user.createdAt)}</p>
            </div>
          </section>

          <section className={styles.section} aria-labelledby="created-title">
            <div className={styles.sectionHeader}>
              <h2 id="created-title">Created puzzles</h2>
              <span>{profile.createdPuzzles.length}</span>
            </div>
            {profile.createdPuzzles.length === 0 ? (
              <p className={styles.status}>No created puzzles yet.</p>
            ) : (
              <div className={styles.list}>
                {profile.createdPuzzles.map((puzzle) => (
                  <PuzzleCard
                    key={puzzle.id}
                    puzzle={puzzle}
                    currentUser={currentUser}
                    onPuzzleUpdated={updatePuzzle}
                  />
                ))}
              </div>
            )}
          </section>

          <section className={styles.section} aria-labelledby="completed-title">
            <div className={styles.sectionHeader}>
              <h2 id="completed-title">Completed puzzles</h2>
              <span>{profile.completedPuzzles.length}</span>
            </div>
            {profile.completedPuzzles.length === 0 ? (
              <p className={styles.status}>No signed-in completions yet.</p>
            ) : (
              <div className={styles.list}>
                {profile.completedPuzzles.map((completion) => (
                  <div
                    key={`${completion.puzzle.id}-${completion.completedAt}`}
                    className={styles.completionItem}
                  >
                    <PuzzleCard
                      puzzle={completion.puzzle}
                      currentUser={currentUser}
                      onPuzzleUpdated={updatePuzzle}
                    />
                    <div className={styles.completionMeta}>
                      <span>{formatDuration(completion.completionTimeSeconds)}</span>
                      <span>Completed {formatDate(completion.completedAt)}</span>
                      {completion.usedHint ? <span>Completed with hints</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}

      {isEditingDisplayName ? (
        <div className={styles.modalOverlay} role="presentation">
          <form
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="display-name-title"
            onSubmit={(event) => {
              event.preventDefault();
              void saveDisplayName();
            }}
          >
            <h2 id="display-name-title">Change display name</h2>
            <label className={styles.field}>
              <span>Display name</span>
              <input
                type="text"
                value={displayNameInput}
                maxLength={60}
                onChange={(event) => setDisplayNameInput(event.target.value)}
                disabled={savingDisplayName}
              />
            </label>
            <p className={styles.helpText}>
              Leave this blank to show your username instead.
            </p>
            {saveError !== undefined ? (
              <p className={styles.errorText}>{saveError}</p>
            ) : null}
            <div className={styles.modalActions}>
              <button type="submit" disabled={savingDisplayName}>
                {savingDisplayName ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setIsEditingDisplayName(false)}
                disabled={savingDisplayName}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}

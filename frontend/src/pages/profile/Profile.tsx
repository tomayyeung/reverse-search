import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { PuzzleCard } from "@/components/PuzzleCard";
import type { PuzzleSummary } from "@/components/PuzzleCard";
import { API_URL } from "@/config";

import styles from "./Profile.module.css";

type CompletedPuzzle = {
  puzzle: PuzzleSummary;
  completionTimeSeconds: number;
  usedHint: boolean;
  completedAt: string;
};

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

export default function ProfilePage() {
  const { user } = useParams();
  const [profile, setProfile] = useState<ProfileResponse | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;

    async function fetchProfile() {
      setLoading(true);
      setLoadError(undefined);

      try {
        if (user === undefined || user.trim() === "") {
          throw new Error("Missing profile username");
        }

        const params = new URLSearchParams({ username: user });
        const response = await fetch(`${API_URL}/api/profile?${params}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load profile");
        }

        if (!cancelled) {
          setProfile(data as ProfileResponse);
        }
      } catch (error) {
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
    };
  }, [user]);

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
                  <PuzzleCard key={puzzle.id} puzzle={puzzle} />
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
                    <PuzzleCard puzzle={completion.puzzle} />
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
    </main>
  );
}

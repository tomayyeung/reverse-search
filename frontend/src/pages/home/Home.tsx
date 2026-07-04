import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { API_URL } from "@/config";

import styles from "./Home.module.css";

type PuzzleSummary = {
  id: string;
  name: string;
  width: number;
  height: number;
  startingLetters: number;
  totalCells: number;
  givenPercent: number;
  description: string | null;
};

export default function HomePage() {
  const [puzzles, setPuzzles] = useState<PuzzleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;

    async function fetchPuzzles() {
      setLoading(true);
      setLoadError(undefined);

      try {
        const response = await fetch(`${API_URL}/api/puzzles`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load puzzles");
        }

        if (!cancelled) {
          setPuzzles(data as PuzzleSummary[]);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : "Failed to load puzzles",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchPuzzles();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className={styles.home}>
      <section className={styles.puzzleSection} aria-labelledby="puzzles-title">
        <div className={styles.sectionHeader}>
          <h2 id="puzzles-title">Puzzles</h2>
          <Link className={styles.createLink} to="/create">
            Create your own
          </Link>
        </div>

        {loading ? <p className={styles.status}>Loading puzzles...</p> : null}
        {loadError !== undefined ? (
          <p className={styles.status}>Could not load puzzles: {loadError}</p>
        ) : null}
        {!loading && loadError === undefined && puzzles.length === 0 ? (
          <p className={styles.status}>
            No puzzles are available yet. Create the first one.
          </p>
        ) : null}

        <div className={styles.list}>
          {puzzles.map((puzzle) => (
            <Link
              key={puzzle.id}
              className={styles.listItem}
              to={{ pathname: `/play/${puzzle.id}` }}
            >
              <div className={styles.puzzleInfo}>
                <div className={styles.listItemHeader}>
                  <h3>{puzzle.name}</h3>
                  <span>
                    {puzzle.width} x {puzzle.height}
                  </span>
                </div>
                <p className={styles.description}>
                  {puzzle.description ?? "Custom description coming soon."}
                </p>
              </div>
              <div className={styles.stats}>
                <span>
                  {puzzle.startingLetters}/{puzzle.totalCells} ({puzzle.givenPercent}%) starting letters
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

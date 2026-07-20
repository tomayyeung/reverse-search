import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { PuzzleCard } from "@/components/PuzzleCard";
import type { PuzzleSummary } from "@/components/PuzzleCard";
import { API_URL } from "@/config";

import styles from "./Home.module.css";

export default function HomePage() {
  const [puzzles, setPuzzles] = useState<PuzzleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | undefined>();

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function fetchPuzzles() {
      setLoading(true);
      setLoadError(undefined);

      try {
        const response = await fetch(`${API_URL}/api/puzzles?limit=24`, {
          signal: controller.signal,
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load puzzles");
        }

        if (!cancelled) {
          setPuzzles(data as PuzzleSummary[]);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

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
      controller.abort();
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
            <PuzzleCard key={puzzle.id} puzzle={puzzle} />
          ))}
        </div>
      </section>
    </main>
  );
}

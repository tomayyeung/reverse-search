import type { FormEvent } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { API_URL } from "@/config";

import styles from "./Search.module.css";

type PuzzleSummary = {
  id: string;
  name: string;
  width: number;
  height: number;
  startingLetters: number;
  totalCells: number;
  givenPercent: number;
  plays: number;
  completions: number;
  creator: {
    username: string;
    displayName: string | null;
    official: boolean;
  };
  description: string | null;
};

type GivenMode = "atLeast" | "atMost";

function addNumberParam(params: URLSearchParams, name: string, value: string) {
  if (value.trim() !== "") {
    params.set(name, value);
  }
}

function creatorLabel(creator: PuzzleSummary["creator"]) {
  if (creator.official) {
    return "Official";
  }

  return creator.username ?? creator.displayName;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [minWidth, setMinWidth] = useState("");
  const [minHeight, setMinHeight] = useState("");
  const [maxWidth, setMaxWidth] = useState("");
  const [maxHeight, setMaxHeight] = useState("");
  const [givenMode, setGivenMode] = useState<GivenMode>("atLeast");
  const [givenPercent, setGivenPercent] = useState("");
  const [puzzles, setPuzzles] = useState<PuzzleSummary[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | undefined>();

  async function searchPuzzles(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setSearchError(undefined);
    setSearched(true);

    const params = new URLSearchParams();
    const trimmedQuery = query.trim();

    if (trimmedQuery !== "") {
      params.set("query", trimmedQuery);
    }

    addNumberParam(params, "minWidth", minWidth);
    addNumberParam(params, "minHeight", minHeight);
    addNumberParam(params, "maxWidth", maxWidth);
    addNumberParam(params, "maxHeight", maxHeight);

    if (givenPercent.trim() !== "") {
      params.set(
        givenMode === "atLeast" ? "minGivenPercent" : "maxGivenPercent",
        givenPercent,
      );
    }

    try {
      const queryString = params.toString();
      const response = await fetch(
        `${API_URL}/api/puzzles${queryString === "" ? "" : `?${queryString}`}`,
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to search puzzles");
      }

      setPuzzles(data as PuzzleSummary[]);
    } catch (error) {
      setSearchError(
        error instanceof Error ? error.message : "Failed to search puzzles",
      );
      setPuzzles([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.search}>
      <section className={styles.searchPanel} aria-labelledby="search-title">
        <div className={styles.header}>
          <h2 id="search-title">Search puzzles</h2>
          <p>
            Find puzzles by title, description, size range, or how many letters
            are already provided.
          </p>
        </div>

        <form className={styles.form} onSubmit={searchPuzzles}>
          <div className={styles.fieldWide}>
            <label htmlFor="search-query">Keywords</label>
            <input
              id="search-query"
              name="query"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Title or description"
            />
          </div>

          <div>
            <label>Minimum dimensions</label>
            <div className={styles.dimensionInputs}>
              <label htmlFor="min-width">
                <input
                  id="min-width"
                  name="minWidth"
                  type="number"
                  min="1"
                  onChange={(event) => setMinWidth(event.target.value)}
                />
              </label>
              <span>x</span>
              <label htmlFor="min-height">
                <input
                  id="min-height"
                  name="minHeight"
                  type="number"
                  min="1"
                  onChange={(event) => setMinHeight(event.target.value)}
                />
              </label>
            </div>
          </div>

          <div>
            <label>Maximum dimensions</label>
            <div className={styles.dimensionInputs}>
              <label htmlFor="max-width">
                <input
                  id="max-width"
                  name="maxWidth"
                  type="number"
                  min="1"
                  onChange={(event) => setMaxWidth(event.target.value)}
                />
              </label>
              <span>x</span>
              <label htmlFor="max-height">
                <input
                  id="max-height"
                  name="maxHeight"
                  type="number"
                  min="1"
                  onChange={(event) => setMaxHeight(event.target.value)}
                />
              </label>
            </div>
          </div>

          <div className={styles.givenGroup}>
            <label htmlFor="given-mode">Provided letters</label>
            <div className={styles.givenInputs}>
              <select
                id="given-mode"
                value={givenMode}
                onChange={(event) =>
                  setGivenMode(event.target.value as GivenMode)
                }
              >
                <option value="atLeast">At least</option>
                <option value="atMost">At most</option>
              </select>
              <input
                aria-label="Provided letters percentage"
                type="number"
                min="0"
                max="100"
                onChange={(event) => setGivenPercent(event.target.value)}
              />
              <span>%</span>
            </div>
          </div>

          <button className={styles.submit} type="submit" disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </button>
        </form>
      </section>

      <section className={styles.results} aria-labelledby="results-title">
        <div className={styles.resultsHeader}>
          {searched && !loading && searchError === undefined ? (
            <>
              <h2 id="results-title">Results</h2>
              <span>{puzzles.length} found</span>
            </>
          ) : null}
        </div>

        {searchError !== undefined ? (
          <p className={styles.status}>
            Could not search puzzles: {searchError}
          </p>
        ) : null}
        {searched &&
        !loading &&
        searchError === undefined &&
        puzzles.length === 0 ? (
          <p className={styles.status}>No puzzles matched those filters.</p>
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
                  {puzzle.description ?? "No description provided."}
                </p>
                <p className={styles.creator}>By {creatorLabel(puzzle.creator)}</p>
              </div>
              <div className={styles.stats}>
                <span>
                  {puzzle.startingLetters}/{puzzle.totalCells} (
                  {puzzle.givenPercent}%) starting letters
                </span>
                <span>
                  {puzzle.plays} plays, {puzzle.completions} completions
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

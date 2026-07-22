import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@clerk/react";

import { API_URL } from "@/config";
import type { CurrentUser } from "@/useCurrentUser";

import styles from "./PuzzleCard.module.css";

const PUZZLE_TITLE_LIMIT = 40;
const DESCRIPTION_LIMIT = 60;

export type PuzzleSummary = {
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

type PuzzleCardProps = {
  puzzle: PuzzleSummary;
  currentUser?: CurrentUser;
  onPuzzleUpdated?: (puzzle: PuzzleSummary) => void;
};

function creatorLabel(creator: PuzzleSummary["creator"]) {
  if (creator.official) {
    return "Official";
  }

  return creator.displayName ?? creator.username;
}

export function PuzzleCard({
  puzzle,
  currentUser,
  onPuzzleUpdated,
}: PuzzleCardProps) {
  const { getToken } = useAuth();
  const [isModifying, setIsModifying] = useState(false);
  const [name, setName] = useState(puzzle.name);
  const [description, setDescription] = useState(puzzle.description ?? "");
  const [saveError, setSaveError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const canModify =
    currentUser !== undefined &&
    (currentUser.official || currentUser.username === puzzle.creator.username);

  function openModifier() {
    setName(puzzle.name);
    setDescription(puzzle.description ?? "");
    setSaveError(undefined);
    setIsModifying(true);
  }

  async function savePuzzle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaveError(undefined);

    try {
      const token = await getToken();

      if (token === null) {
        throw new Error("Log in before modifying a puzzle");
      }

      const response = await fetch(`${API_URL}/api/puzzle`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          puzzleId: puzzle.id,
          name,
          description,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to modify puzzle");
      }

      onPuzzleUpdated?.(data as PuzzleSummary);
      setIsModifying(false);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Failed to modify puzzle",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <article className={styles.listItem}>
        <div className={styles.puzzleInfo}>
          <div className={styles.listItemHeader}>
            <h3>{puzzle.name}</h3>
            {canModify ? (
              <button
                type="button"
                className={styles.modifyButton}
                onClick={openModifier}
              >
                Modify puzzle
              </button>
            ) : null}
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
            {puzzle.startingLetters}/{puzzle.totalCells} ({puzzle.givenPercent}
            %) starting letters
          </span>
          <span>
            {puzzle.plays} plays, {puzzle.completions} completions
          </span>
        </div>
        <Link
          className={styles.cardLink}
          aria-label={`Play ${puzzle.name}`}
          to={{ pathname: `/play/${puzzle.id}` }}
        />
      </article>

      {isModifying ? (
        <div className={styles.overlay} role="presentation">
          <form
            className={styles.popup}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`modify-puzzle-${puzzle.id}`}
            onSubmit={(event) => void savePuzzle(event)}
          >
            <h2 id={`modify-puzzle-${puzzle.id}`}>Modify puzzle</h2>
            <label className={styles.textEntry}>
              <span>Title</span>
              <input
                type="text"
                value={name}
                maxLength={PUZZLE_TITLE_LIMIT}
                onChange={(event) => setName(event.target.value)}
                disabled={saving}
              />
            </label>
            <div className={styles.characterCount}>
              {name.length}/{PUZZLE_TITLE_LIMIT}
            </div>
            <label className={styles.textEntry}>
              <span>Description</span>
              <textarea
                value={description}
                maxLength={DESCRIPTION_LIMIT}
                rows={3}
                onChange={(event) => setDescription(event.target.value)}
                disabled={saving}
              />
            </label>
            <div className={styles.characterCount}>
              {description.length}/{DESCRIPTION_LIMIT}
            </div>
            {saveError !== undefined ? (
              <p className={styles.errorText}>{saveError}</p>
            ) : null}
            <div className={styles.actions}>
              <button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setIsModifying(false)}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

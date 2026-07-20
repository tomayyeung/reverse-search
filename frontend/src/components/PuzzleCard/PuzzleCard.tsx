import { Link } from "react-router-dom";

import styles from "./PuzzleCard.module.css";

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
};

function creatorLabel(creator: PuzzleSummary["creator"]) {
  if (creator.official) {
    return "Official";
  }

  return creator.displayName ?? creator.username;
}

export function PuzzleCard({ puzzle }: PuzzleCardProps) {
  return (
    <Link className={styles.listItem} to={{ pathname: `/play/${puzzle.id}` }}>
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
          {puzzle.startingLetters}/{puzzle.totalCells} ({puzzle.givenPercent}%)
          starting letters
        </span>
        <span>
          {puzzle.plays} plays, {puzzle.completions} completions
        </span>
      </div>
    </Link>
  );
}

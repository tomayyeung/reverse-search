import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import styles from "./Board.module.css";

export const BLANK = "_";
export const HOLE = "!";

type TileProps = {
  boardType: "Create" | "Play";
  letter: string;
  idx: number;
  isHardSet: boolean;
  isHole: boolean;
  updateSelectedTile: (idx: number) => void;
  isSelected: boolean;
};

type BoardProps = {
  boardType: "Create" | "Play";
  /**
   * create: done making word list, now removing letters from puzzle
   */
  filteringLetters: boolean;
  width: number;
  height: number;
  boardLetters: string;
  hardSet: boolean[];
  /**
   * only needed for playing. when playing, hard set is constant
   */
  setHardSet?: React.Dispatch<React.SetStateAction<boolean[]>>;
  setBoardLetters: React.Dispatch<React.SetStateAction<string>>;
  selectedTile?: number;
  setSelectedTile?: React.Dispatch<React.SetStateAction<number>>;
};

function Tile({
  boardType,
  letter,
  idx,
  isHardSet,
  isHole,
  updateSelectedTile,
  isSelected,
}: TileProps) {
  return (
    <div
      className={
        `${styles.tile} ` +
        `${isHardSet ? "" : styles.notHardSet} ` +
        `${isSelected ? styles.selectedTile : ""} ` +
        `${isHole ? (boardType === "Create" ? styles.holeTileCreate : styles.holeTilePlay) : ""}`
      }
      onClick={() => {
        updateSelectedTile(idx);
      }}
    >
      <span className={styles.tileLetter}>
        {letter === BLANK || letter === HOLE ? " " : letter}
      </span>
    </div>
  );
}

export function Board({
  boardType,
  filteringLetters,
  width,
  height,
  boardLetters,
  hardSet,
  setBoardLetters,
  setHardSet,
  selectedTile: controlledSelectedTile,
  setSelectedTile: controlledSetSelectedTile,
}: BoardProps) {
  const [internalSelectedTile, setInternalSelectedTile] = useState(-1);
  const selectedTile = controlledSelectedTile ?? internalSelectedTile;
  const setSelectedTile = controlledSetSelectedTile ?? setInternalSelectedTile;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const idx = selectedTile;

      if (idx === -1) {
        return;
      }

      let newChar = boardLetters[idx];

      // Change letter
      if (/^[a-zA-Z]$/.test(e.key)) {
        // No changing letters when filtering
        // No changing a hard set letter when playing
        if (!filteringLetters && !(boardType === "Play" && hardSet[idx]))
          newChar = e.key;
      }

      // Remove letter
      else if (e.key === "Backspace") {
        // Toggle showing when filtering
        // Hard set hole/empty doesn't make sense; holes are by nature hard set already
        if (filteringLetters && newChar !== BLANK && newChar !== HOLE) {
          setHardSet?.(hardSet.with(idx, !hardSet[idx]));
        }

        // Remove letter when not filtering
        // If playing, no removing a hard set letter
        else if (!(boardType === "Play" && hardSet[idx])) newChar = BLANK;
      }

      // Toggle hole when creating
      else if (e.key === " " && boardType === "Create") {
        // Whether filtering or not, we can put in a hole
        if (newChar === BLANK) newChar = HOLE;
        else if (newChar === HOLE) newChar = BLANK;
        else return;
      }

      setBoardLetters([...boardLetters].with(idx, newChar).join(""));
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedTile, boardType, filteringLetters, boardLetters, hardSet, setBoardLetters, setHardSet]);

  if (width <= 0 || height <= 0 || boardLetters.length === 0) {
    return null;
  }

  const boardDimension = Math.max(width, height);
  const boardStyle = {
    gridTemplateColumns: `repeat(${width}, 1fr)`,
    "--board-width": width,
    "--board-height": height,
    "--board-dimension": boardDimension,
  } as CSSProperties &
    Record<"--board-width" | "--board-height" | "--board-dimension", number>;

  return (
    <div className={styles.boardFrame}>
      <div
        className={styles.board}
        style={boardStyle}
      >
        {[...boardLetters].map((letter, i) => (
          <Tile
            boardType={boardType}
            key={i}
            letter={letter.toUpperCase()}
            idx={i}
            isHardSet={hardSet[i]}
            isHole={letter === HOLE}
            updateSelectedTile={(idx: number) => {
              if (!(boardType === "Play" && letter === HOLE))
                setSelectedTile(selectedTile === idx ? -1 : idx);
            }}
            isSelected={selectedTile === i}
          />
        ))}
      </div>
    </div>
  );
}

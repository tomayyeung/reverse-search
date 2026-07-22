import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import styles from "./Board.module.css";

/** Serialized fillable blank used by Rust board parsing and the UI. */
export const BLANK = "_";
/** Serialized permanent hole used by Rust board parsing and the UI. */
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
  /** Create mode permits hole toggles; play mode protects starting clues. */
  boardType: "Create" | "Play";
  /**
   * Create-mode clue-selection state. Before locking, `hardSet` means normal
   * active tiles; after locking, it means letters visible to players.
   */
  filteringLetters: boolean;
  width: number;
  height: number;
  boardLetters: string;
  hardSet: boolean[];
  /**
   * Only needed while creating. During play, hard-set letters are immutable.
   */
  setHardSet?: React.Dispatch<React.SetStateAction<boolean[]>>;
  setBoardLetters: React.Dispatch<React.SetStateAction<string>>;
  selectedTile?: number;
  setSelectedTile?: React.Dispatch<React.SetStateAction<number>>;
  /** Called by play mode when the user changes a letter, used to count plays. */
  onUserLetterPlaced?: () => void;
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

/** Interactive board for puzzle creation and play.
 *
 * The board is controlled by a row-major `boardLetters` string. It supports
 * click selection, outside-click deselection, Tab/arrow navigation, letter
 * entry, Backspace clearing, and Create-mode spacebar hole toggling.
 */
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
  onUserLetterPlaced,
}: BoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [internalSelectedTile, setInternalSelectedTile] = useState(-1);
  const selectedTile = controlledSelectedTile ?? internalSelectedTile;
  const setSelectedTile = controlledSetSelectedTile ?? setInternalSelectedTile;

  // Deselect tile when clicking out of the board
  useEffect(() => {
    function deselectOnOutsideClick(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node) || boardRef.current?.contains(target)) {
        return;
      }

      setSelectedTile(-1);
    }

    document.addEventListener("pointerdown", deselectOnOutsideClick);

    return () => {
      document.removeEventListener("pointerdown", deselectOnOutsideClick);
    };
  }, [setSelectedTile]);

  // Keyboard handling is centralized at window level so selected tiles behave
  // like a focused grid without rendering individual text inputs.
  useEffect(() => {
    function isSelectableTile(idx: number) {
      return (
        idx >= 0 &&
        idx < boardLetters.length &&
        (boardType === "Create" || boardLetters[idx] !== HOLE)
      );
    }

    function getNextTabTile(idx: number) {
      for (let offset = 1; offset <= boardLetters.length; offset++) {
        const nextIdx = (idx + offset) % boardLetters.length;

        if (isSelectableTile(nextIdx)) {
          return nextIdx;
        }
      }

      return idx;
    }

    function getArrowTile(idx: number, key: string) {
      const row = Math.floor(idx / width);
      const col = idx % width;

      switch (key) {
        case "ArrowRight":
          return col === width - 1 ? idx : idx + 1;
        case "ArrowLeft":
          return col === 0 ? idx : idx - 1;
        case "ArrowDown":
          return row === height - 1 ? idx : idx + width;
        case "ArrowUp":
          return row === 0 ? idx : idx - width;
        default:
          return idx;
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const idx = selectedTile;

      if (idx === -1) {
        return;
      }

      // Board navigation
      if (e.key === "Tab") {
        e.preventDefault();
        setSelectedTile(getNextTabTile(idx));
        return;
      }

      if (
        e.key === "ArrowRight" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowUp"
      ) {
        const nextIdx = getArrowTile(idx, e.key);

        e.preventDefault();
        if (isSelectableTile(nextIdx)) {
          setSelectedTile(nextIdx);
        }
        return;
      }

      let newChar = boardLetters[idx];

      // Change letter
      if (/^[a-zA-Z]$/.test(e.key)) {
        // No changing letters when filtering
        // No changing a hard set letter when playing
        if (!filteringLetters && !(boardType === "Play" && hardSet[idx])) {
          newChar = e.key;

          if (boardType === "Play" && boardLetters[idx] !== newChar) {
            onUserLetterPlaced?.();
          }
        }
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
  }, [
    selectedTile,
    boardType,
    filteringLetters,
    width,
    height,
    boardLetters,
    hardSet,
    setBoardLetters,
    setHardSet,
    setSelectedTile,
    onUserLetterPlaced,
  ]);

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
      <div ref={boardRef} className={styles.board} style={boardStyle}>
        {[...boardLetters].map((letter, i) => (
          <Tile
            boardType={boardType}
            key={i}
            letter={letter.toUpperCase()}
            idx={i}
            isHardSet={hardSet[i]}
            isHole={letter === HOLE}
            updateSelectedTile={(idx: number) => {
              if (boardType === "Create" || letter !== HOLE)
                setSelectedTile(selectedTile === idx ? -1 : idx);
            }}
            isSelected={selectedTile === i}
          />
        ))}
      </div>
    </div>
  );
}

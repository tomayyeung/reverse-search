import { useState } from "react";
import { Link } from "react-router-dom";

import { Board, BLANK } from "@/components/Board";
import { WordList, wordsAsStringArr } from "@components/WordList";
import type { Words } from "@components/WordList";
import { Popup } from "@components/Popup";
import { Wrapper } from "@components/Wrapper";

import styles from "./Create.module.css";
import { API_URL } from "@/config";

import {
  check,
  find,
  load_puzzle_for_create as loadPuzzleForCreate,
} from "@wasm/frontend";

export default function CreatePage() {
  const [width, setWidth] = useState(3);
  const [height, setHeight] = useState(3);

  const [wordListDone, setWordListDone] = useState(false);
  const [boardLetters, setBoardLetters] = useState("_".repeat(width * height));
  const [hardSet, setHardSet] = useState<boolean[]>(
    new Array(width * height).fill(true),
  );
  const [puzzleId, setPuzzleId] = useState<string | undefined>();
  const [submitted, setSubmitted] = useState(false);
  const [pendingSize, setPendingSize] = useState<
    { width: number; height: number } | undefined
  >();

  const words: Words = wordListDone
    ? check(
        [...boardLetters]
          .map((letter, idx) => (hardSet[idx] ? letter : BLANK))
          .join(""),
      )
    : { all: find(width, height, boardLetters) };

  function applySize(width: number, height: number) {
    setWidth(width);
    setHeight(height);

    setBoardLetters("_".repeat(width * height));
    setHardSet(new Array(width * height).fill(true));
  }

  function updateSize(formData: FormData) {
    if (wordListDone) return;

    const nextWidth = Number(formData.get("width"));
    const nextHeight = Number(formData.get("height"));

    // no changes were made
    if (nextWidth === width && nextHeight === height) return;

    setPendingSize({ width: nextWidth, height: nextHeight });
  }

  async function submitPuzzle(formData: FormData) {
    if (submitted) return;

    fetch(`${API_URL}/api/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: formData.get("puzzle-name"),
        width: width,
        height: height,
        letters: hardSet
          .map((isSet, i) => (isSet ? boardLetters[i] : BLANK))
          .join(""),
        words: wordsAsStringArr(words),
        answer: boardLetters,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        setPuzzleId(data.id);
      });

    setSubmitted(true);
  }

  return (
    <main>
      <Wrapper>
        <div className={styles.boardPanel}>
          {/* User input to update board size */}
          <form className={styles.sizeForm} action={updateSize}>
            <div className={styles.formField}>
              <label htmlFor="width">Width</label>
              <input
                type="number"
                name="width"
                id="width"
                defaultValue={width}
                min={2}
                max={12}
              />
            </div>
            <div className={styles.formField}>
              <label htmlFor="height">Height</label>
              <input
                type="number"
                name="height"
                id="height"
                defaultValue={height}
                min={2}
                max={12}
              />
            </div>
            <button type="submit">Update size</button>
          </form>

          {/* Board for creating */}
          <Board
            boardType="Create"
            filteringLetters={wordListDone}
            width={width}
            height={height}
            boardLetters={boardLetters}
            hardSet={hardSet}
            setBoardLetters={setBoardLetters}
            setHardSet={setHardSet}
          />
        </div>

        {/* Wordlist for creating */}
        <WordList
          listType={`${wordListDone ? "Play" : "Create"}`}
          words={words}
        />
      </Wrapper>

      {/* User input to lock in letters, confirming the puzzle's word list */}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => {
            if (!wordListDone) {
              loadPuzzleForCreate(width, height, words.all!);
            } else {
              setHardSet(new Array(width * height).fill(true));
            }
            setWordListDone(!wordListDone);
          }}
        >
          {wordListDone ? "Keep editing word list" : "Done with word list"}
        </button>

        {/* Puzzle submission */}
        <form
          style={{ display: wordListDone ? "flex" : "none" }}
          className={styles.form}
          action={submitPuzzle}
          autoComplete="off"
        >
          <div className={styles.formField}>
            <label htmlFor="puzzle-name">Puzzle name</label>
            <input id="puzzle-name" name="puzzle-name" />
          </div>
          <button type="submit">Submit puzzle</button>
        </form>
      </div>

      {/* Post-submission info */}
      {submitted &&
        (puzzleId === undefined ? (
          <p className={styles.status}>Creating puzzle...</p>
        ) : (
          <Link
            className={styles.playLink}
            to={{ pathname: `/play/${puzzleId}` }}
          >
            Play your puzzle!
          </Link>
        ))}

      {/* Confirmation for updating board size */}
      {pendingSize !== undefined && (
        <Popup
          text="Changing puzzle size will clear your current work. Proceed anyway?"
          confirmText="Proceed"
          cancelText="Cancel"
          onConfirm={() => {
            applySize(pendingSize.width, pendingSize.height);
            setPendingSize(undefined);
          }}
          onCancel={() => setPendingSize(undefined)}
        />
      )}
    </main>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@clerk/react";

import { Board, BLANK } from "@/components/Board";
import { WordList, wordsAsStringArr } from "@components/WordList";
import type { PlayWords, Words } from "@components/WordList";
import { DescriptionPopup, Popup } from "@components/Popup";
import { Wrapper } from "@components/Wrapper";

import styles from "./Create.module.css";
import { API_URL } from "@/config";

import {
  check,
  find,
  load_puzzle_for_create as loadPuzzleForCreate,
} from "@wasm/frontend";

const DESCRIPTION_LIMIT = 60;
const PUZZLE_TITLE_LIMIT = 40;

type PendingSubmission = {
  name: string;
};

export default function CreatePage() {
  const { getToken } = useAuth();
  const [width, setWidth] = useState(3);
  const [height, setHeight] = useState(3);

  const [wordListDone, setWordListDone] = useState(false);
  const [boardLetters, setBoardLetters] = useState("_".repeat(width * height));
  const [hardSet, setHardSet] = useState<boolean[]>(
    new Array(width * height).fill(true),
  );
  const [puzzleId, setPuzzleId] = useState<string | undefined>();
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [puzzleName, setPuzzleName] = useState("");
  const [pendingSubmission, setPendingSubmission] = useState<
    PendingSubmission | undefined
  >();
  const [pendingSize, setPendingSize] = useState<
    { width: number; height: number } | undefined
  >();

  const words: Words = wordListDone
    ? {
        kind: "play",
        ...(check(
          [...boardLetters]
            .map((letter, idx) => (hardSet[idx] ? letter : BLANK))
            .join(""),
        ) as Omit<PlayWords, "kind">),
      }
    : { kind: "create", all: find(width, height, boardLetters) };

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

    setPendingSubmission({ name: String(formData.get("puzzle-name") ?? "") });
  }

  async function createPuzzle(
    submission: PendingSubmission,
    description: string,
  ) {
    if (submitted) return;

    setSubmitted(true);
    setPendingSubmission(undefined);
    setSubmitError(undefined);
    setPuzzleId(undefined);

    try {
      const token = await getToken();

      if (token === null) {
        throw new Error("Log in before creating a puzzle");
      }

      const response = await fetch(`${API_URL}/api/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: submission.name,
          description,
          width: width,
          height: height,
          letters: hardSet
            .map((isSet, i) => (isSet ? boardLetters[i] : BLANK))
            .join(""),
          words: wordsAsStringArr(words),
          answer: boardLetters,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to create puzzle");
      }

      if (typeof data.id !== "string") {
        throw new Error("Create response did not include a puzzle id");
      }

      setPuzzleId(data.id);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to create puzzle",
      );
      setSubmitted(false);
    }
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
        {words.kind === "create" ? (
          <WordList listType="Create" words={words} />
        ) : (
          <WordList listType="Play" words={words} />
        )}
      </Wrapper>

      {/* User input to lock in letters, confirming the puzzle's word list */}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => {
            if (words.kind === "create") {
              loadPuzzleForCreate(width, height, words.all);
            } else {
              setHardSet(new Array(width * height).fill(true));
            }
            setWordListDone(!wordListDone);
          }}
        >
          {wordListDone ? "Unlock word list" : "Lock word list"}
        </button>

        {/* Puzzle submission */}
        <form
          style={{ display: wordListDone ? "flex" : "none" }}
          className={styles.form}
          action={submitPuzzle}
          autoComplete="off"
        >
          <div className={styles.formField}>
            <div className={styles.fieldHeader}>
              <label htmlFor="puzzle-name">Puzzle name</label>
              <div className={styles.characterCount}>
                {puzzleName.length}/{PUZZLE_TITLE_LIMIT}
              </div>
            </div>
            <input
              id="puzzle-name"
              name="puzzle-name"
              value={puzzleName}
              maxLength={PUZZLE_TITLE_LIMIT}
              onChange={(event) => setPuzzleName(event.target.value)}
            />
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

      {submitError !== undefined && (
        <p className={styles.status}>Could not create puzzle: {submitError}</p>
      )}

      {pendingSubmission !== undefined && (
        <DescriptionPopup
          text="Add a short description for your puzzle."
          maxLength={DESCRIPTION_LIMIT}
          submitText="Submit puzzle"
          cancelText="Cancel"
          onSubmit={(description) => {
            void createPuzzle(pendingSubmission, description);
          }}
          onCancel={() => setPendingSubmission(undefined)}
        />
      )}

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

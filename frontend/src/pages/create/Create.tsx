import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

import { Board, BLANK } from "@/components/Board";
import { WordList, wordsAsStringArr } from "@components/WordList";
import type { Words } from "@components/WordList";
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
  const [words, setWords] = useState<Words>({
    all: [],
  });

  const [puzzleId, setPuzzleId] = useState<string | undefined>();
  const [submitted, setSubmitted] = useState(false);

  /**
   * Once letters are done being entered, user can change what is hard set. Get starting letters from board letters
   * and hard set.
   */
  function setWordsForPlay() {
    setWords(
      check(
        [...boardLetters]
          .map((letter, idx) => (hardSet[idx] ? letter : BLANK))
          .join(""),
      ),
    );
  }

  // Update words on board letters change, or hard set change when done creating word list
  useEffect(() => {
    console.log("New board letters: '" + boardLetters + "'");

    try {
      if (wordListDone) {
        setWordsForPlay();
      } else {
        setWords({ all: find(width, height, boardLetters) });
      }
    } catch (e) {
      console.log(e);
    }
  }, [boardLetters, hardSet]);

  function updateSize(formData: FormData) {
    if (wordListDone) return;

    // todo: add conformation popup, as board letters are cleared
    const width = Number(formData.get("width"));
    const height = Number(formData.get("height"));

    setWidth(width);
    setHeight(height);

    setBoardLetters("_".repeat(width * height));
    setHardSet(new Array(width * height).fill(true));
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
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        console.log(data);
        setPuzzleId(data.id);
      });

    setSubmitted(true);
  }

  return (
    <main>
      <Wrapper>
        <div>
          <form action={updateSize}>
            <label htmlFor="width">Width:</label>
            <input
              type="number"
              name="width"
              id="width"
              defaultValue={width}
              min={2}
              max={12}
            />
            <label htmlFor="height">Height:</label>
            <input
              type="number"
              name="height"
              id="height"
              defaultValue={height}
              min={2}
              max={12}
            />
            <button type="submit">Update board size</button>
          </form>

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

        <WordList
          listType={`${wordListDone ? "Play" : "Create"}`}
          words={words}
        />
      </Wrapper>

      <button
        onClick={() => {
          if (!wordListDone) {
            loadPuzzleForCreate(width, height, words.all!);
            setWordsForPlay();
          } else {
            setWords({ all: find(width, height, boardLetters) });
          }
          setWordListDone(!wordListDone);
        }}
      >
        {wordListDone ? "Keep editing word list" : "Done with word list"}
      </button>

      <form
        style={{ display: wordListDone ? "block" : "none" }}
        className={styles.form}
        action={submitPuzzle}
        autoComplete="off"
      >
        <label htmlFor="puzzle-name">Puzzle name</label>
        <input id="puzzle-name" name="puzzle-name" />
        <button type="submit">Submit puzzle</button>
      </form>

      {submitted ? (
        puzzleId === undefined ? (
          <p>Creating puzzle...</p>
        ) : (
          <Link
            style={{ display: `${submitted ? "block" : "none"}` }}
            to={{ pathname: `/play/${puzzleId}` }}
          >
            Play your puzzle!
          </Link>
        )
      ) : (
        <></>
      )}
    </main>
  );
}

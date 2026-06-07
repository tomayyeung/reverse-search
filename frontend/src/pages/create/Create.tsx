import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

import { Board, BLANK } from "@/components/Board";
import { CreateWordList } from "@components/WordList";
import { Wrapper } from "@components/Wrapper";

import styles from "./Create.module.css";
import { API_URL } from "@/config";

import { find } from "@wasm/frontend";

export default function CreatePage() {
  const w = 3;
  const h = 3;

  const [wordListDone, setWordListDone] = useState(false);
  const [boardLetters, setBoardLetters] = useState("_".repeat(w * h));
  const [hardSet, setHardSet] = useState<boolean[]>(
    new Array(w * h).fill(true),
  );
  const [words, setWords] = useState<string[]>([]);

  const [puzzleId, setPuzzleId] = useState<string | undefined>();
  const [submitted, setSubmitted] = useState(false);

  // Update words on board letters change
  useEffect(() => {
    console.log("New board letters: '" + boardLetters + "'");
    if (wordListDone) {
      return;
    }

    try {
      setWords(find(w, h, boardLetters));
    } catch (e) {
      console.log(e);
    }
  }, [boardLetters]);

  async function submitPuzzle(formData: FormData) {
    if (submitted) return;

    fetch(`${API_URL}/api/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: formData.get("puzzle-name"),
        width: w,
        height: h,
        letters: hardSet
          .map((isSet, i) => (isSet ? boardLetters[i] : BLANK))
          .join(""),
        words: words,
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
        <Board
          boardType="Create"
          filteringLetters={wordListDone}
          width={w}
          height={h}
          boardLetters={boardLetters}
          hardSet={hardSet}
          setBoardLetters={setBoardLetters}
          setHardSet={setHardSet}
        />
        <CreateWordList words={words} />
      </Wrapper>

      <button
        onClick={() => {
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

      <Link
        style={{ display: `${submitted ? "block" : "none"}` }}
        to={{ pathname: `/play/${puzzleId}` }}
      >
        Play your puzzle!
      </Link>
    </main>
  );
}

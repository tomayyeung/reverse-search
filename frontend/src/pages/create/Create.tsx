import { useState, useEffect } from "react";

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
  const [hardSet, setHardSet] = useState<boolean[]>(new Array(w * h).fill(true));
  const [words, setWords] = useState<string[]>([]);

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
    const res = await fetch(`${API_URL}/api/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        puzzle_id: formData.get("puzzle-name"),
        width: w,
        height: h,
        letters: hardSet.map((isSet, i) => isSet ? boardLetters[i] : BLANK).join(""),
        words: words,
      }),
    });

    console.log(res);
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
    </main>
  );
}

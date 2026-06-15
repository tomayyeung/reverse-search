import { useState, useEffect } from "react";

import { Board, BLANK } from "@/components/Board";
import { WordList, allWordsFound } from "@components/WordList";
import type { Words } from "@components/WordList";
import { Wrapper } from "@components/Wrapper";
import { useParams } from "react-router-dom";
import { API_URL } from "@/config";

import { check, load_puzzle as loadPuzzle } from "@wasm/frontend";
import { Popup } from "@/components/Popup";

export default function PlayPage() {
  const { puzzleId } = useParams();

  const [puzzleFetched, setPuzzleFetched] = useState<boolean | undefined>(
    undefined,
  );

  const [boardLetters, setBoardLetters] = useState("");
  const [hardSet, setHardSet] = useState<boolean[]>([]);

  const [puzzleName, setPuzzleName] = useState("");
  const [w, setWidth] = useState(0);
  const [h, setHeight] = useState(0);

  const words: Words = puzzleFetched
    ? check(boardLetters)
    : { found: [], missing: [], extra: [] };
  const complete = puzzleFetched && allWordsFound(words);

  useEffect(() => {
    const route = `${API_URL}/api/puzzle/${puzzleId}`;
    fetch(route)
      .then((res) => res.json())
      .then((puzzle) => {
        console.log(puzzle);

        try {
          // load puzzle for wasm
          loadPuzzle(puzzle);

          // then load puzzle for rendering
          setPuzzleName(puzzle.name);
          setWidth(puzzle.width);
          setHeight(puzzle.height);

          const initialLetters = puzzle.letters;

          console.log(initialLetters);

          // intialize board w/ letters
          // any initial letters means they are hard set
          setBoardLetters(initialLetters);
          setHardSet([...initialLetters].map((letter) => letter !== BLANK));

          setPuzzleFetched(true);
        } catch {
          const error: string = puzzle.error;
          if (error.startsWith("invalid puzzle id")) {
            setPuzzleFetched(false);
          }
        }
      });
  }, [puzzleId]);

  function getMain(fetchedStatus: boolean | undefined) {
    switch (fetchedStatus) {
      case undefined:
        return <p>Loading puzzle...</p>;
      case false:
        return <p>Puzzle not found</p>;
      default:
        return (
          <Board
            boardType="Play"
            filteringLetters={false}
            width={w}
            height={h}
            boardLetters={boardLetters}
            hardSet={hardSet}
            setBoardLetters={setBoardLetters}
          />
        );
    }
  }

  return (
    <main>
      <Wrapper>
        <div>
          <h3>Puzzle: {puzzleName}</h3>
          <h4 style={{ display: complete ? "block" : "none" }}>Completed!</h4>
          {getMain(puzzleFetched)}
        </div>
        <WordList listType="Play" words={words} />
      </Wrapper>

      {complete ? (
        <Popup text="Congratulations! Puzzle completed." />
      ) : (
        <></>
      )}
    </main>
  );
}

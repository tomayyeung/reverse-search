import { useState, useEffect, useRef } from "react";

import { Board, BLANK } from "@/components/Board"
import { PlayWordList } from "@components/WordList";
import type { Words } from "@components/WordList";
import { Wrapper } from "@components/Wrapper";
import { useParams } from "react-router-dom";
import { API_URL } from "@/config";

import { check, load_puzzle as loadPuzzle } from "@wasm/frontend";

export default function PlayPage() {
  const { puzzleId } = useParams();

  const puzzleFetched = useRef(false);

  const [boardLetters, setBoardLetters] = useState("");
  const [hardSet, setHardSet] = useState<boolean[]>([]);
  const [w, setWidth] = useState(0);
  const [h, setHeight] = useState(0);
  const [words, setWords] = useState<Words>({
    found: [],
    missing: [],
    extra: [],
  });

  useEffect(() => {
    const route = `${API_URL}/api/puzzle/${puzzleId}`;
    console.log(route);
    fetch(route)
      .then((res) => res.json())
      .then((puzzle) => {
        console.log(puzzle);

        // load puzzle for wasm
        loadPuzzle(puzzle);

        // then load puzzle for rendering
        setWidth(puzzle.width);
        setHeight(puzzle.height);

        const initialLetters = puzzle.letters;

        console.log(initialLetters);

        // intialize board w/ letters
        // any initial letters means they are hard set
        setBoardLetters(initialLetters);
        setHardSet([...initialLetters].map((letter) => letter !== BLANK));

        puzzleFetched.current = true;
      });
  }, []);

  // Update words on board letters change
  useEffect(() => {
    if (!puzzleFetched.current) {
      return;
    }

    setWords(check(boardLetters));
  }, [boardLetters]);

  return (
    <main>
      <Wrapper>
        <Board
          boardType="Play"
          filteringLetters={false}
          width={w}
          height={h}
          boardLetters={boardLetters}
          hardSet={hardSet}
          setBoardLetters={setBoardLetters}
        />
        <PlayWordList words={words} />
      </Wrapper>
    </main>
  );
}

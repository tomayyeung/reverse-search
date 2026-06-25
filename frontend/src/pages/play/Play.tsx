import { useState, useEffect } from "react";

import { Board, BLANK, HOLE } from "@/components/Board";
import { Menu } from "@/components/Menu";
import { WordList, allWordsFound } from "@components/WordList";
import type { Words } from "@components/WordList";
import { Wrapper } from "@components/Wrapper";
import { useParams } from "react-router-dom";
import { API_URL } from "@/config";

import { check, load_puzzle as loadPuzzle } from "@wasm/frontend";
import { Popup } from "@/components/Popup";
import styles from "./Play.module.css";

type PendingAction = "solution" | "random" | "selected" | "clear";

export default function PlayPage() {
  const { puzzleId } = useParams();

  const [puzzleFetched, setPuzzleFetched] = useState<boolean | undefined>(
    undefined,
  );

  const [startingLetters, setStartingLetters] = useState("");
  const [boardLetters, setBoardLetters] = useState("");
  const [hardSet, setHardSet] = useState<boolean[]>([]);

  const [puzzleName, setPuzzleName] = useState("");
  const [w, setWidth] = useState(0);
  const [h, setHeight] = useState(0);

  const [answer, setAnswer] = useState("");
  const [pendingAction, setPendingAction] = useState<
    PendingAction | undefined
  >();
  const [gaveUp, setGaveUp] = useState(false);
  const [usedHint, setUsedHint] = useState(false);
  const [selectedTile, setSelectedTile] = useState(-1);

  const words: Words = puzzleFetched
    ? check(boardLetters)
    : { found: [], missing: [], extra: [] };
  const complete = puzzleFetched && allWordsFound(words);
  const showRevealActions = puzzleFetched === true && !complete && !gaveUp;

  useEffect(() => {
    const route = `${API_URL}/api/puzzle/${puzzleId}`;
    fetch(route)
      .then((res) => res.json())
      .then((puzzle) => {
        try {
          // load puzzle for wasm
          loadPuzzle(puzzle);

          // then load puzzle for rendering
          setPuzzleName(puzzle.name);
          setWidth(puzzle.width);
          setHeight(puzzle.height);

          const initialLetters = puzzle.letters;

          // initialize board w/ letters
          // any initial letters means they are hard set
          setStartingLetters(initialLetters);
          setBoardLetters(initialLetters);
          setHardSet([...initialLetters].map((letter) => letter !== BLANK));

          // initialize answer
          setAnswer(puzzle.answer);
          setSelectedTile(-1);
          setUsedHint(false);
          setGaveUp(false);

          setPuzzleFetched(true);
        } catch {
          const error: string = puzzle.error;
          if (error.startsWith("invalid puzzle id")) {
            setPuzzleFetched(false);
          }
        }
      });
  }, [puzzleId]);

  function revealTile(idx: number) {
    const answerTile = answer[idx];

    if (idx < 0 || idx >= answer.length || answerTile === undefined) {
      return;
    }

    const revealedTile = answerTile === BLANK ? HOLE : answerTile;
    setBoardLetters([...boardLetters].with(idx, revealedTile).join(""));
    setHardSet(hardSet.with(idx, true));
    setStartingLetters([...startingLetters].with(idx, revealedTile).join("")); // make it a permanent change for this session
    setUsedHint(true);
  }

  function revealRandomTile() {
    const eligibleTiles = [...answer]
      .map((letter, idx) => ({ letter, idx }))
      .filter(
        ({ letter, idx }) =>
          letter !== BLANK && letter !== HOLE && !hardSet[idx],
      );

    if (eligibleTiles.length === 0) {
      return;
    }

    const { idx } =
      eligibleTiles[Math.floor(Math.random() * eligibleTiles.length)];
    revealTile(idx);
  }

  function getActionPopupText(action: PendingAction) {
    switch (action) {
      case "solution":
        return "Reveal the full solution?";
      case "random":
        return "Reveal a random tile?";
      case "selected":
        return "Reveal the selected tile?";
      case "clear":
        return "Clear the whole board?";
    }
  }

  function getActionConfirmText(action: PendingAction) {
    switch (action) {
      case "solution":
        return "Reveal solution";
      case "random":
        return "Reveal random tile";
      case "selected":
        return "Reveal selected tile";
      case "clear":
        return "Clear board";
    }
  }

  function confirmAction() {
    switch (pendingAction) {
      case "solution":
        setBoardLetters(answer);
        setGaveUp(true);
        break;
      case "random":
        revealRandomTile();
        break;
      case "selected":
        revealTile(selectedTile);
        break;
      case "clear":
        setBoardLetters(startingLetters);
        break;
    }

    setPendingAction(undefined);
  }

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
            selectedTile={selectedTile}
            setSelectedTile={setSelectedTile}
          />
        );
    }
  }

  return (
    <main>
      <Wrapper>
        <div className={styles.boardPanel}>
          <div className={styles.header}>
            <div className={styles.headerTop}>
              <h3>Puzzle: {puzzleName}</h3>
              {showRevealActions ? (
                <Menu label="⋯" ariaLabel="Puzzle actions">
                  <button
                    type="button"
                    className={styles.dangerMenuItem}
                    onClick={() => setPendingAction("solution")}
                  >
                    Reveal solution
                  </button>
                  <button
                    type="button"
                    className={styles.dangerMenuItem}
                    onClick={() => setPendingAction("random")}
                  >
                    Reveal random tile
                  </button>
                  <button
                    type="button"
                    className={styles.dangerMenuItem}
                    disabled={selectedTile === -1}
                    onClick={() => setPendingAction("selected")}
                  >
                    Reveal selected tile
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryMenuItem}
                    onClick={() => setPendingAction("clear")}
                  >
                    Clear board
                  </button>
                </Menu>
              ) : null}
            </div>
            <h4 hidden={!complete || gaveUp || usedHint}>Completed!</h4>
            <h4 hidden={!complete || gaveUp || !usedHint}>
              Completed with hints!
            </h4>
            <h4 className={styles.revealedStatus} hidden={!gaveUp}>
              Solution revealed.
            </h4>
          </div>
          <div className={styles.boardSlot}>{getMain(puzzleFetched)}</div>
        </div>
        <WordList listType="Play" words={words} />
      </Wrapper>

      {complete && !gaveUp && (
        <Popup text="Congratulations! Puzzle completed." />
      )}

      {pendingAction !== undefined && showRevealActions && (
        <Popup
          text={getActionPopupText(pendingAction)}
          confirmText={getActionConfirmText(pendingAction)}
          cancelText="Cancel"
          onConfirm={confirmAction}
          onCancel={() => setPendingAction(undefined)}
        />
      )}
    </main>
  );
}

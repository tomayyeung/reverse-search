import { useState, useEffect, useRef } from "react";

import { Board, BLANK, HOLE } from "@/components/Board";
import { Menu } from "@/components/Menu";
import { WordList, allWordsFound } from "@components/WordList";
import type { PlayWords } from "@components/WordList";
import { Wrapper } from "@components/Wrapper";
import { useParams } from "react-router-dom";
import { API_URL } from "@/config";

import { check, load_puzzle as loadPuzzle } from "@wasm/frontend";
import { Popup } from "@/components/Popup";
import styles from "./Play.module.css";

type PendingAction = "solution" | "random" | "selected" | "clear";

type PuzzleResponse = {
  name: string;
  description: string | null;
  width: number;
  height: number;
  letters: string;
  answer: string;
  error?: string;
};

async function incrementPuzzleStat(
  puzzleId: string | undefined,
  event: "play" | "completion",
) {
  if (puzzleId === undefined) {
    return;
  }

  await fetch(`${API_URL}/api/stats`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ puzzleId, event }),
  });
}

export default function PlayPage() {
  const { puzzleId } = useParams();

  const [puzzleFetched, setPuzzleFetched] = useState<boolean | undefined>(
    undefined,
  );
  const [loadError, setLoadError] = useState<string | undefined>();

  const [startingLetters, setStartingLetters] = useState("");
  const [boardLetters, setBoardLetters] = useState("");
  const [hardSet, setHardSet] = useState<boolean[]>([]);

  const [puzzleName, setPuzzleName] = useState("");
  const [puzzleDescription, setPuzzleDescription] = useState<string | null>(
    null,
  );
  const [w, setWidth] = useState(0);
  const [h, setHeight] = useState(0);

  const [answer, setAnswer] = useState("");
  const [pendingAction, setPendingAction] = useState<
    PendingAction | undefined
  >();
  const [gaveUp, setGaveUp] = useState(false);
  const [usedHint, setUsedHint] = useState(false);
  const [selectedTile, setSelectedTile] = useState(-1);
  const playCountedRef = useRef(false);
  const completionCountedRef = useRef(false);
  const completionEligibleRef = useRef(false);

  const words: PlayWords = puzzleFetched
    ? { kind: "play", ...(check(boardLetters) as Omit<PlayWords, "kind">) }
    : { kind: "play", found: [], missing: [], extra: [] };
  const complete = puzzleFetched && allWordsFound(words);
  const showRevealActions = puzzleFetched === true && !complete && !gaveUp;

  useEffect(() => {
    const route = `${API_URL}/api/puzzle/${puzzleId}`;
    let cancelled = false;

    async function fetchPuzzle() {
      setPuzzleFetched(undefined);
      setLoadError(undefined);

      try {
        const response = await fetch(route);
        const puzzle = (await response.json()) as PuzzleResponse;

        if (!response.ok) {
          if (puzzle.error?.startsWith("invalid puzzle id")) {
            if (!cancelled) setPuzzleFetched(false);
            return;
          }

          throw new Error(puzzle.error ?? "Failed to load puzzle");
        }

        try {
          // load puzzle for wasm
          loadPuzzle(puzzle);

          if (cancelled) return;

          // then load puzzle for rendering
          setPuzzleName(puzzle.name);
          setPuzzleDescription(puzzle.description);
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
          playCountedRef.current = false;
          completionCountedRef.current = false;
          completionEligibleRef.current = false;

          setPuzzleFetched(true);
        } catch {
          if (puzzle.error?.startsWith("invalid puzzle id")) {
            if (!cancelled) setPuzzleFetched(false);
            return;
          }

          throw new Error(puzzle.error ?? "Failed to load puzzle");
        }
      } catch (error) {
        if (cancelled) return;

        setLoadError(
          error instanceof Error ? error.message : "Failed to load puzzle",
        );
        setPuzzleFetched(false);
      }
    }

    void fetchPuzzle();

    return () => {
      cancelled = true;
    };
  }, [puzzleId]);

  function countPlay() {
    completionEligibleRef.current = true;

    if (playCountedRef.current) {
      return;
    }

    playCountedRef.current = true;
    void incrementPuzzleStat(puzzleId, "play");
  }

  useEffect(() => {
    if (
      !complete ||
      gaveUp ||
      completionCountedRef.current ||
      !completionEligibleRef.current
    ) {
      return;
    }

    completionCountedRef.current = true;
    void incrementPuzzleStat(puzzleId, "completion");
  }, [complete, gaveUp, puzzleId]);

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
    completionEligibleRef.current = true;
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
        return <p>{loadError ?? "Puzzle not found"}</p>;
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
            onUserLetterPlaced={countPlay}
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
              <div className={styles.titleBlock}>
                <h3>Puzzle: {puzzleName}</h3>
                {puzzleDescription !== null ? (
                  <p className={styles.description}>{puzzleDescription}</p>
                ) : null}
              </div>
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

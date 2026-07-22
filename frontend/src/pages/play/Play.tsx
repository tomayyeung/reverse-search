import { useState, useEffect, useRef } from "react";
import { useAuth } from "@clerk/react";

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

/** Pending reveal/reset action that must be confirmed in a popup. */
type PendingAction = "solution" | "random" | "selected" | "clear";

/** JSON shape returned by `GET /api/puzzle/:id`. */
type PuzzleResponse = {
  name: string;
  description: string | null;
  width: number;
  height: number;
  letters: string;
  answer: string;
  error?: string;
};

/** Formats elapsed play time for the optional timer display. */
function formatDuration(totalSeconds: number) {
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

/** Sends a best-effort play/completion stat event to the backend. */
async function incrementPuzzleStat(
  puzzleId: string | undefined,
  event: "play" | "completion",
  completionTimeSeconds?: number,
  usedHint?: boolean,
  token?: string | null,
) {
  if (puzzleId === undefined) {
    return;
  }

  const headers: HeadersInit = { "Content-Type": "application/json" };

  if (token !== null && token !== undefined) {
    headers.Authorization = `Bearer ${token}`;
  }

  await fetch(`${API_URL}/api/stats`, {
    method: "POST",
    headers,
    body: JSON.stringify({ puzzleId, event, completionTimeSeconds, usedHint }),
  });
}

/** Puzzle play page.
 *
 * The puzzle must be loaded into WASM before `check(boardLetters)` is meaningful.
 * Stats refs deduplicate play/completion events across renders, and completion
 * is only counted after player interaction or hint usage.
 */
export default function PlayPage() {
  const { puzzleId } = useParams();
  const { getToken } = useAuth();

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
  const [showTimer, setShowTimer] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [selectedTile, setSelectedTile] = useState(-1);
  const playCountedRef = useRef(false);
  const completionCountedRef = useRef(false);
  // Prevent passive completions from being counted just because a loaded board is solved.
  const completionEligibleRef = useRef(false);
  // The interval derives elapsed time from this timestamp to avoid drift.
  const timerStartedAtRef = useRef<number | undefined>(undefined);

  const words: PlayWords = puzzleFetched
    ? { kind: "play", ...(check(boardLetters) as Omit<PlayWords, "kind">) }
    : { kind: "play", found: [], missing: [], extra: [] };
  const complete = puzzleFetched && allWordsFound(words);
  const showRevealActions = puzzleFetched === true && !complete && !gaveUp;
  const formattedElapsed = formatDuration(elapsedSeconds);

  useEffect(() => {
    const route = `${API_URL}/api/puzzle/${puzzleId}`;
    const controller = new AbortController();
    let cancelled = false;

    async function fetchPuzzle() {
      setPuzzleFetched(undefined);
      setLoadError(undefined);

      try {
        const response = await fetch(route, { signal: controller.signal });
        const puzzle = (await response.json()) as PuzzleResponse;

        if (!response.ok) {
          if (puzzle.error?.startsWith("invalid puzzle id")) {
            if (!cancelled) setPuzzleFetched(false);
            return;
          }

          throw new Error(puzzle.error ?? "Failed to load puzzle");
        }

        try {
          // Load into WASM first; render state depends on `check` being ready.
          loadPuzzle(puzzle);

          if (cancelled) return;

          // Then load puzzle for React rendering.
          setPuzzleName(puzzle.name);
          setPuzzleDescription(puzzle.description);
          setWidth(puzzle.width);
          setHeight(puzzle.height);

          const initialLetters = puzzle.letters;

          // Any initial non-blank character is fixed for the player.
          setStartingLetters(initialLetters);
          setBoardLetters(initialLetters);
          setHardSet([...initialLetters].map((letter) => letter !== BLANK));

          // Reset per-puzzle play state and stat guards.
          setAnswer(puzzle.answer);
          setSelectedTile(-1);
          setUsedHint(false);
          setGaveUp(false);
          setShowTimer(false);
          setElapsedSeconds(0);
          timerStartedAtRef.current = Date.now();
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
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

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
      controller.abort();
    };
  }, [puzzleId]);

  useEffect(() => {
    if (puzzleFetched !== true || complete || gaveUp) {
      return;
    }

    const interval = window.setInterval(() => {
      const startedAt = timerStartedAtRef.current;

      if (startedAt !== undefined) {
        setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [puzzleFetched, complete, gaveUp]);

  function countPlay() {
    completionEligibleRef.current = true;

    if (playCountedRef.current) {
      return;
    }

    playCountedRef.current = true;
    void getToken().then((token) =>
      incrementPuzzleStat(puzzleId, "play", undefined, undefined, token),
    );
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

    const startedAt = timerStartedAtRef.current;
    const completionTimeSeconds =
      startedAt === undefined ? 0 : Math.floor((Date.now() - startedAt) / 1000);

    setElapsedSeconds(completionTimeSeconds);
    completionCountedRef.current = true;
    void getToken().then((token) =>
      incrementPuzzleStat(
        puzzleId,
        "completion",
        completionTimeSeconds,
        usedHint,
        token,
      ),
    );
  }, [complete, gaveUp, getToken, puzzleId, usedHint]);

  function revealTile(idx: number) {
    const answerTile = answer[idx];

    if (idx < 0 || idx >= answer.length || answerTile === undefined) {
      return;
    }

    const revealedTile = answerTile === BLANK ? HOLE : answerTile;
    setBoardLetters([...boardLetters].with(idx, revealedTile).join(""));
    setHardSet(hardSet.with(idx, true));
    // Revealed hints become fixed for this session, including future clears.
    setStartingLetters([...startingLetters].with(idx, revealedTile).join(""));
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
              {puzzleFetched === true ? (
                <div className={styles.headerActions}>
                  <Menu label="⋯" ariaLabel="Puzzle actions">
                    <button
                      type="button"
                      className={styles.secondaryMenuItem}
                      onClick={() => setShowTimer((visible) => !visible)}
                    >
                      {showTimer ? "Hide timer" : "Show timer"}
                    </button>
                    {showRevealActions ? (
                      <>
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
                      </>
                    ) : null}
                  </Menu>
                </div>
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
          <div className={styles.boardSlot}>
            {getMain(puzzleFetched)}
            <div
              className={`${styles.timer} ${showTimer ? "" : styles.timerHidden}`}
            >
              {formattedElapsed}
            </div>
          </div>
        </div>
        <WordList listType="Play" words={words} />
      </Wrapper>

      {complete && !gaveUp && (
        <Popup
          text={`Congratulations! Puzzle completed in ${formattedElapsed}.`}
        />
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

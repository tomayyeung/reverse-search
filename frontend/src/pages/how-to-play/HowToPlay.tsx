import styles from "./HowToPlay.module.css";

function ScreenshotContainer({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <aside className={styles.screenshotContainer}>
      <h3>{title}</h3>
      <p>{children}</p>
    </aside>
  );
}

export default function HowToPlayPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>How to Play</h1>
        <p>
          Reweave is a word-grid puzzle. Fill the board so every required word
          appears, using the starting letters as fixed clues.
        </p>
      </header>

      <section className={styles.section} aria-labelledby="playing-title">
        <h2 id="playing-title">Playing a Puzzle</h2>
        <ol className={styles.steps}>
          <li>
            Pick a puzzle from the puzzle list. A board might open with some
            letters already placed.
          </li>
          <li>
            Starting letters are fixed. You cannot change or clear them while
            playing.
          </li>
          <li>
            Click an empty square to select it, then type a letter. Press
            Backspace to clear a letter you added.
          </li>
          <li>
            There may be holes in the board. They are not playable tiles and do
            not need letters.
          </li>
          <li>
            Use the word list while you solve. Found words are already on the
            board, missing words still need to be made, and extra words are
            words your current board creates that are not part of the puzzle.
          </li>
          <li>Finish the puzzle by finding all required words.</li>
        </ol>

        <ScreenshotContainer title="Play page example">
          <img
            src={"/tutorial/Play.jpeg"}
            alt="Partially completed play puzzle with the word list visible"
          />
        </ScreenshotContainer>
      </section>

      <section className={styles.section} aria-labelledby="creating-title">
        <h2 id="creating-title">Creating a Puzzle</h2>
        <ol className={styles.steps}>
          <li>Open Create puzzle from the navbar.</li>
          <li>
            Set the width and height, then update the size. Do this at the
            start, as changing the size clears the current board.
          </li>
          <li>
            Click tiles and type letters to build the solved board. This is the
            answer players are trying to reconstruct.
          </li>
          <li>
            Press Space on an empty tile to toggle a hole. Holes become unusable
            spaces in the puzzle.
          </li>
          <li>
            Check the generated word list. Adjust letters and holes until the
            list contains the words you want.
          </li>
          <li>
            Lock the word list when the answer is ready. This switches the board
            into clue selection.
          </li>
          <li>
            Press Backspace on letters to toggle whether they are shown as
            starting clues or hidden from players.
          </li>
          <li>
            Enter a puzzle name and submit it. Use the generated play link to
            test or share the puzzle.
          </li>
        </ol>

        <ScreenshotContainer title="Create page setup">
          <img src={"/tutorial/Create.jpeg"} alt="Create page with generated word list" />
        </ScreenshotContainer>
        <ScreenshotContainer title="Locked word list and submission">
          <img
            src={"/tutorial/Create_locked.jpeg"}
            alt="Create page after locking word list"
          />
        </ScreenshotContainer>
      </section>
    </main>
  );
}

import styles from "./WordList.module.css";

function groupAndSort(words: string[]): [number, string[]][] {
  const groups: Record<number, string[]> = {};

  for (const word of words) {
    const len = word.length;
    (groups[len] ??= []).push(word);
  }

  return Object.entries(groups)
    .map(([key, value]): [number, string[]] => [Number(key), value.sort()])
    .sort(([a], [b]) => a - b);
}

type WordEntry = { word: string; kind: "found" | "missing" | "extra" };

function mergeGroups(
  found: [number, string[]][],
  missing: [number, string[]][],
  extra: [number, string[]][],
): [number, WordEntry[]][] {
  const merged: Record<number, WordEntry[]> = {};

  const add = (groups: [number, string[]][], kind: WordEntry["kind"]) => {
    for (const [length, words] of groups) {
      (merged[length] ??= []).push(...words.map((word) => ({ word, kind })));
    }
  };

  add(found, "found");
  add(missing, "missing");
  add(extra, "extra");

  return Object.entries(merged)
    .map(([key, entries]): [number, WordEntry[]] => [
      Number(key),
      entries.sort((a, b) => a.word.localeCompare(b.word)),
    ])
    .sort(([a], [b]) => a - b);
}

export type Words = {
  found?: string[];
  missing?: string[];
  extra?: string[];
  /** used for create */
  all?: string[];
};

export function wordsAsStringArr(words: Words) {
  return [...words.found ?? [], ...words.missing ?? [], ...words.extra ?? [], ...words.all ?? []];
}

function PlayWordList({ words }: { words: Words }) {
  const sortedFoundWords = groupAndSort(words.found!);
  const sortedMissingWords = groupAndSort(words.missing!);
  const sortedExtraWords = groupAndSort(words.extra!);

  const grouped = mergeGroups(
    sortedFoundWords,
    sortedMissingWords,
    sortedExtraWords,
  );

  return (
    <div className={styles.wordList}>
      {grouped.map(([length, entries]) => {
        const byKind = entries.reduce(
          (acc, entry) => {
            (acc[entry.kind] ??= []).push(entry);
            return acc;
          },
          {} as Record<WordEntry["kind"], WordEntry[]>,
        );

        return (
          <li key={length}>
            <p className={styles.lengthLabel}>{length} letters: </p>
            {(["found", "missing", "extra"] as const).map((kind) =>
              byKind[kind]?.map(({ word }) => (
                <span key={word} className={styles[kind]}>
                  {word}{" "}
                </span>
              )),
            )}
          </li>
        );
      })}
    </div>
  );
}

function CreateWordList({ words }: { words: Words }) {
  const sortedWords = groupAndSort(words.all!);

  return (
    <div className={styles.wordList}>
      {sortedWords.map(([length, words], idx) => {
        return <div key={idx}>
          <p className={styles.lengthLabel}>{length} letters</p>
          <p>{words.join(" ")}</p>
        </div>;
      })}
    </div>
  );
}

export function WordList({ listType, words}: { listType: "Create" | "Play", words: Words}) {
  if (listType === "Create") {
    return <CreateWordList words={words} />
  } else {
    return <PlayWordList words={words} />
  }
}
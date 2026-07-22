import type { PlayWords, Words } from "./types";

export type { CreateWords, PlayWords, Words } from "./types";
export { WordList } from "./WordList";

/** Flattens either word-list mode into a string array for create submission. */
export function wordsAsStringArr(words: Words) {
  if (words.kind === "create") {
    return words.all;
  }

  return [...words.found, ...words.missing, ...words.extra];
}

/** A play board is solved when no required words are missing and no extras exist. */
export function allWordsFound(words: PlayWords) {
  return words.missing.length === 0 && words.extra.length === 0;
}

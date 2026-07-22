/** Cached state for a dictionaryapi.dev lookup keyed by lowercase word. */
export type DefinitionState =
  | { status: "loading" }
  | {
      status: "loaded";
      meanings: DefinitionMeaning[];
      pronunciation?: DefinitionPronunciation;
      sourceUrls: string[];
    }
  | { status: "not-found" }
  | { status: "error" };

/** One part-of-speech section returned by the dictionary popup parser. */
export type DefinitionMeaning = {
  partOfSpeech: string;
  definitions: string[];
};

/** Pronunciation text and/or playable audio URL for a word. */
export type DefinitionPronunciation = {
  text?: string;
  audio?: string;
};

/** Per-word dictionary cache shared by all rendered word chips in a list. */
export type DictionaryCache = Record<string, DefinitionState>;

/** Word list generated from an answer board during puzzle creation. */
export type CreateWords = {
  kind: "create";
  /** All valid dictionary words currently present on the answer board. */
  all: string[];
};

/** Word comparison result returned by WASM while playing or selecting clues. */
export type PlayWords = {
  kind: "play";
  /** Required puzzle words currently present on the board. */
  found: string[];
  /** Required puzzle words not currently present on the board. */
  missing: string[];
  /** Valid dictionary words present on the board but not required. */
  extra: string[];
};

/** Discriminated word-list shape consumed by `WordList`. */
export type Words = CreateWords | PlayWords;

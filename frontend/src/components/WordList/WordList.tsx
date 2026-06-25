import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import styles from "./WordList.module.css";

const NO_DEFINITION_TITLE = "No Definitions Found";

type DefinitionState =
  | { status: "loading" }
  | {
      status: "loaded";
      meanings: DefinitionMeaning[];
      pronunciation?: DefinitionPronunciation;
    }
  | { status: "not-found" }
  | { status: "error" };

type DefinitionMeaning = {
  partOfSpeech: string;
  definitions: string[];
};

type DefinitionPronunciation = {
  text?: string;
  audio?: string;
};

type DictionaryEntry = {
  title?: string;
  phonetics?: {
    text?: string;
    audio?: string;
  }[];
  meanings?: {
    partOfSpeech?: string;
    definitions?: {
      definition?: string;
    }[];
  }[];
};

type DictionaryCache = Record<string, DefinitionState>;

function getDefinitionMeanings(data: DictionaryEntry[]): DefinitionMeaning[] {
  return data.flatMap((entry) =>
    (entry.meanings ?? []).flatMap((meaning) => {
      const definitions = (meaning.definitions ?? [])
        .map(({ definition }) => definition)
        .filter((definition): definition is string => definition !== undefined);

      if (definitions.length === 0) return [];

      return [
        {
          partOfSpeech: meaning.partOfSpeech ?? "Meaning",
          definitions,
        },
      ];
    }),
  );
}

function getPronunciation(
  data: DictionaryEntry[],
): DefinitionPronunciation | undefined {
  const phonetics = data.flatMap((entry) => entry.phonetics ?? []);
  const normalized = phonetics
    .map(({ text, audio }) => ({
      text,
      audio: audio && audio.trim() !== "" ? audio : undefined,
    }))
    .filter(({ text, audio }) => text !== undefined || audio !== undefined);

  return (
    normalized.find(({ text, audio }) => text !== undefined && audio !== undefined) ??
    normalized[0]
  );
}

function playPronunciation(audio: string) {
  void new Audio(audio).play();
}

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

type WordButtonProps = {
  word: string;
  className?: string;
  selectedWord: string | null;
  definitions: DictionaryCache;
  onSelect: (word: string) => void;
  onClose: () => void;
};

type PopupPosition = {
  top: number;
  left: number;
};

function WordButton({
  word,
  className,
  selectedWord,
  definitions,
  onSelect,
  onClose,
}: WordButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [popupPosition, setPopupPosition] = useState<PopupPosition | null>(
    null,
  );
  const normalizedWord = word.toLowerCase();
  const definition = definitions[normalizedWord];
  const isSelected = selectedWord === normalizedWord;

  useEffect(() => {
    if (!isSelected) return;

    function closeOnOutsideClick(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) return;
      if (buttonRef.current?.contains(target)) return;
      if (popupRef.current?.contains(target)) return;

      onClose();
    }

    function updatePopupPosition() {
      const button = buttonRef.current;
      if (!button) return;

      const buttonRect = button.getBoundingClientRect();
      const popupRect = popupRef.current?.getBoundingClientRect();
      const popupWidth = popupRect?.width ?? 288;
      const popupHeight = popupRect?.height ?? 120;
      const gap = 8;
      const viewportPadding = 12;
      const bottomTop = buttonRect.bottom + gap;
      const aboveTop = buttonRect.top - popupHeight - gap;
      const hasBottomSpace =
        bottomTop + popupHeight <= window.innerHeight - viewportPadding;
      const top = hasBottomSpace
        ? bottomTop
        : Math.max(viewportPadding, aboveTop);
      const left = Math.min(
        Math.max(viewportPadding, buttonRect.left),
        window.innerWidth - popupWidth - viewportPadding,
      );

      setPopupPosition({ top, left });
    }

    updatePopupPosition();
    document.addEventListener("pointerdown", closeOnOutsideClick);
    window.addEventListener("resize", updatePopupPosition);
    window.addEventListener("scroll", updatePopupPosition, true);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      window.removeEventListener("resize", updatePopupPosition);
      window.removeEventListener("scroll", updatePopupPosition, true);
    };
  }, [isSelected, definition, onClose]);

  return (
    <span className={styles.wordWrapper}>
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.wordButton} ${className ?? ""}`}
        onClick={() => onSelect(word)}
        aria-expanded={isSelected}
      >
        {word}
      </button>{" "}
      {isSelected &&
        createPortal(
          <div
            ref={popupRef}
            className={styles.definitionPopup}
            role="dialog"
            style={popupPosition ?? undefined}
          >
            <div className={styles.definitionHeader}>
              <p className={styles.definitionTitle}>{word}</p>
              <button
                type="button"
                className={styles.definitionClose}
                onClick={onClose}
                aria-label="Close definition"
              >
                ✕
              </button>
            </div>
            {definition?.status === "loaded" ? (
              <>
                {definition.pronunciation && (
                  <div className={styles.pronunciation}>
                    {definition.pronunciation.text && (
                      <span>{definition.pronunciation.text}</span>
                    )}
                    {definition.pronunciation.audio && (
                      <button
                        type="button"
                        className={styles.audioButton}
                        onClick={() =>
                          playPronunciation(definition.pronunciation!.audio!)
                        }
                        aria-label="Play pronunciation"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                          focusable="false"
                        >
                          <path d="M11 5 6 9H3v6h3l5 4V5Z" />
                          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
                <div className={styles.definitionMeanings}>
                  {definition.meanings.map((meaning, meaningIndex) => (
                    <section key={`${meaning.partOfSpeech}-${meaningIndex}`}>
                      <p className={styles.partOfSpeech}>
                        {meaning.partOfSpeech}
                      </p>
                      <ol>
                        {meaning.definitions.map(
                          (definitionText, definitionIndex) => (
                            <li key={`${definitionIndex}-${definitionText}`}>
                              {definitionText}
                            </li>
                          ),
                        )}
                      </ol>
                    </section>
                  ))}
                </div>
              </>
            ) : (
              <span>
                {definition?.status === "not-found"
                  ? "No definition found"
                  : definition?.status === "error"
                    ? "Error retrieving definition"
                    : "Loading definition"}
              </span>
            )}
          </div>,
          document.body,
        )}
    </span>
  );
}

type WordListContentProps = {
  words: Words;
  selectedWord: string | null;
  definitions: DictionaryCache;
  onSelectWord: (word: string) => void;
  onCloseDefinition: () => void;
};

function PlayWordList({
  words,
  selectedWord,
  definitions,
  onSelectWord,
  onCloseDefinition,
}: WordListContentProps) {
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
                <WordButton
                  key={word}
                  word={word}
                  className={styles[kind]}
                  selectedWord={selectedWord}
                  definitions={definitions}
                  onSelect={onSelectWord}
                  onClose={onCloseDefinition}
                />
              )),
            )}
          </li>
        );
      })}
    </div>
  );
}

function CreateWordList({
  words,
  selectedWord,
  definitions,
  onSelectWord,
  onCloseDefinition,
}: WordListContentProps) {
  const sortedWords = groupAndSort(words.all!);

  return (
    <div className={styles.wordList}>
      {sortedWords.map(([length, words], idx) => {
        return (
          <div key={idx}>
            <p className={styles.lengthLabel}>{length} letters</p>
            <p>
              {words.map((word) => (
                <WordButton
                  key={word}
                  word={word}
                  selectedWord={selectedWord}
                  definitions={definitions}
                  onSelect={onSelectWord}
                  onClose={onCloseDefinition}
                />
              ))}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function WordList({
  listType,
  words,
}: {
  listType: "Create" | "Play";
  words: Words;
}) {
  const [definitions, setDefinitions] = useState<DictionaryCache>({});
  const [selectedWord, setSelectedWord] = useState<string | null>(null);

  async function selectWord(word: string) {
    const normalizedWord = word.toLowerCase();

    setSelectedWord(normalizedWord);

    if (definitions[normalizedWord]) return;

    setDefinitions((currentDefinitions) => ({
      ...currentDefinitions,
      [normalizedWord]: { status: "loading" },
    }));

    try {
      const response = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(normalizedWord)}`,
      );
      const data = (await response.json()) as
        | DictionaryEntry[]
        | DictionaryEntry;

      if (!Array.isArray(data) && data.title === NO_DEFINITION_TITLE) {
        setDefinitions((currentDefinitions) => ({
          ...currentDefinitions,
          [normalizedWord]: { status: "not-found" },
        }));
        return;
      }

      if (!response.ok || !Array.isArray(data)) {
        setDefinitions((currentDefinitions) => ({
          ...currentDefinitions,
          [normalizedWord]: { status: "error" },
        }));
        return;
      }

      const definitionMeanings = getDefinitionMeanings(data);
      const pronunciation = getPronunciation(data);

      setDefinitions((currentDefinitions) => ({
        ...currentDefinitions,
        [normalizedWord]:
          definitionMeanings.length > 0
            ? { status: "loaded", meanings: definitionMeanings, pronunciation }
            : { status: "not-found" },
      }));
    } catch {
      setDefinitions((currentDefinitions) => ({
        ...currentDefinitions,
        [normalizedWord]: { status: "error" },
      }));
    }
  }

  const wordListProps = {
    words,
    selectedWord,
    definitions,
    onSelectWord: selectWord,
    onCloseDefinition: () => setSelectedWord(null),
  };

  if (listType === "Create") {
    return <CreateWordList {...wordListProps} />;
  } else {
    return <PlayWordList {...wordListProps} />;
  }
}

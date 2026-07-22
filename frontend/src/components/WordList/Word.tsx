import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import styles from "./WordList.module.css";
import type { DictionaryCache } from "./types";

type WordProps = {
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

/** Plays dictionary pronunciation audio without blocking UI updates. */
function playPronunciation(audio: string) {
  void new Audio(audio).play();
}

/** Clickable word chip that renders its definition popup in `document.body`.
 *
 * The popup uses fixed viewport coordinates so it can escape list overflow,
 * reposition on scroll/resize, and close on outside pointerdown.
 */
export function Word({
  word,
  className,
  selectedWord,
  definitions,
  onSelect,
  onClose,
}: WordProps) {
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
      // Clamp horizontally and choose below/above placement based on viewport space.
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
                {definition.sourceUrls.length > 0 && (
                  <div className={styles.definitionSources}>
                    <p>Source</p>
                    {definition.sourceUrls.map((sourceUrl) => (
                      <a
                        key={sourceUrl}
                        href={sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {sourceUrl}
                      </a>
                    ))}
                  </div>
                )}
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

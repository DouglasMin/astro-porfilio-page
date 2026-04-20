/**
 * Typewriter effect that cycles through AI-related phrases.
 * Respects prefers-reduced-motion by showing static text instead.
 */

export interface TypewriterConfig {
  element: HTMLElement;
  phrases: string[];
  typeSpeed: number;       // ms per character
  deleteSpeed: number;     // ms per character
  pauseDuration: number;   // ms between phrases
}

export interface TypewriterInstance {
  start(): void;
  stop(): void;
}

export function initTypewriter(config: TypewriterConfig): TypewriterInstance {
  const { element, phrases, typeSpeed, deleteSpeed, pauseDuration } = config;

  // Respect prefers-reduced-motion: show static text instead of animating
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    element.textContent = phrases[0] || '';
    return {
      start() {},
      stop() {},
    };
  }

  let currentPhraseIndex = 0;
  let currentCharIndex = 0;
  let isDeleting = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let running = false;

  function tick() {
    if (!running) return;

    const currentPhrase = phrases[currentPhraseIndex];

    if (!isDeleting) {
      // Typing
      currentCharIndex++;
      element.textContent = currentPhrase.slice(0, currentCharIndex);

      if (currentCharIndex === currentPhrase.length) {
        // Finished typing — pause before deleting
        isDeleting = true;
        timeoutId = setTimeout(tick, pauseDuration);
        return;
      }

      timeoutId = setTimeout(tick, typeSpeed);
    } else {
      // Deleting
      currentCharIndex--;
      element.textContent = currentPhrase.slice(0, currentCharIndex);

      if (currentCharIndex === 0) {
        // Finished deleting — move to next phrase
        isDeleting = false;
        currentPhraseIndex = (currentPhraseIndex + 1) % phrases.length;
        timeoutId = setTimeout(tick, typeSpeed);
        return;
      }

      timeoutId = setTimeout(tick, deleteSpeed);
    }
  }

  function start() {
    if (running) return;
    running = true;
    currentPhraseIndex = 0;
    currentCharIndex = 0;
    isDeleting = false;
    element.textContent = '';
    tick();
  }

  function stop() {
    running = false;
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  return { start, stop };
}

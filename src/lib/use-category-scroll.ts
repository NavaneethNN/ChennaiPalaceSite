"use client";

import { useCallback, useEffect, useRef } from "react";

// Wait for the filtered dishes to render before measuring their position.
export function useCategoryScroll(
  category: string,
  toolbarSelector: string,
  resultsSelector: string,
) {
  const pending = useRef(false);
  const scrollToStart = useCallback(() => {
    const target = document.querySelector<HTMLElement>(resultsSelector);
    if (!target) return;
    const toolbar = document.querySelector<HTMLElement>(toolbarSelector);
    const header = document.querySelector(".site-header");
    let offset = header?.getBoundingClientRect().height || 0;
    if (toolbar) {
      const style = getComputedStyle(toolbar);
      if (style.position === "sticky") {
        offset = Math.max(
          offset,
          (parseFloat(style.top) || 0) + toolbar.getBoundingClientRect().height,
        );
      }
    }
    window.scrollTo({
      top: Math.max(
        0,
        window.scrollY + target.getBoundingClientRect().top - offset - 16,
      ),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }, [toolbarSelector, resultsSelector]);
  useEffect(() => {
    if (!pending.current) return;
    pending.current = false;
    scrollToStart();
  }, [category, scrollToStart]);

  return (nextCategory: string) => {
    if (nextCategory === category) scrollToStart();
    else pending.current = true;
  };
}

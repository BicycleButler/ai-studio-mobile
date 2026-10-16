import { KeyboardEvent } from "react";

export interface UseKeyboardNavigationOptions {
  activeValue: string;
  setActiveValue: (value: string) => void;
  focusItem: (value: string) => void;
  itemSelector: string;
}

export function useKeyboardNavigation({
  activeValue,
  setActiveValue,
  focusItem,
  itemSelector
}: UseKeyboardNavigationOptions) {
  return (e: KeyboardEvent<HTMLElement>) => {
    const itemValues = Array.from((e.currentTarget.querySelectorAll(itemSelector) as NodeListOf<HTMLElement>)).map(el => el.dataset.value);
    if (itemValues.length === 0) return;

    const currentIndex = itemValues.indexOf(activeValue);
    let nextIndex = currentIndex;

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % itemValues.length;
      e.preventDefault();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + itemValues.length) % itemValues.length;
      e.preventDefault();
    } else if (e.key === "Home") {
      nextIndex = 0;
      e.preventDefault();
    } else if (e.key === "End") {
      nextIndex = itemValues.length - 1;
      e.preventDefault();
    }

    if (nextIndex !== currentIndex && itemValues[nextIndex] !== undefined) {
      const nextItem = itemValues[nextIndex] as string;
      setActiveValue(nextItem);
      focusItem(nextItem);
    }
  };
}

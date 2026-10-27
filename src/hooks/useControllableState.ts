import { useState, useCallback } from "react";

export interface UseControllableStateParams<T> {
  prop?: T;
  defaultProp?: T;
  onChange?: (state: T) => void;
}

export function useControllableState<T>({
  prop,
  defaultProp,
  onChange,
}: UseControllableStateParams<T>) {
  const [uncontrolledProp, setUncontrolledProp] = useState<T | undefined>(defaultProp);
  const isControlled = prop !== undefined;
  const value = isControlled ? prop : uncontrolledProp;

  const setValue = useCallback(
    (nextValue: T | ((prevState: T | undefined) => T)) => {
      if (isControlled) {
        const setter = nextValue as (prevState: T | undefined) => T;
        const valueToSet = typeof nextValue === "function" ? setter(prop) : nextValue;
        if (valueToSet !== prop) {
          onChange?.(valueToSet);
        }
      } else {
        setUncontrolledProp((prev) => {
          const setter = nextValue as (prevState: T | undefined) => T;
          const valueToSet = typeof nextValue === "function" ? setter(prev) : nextValue;
          if (valueToSet !== prev) {
            onChange?.(valueToSet);
          }
          return valueToSet;
        });
      }
    },
    [isControlled, prop, onChange]
  );

  return [value, setValue] as const;
}

import React, { createContext, useContext, useRef, useEffect } from "react";
import { useKeyboardNavigation } from "../hooks/useKeyboardNavigation";
import { useControllableState } from "../hooks/useControllableState";

interface SegmentedControlContextType {
  activeValue: string;
  setActiveValue: (value: string) => void;
  registerItem: (value: string, element: HTMLButtonElement | null) => void;
  focusItem: (value: string) => void;
}

const SegmentedControlContext = createContext<SegmentedControlContextType | undefined>(undefined);

export function SegmentedControl({
  children,
  defaultValue,
  value,
  onValueChange,
  className = "",
  ariaLabel
}: {
  children: React.ReactNode;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  ariaLabel?: string;
}) {
  const [activeValue, setActiveValue] = useControllableState<string>({
    prop: value,
    defaultProp: defaultValue || "",
    onChange: onValueChange,
  });

  // Ensure activeValue is correctly typed as string for the context since defaultProp guarantees a string
  const resolvedValue = activeValue ?? "";

  const itemRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());

  const handleSetActiveValue = (newValue: string) => {
    setActiveValue(newValue);
  };

  const registerItem = (itemValue: string, element: HTMLButtonElement | null) => {
    itemRefs.current.set(itemValue, element);
  };

  const focusItem = (itemValue: string) => {
    const el = itemRefs.current.get(itemValue);
    el?.focus();
  };

  const handleKeyDown = useKeyboardNavigation({
    activeValue: resolvedValue,
    setActiveValue: handleSetActiveValue,
    focusItem,
    itemSelector: '[role="radio"]'
  });

  return (
    <SegmentedControlContext.Provider value={{ activeValue: resolvedValue, setActiveValue: handleSetActiveValue, registerItem, focusItem }}>
      <div
        role="radiogroup"
        aria-label={ariaLabel}
        onKeyDown={handleKeyDown}
        className={`inline-flex items-center bg-muted/60 p-1 rounded-lg h-9 border border-border/20 relative ${className}`}
      >
        {children}
      </div>
    </SegmentedControlContext.Provider>
  );
}

export function SegmentedControlItem({
  children,
  value,
  className = "",
  icon: Icon
}: {
  children?: React.ReactNode;
  value: string;
  className?: string;
  icon?: React.ElementType;
}) {
  const context = useContext(SegmentedControlContext);
  if (!context) throw new Error("SegmentedControlItem must be used within SegmentedControl");

  const isActive = context.activeValue === value;

  // Create a ref for positioning the animated background
  const itemRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    context.registerItem(value, itemRef.current);
  }, [value, context]);

  return (
    <button
      ref={itemRef}
      role="radio"
      aria-checked={isActive}
      data-value={value}
      tabIndex={isActive ? 0 : -1}
      onClick={() => context.setActiveValue(value)}
      className={`
        relative flex items-center justify-center px-3 py-1 text-xs font-medium rounded-md transition-colors duration-200 z-10
        focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background outline-none
        ${isActive ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}
        ${Icon && children ? "gap-1.5" : ""}
        ${className}
      `}
      aria-label={!children && Icon ? value : undefined}
    >
      {/* Active background element (sliding inset pill) */}
      {isActive && (
        <div
          className="absolute inset-0 bg-background shadow-xs rounded-md -z-10"
        />
      )}

      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
}

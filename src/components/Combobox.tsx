import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, Search, X } from "lucide-react";
import { safeAddEventListener } from "../utils/platform";

export interface ComboboxOption {
  id: string;
  label: string;
  subLabel?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isLoading?: boolean;
  emptyText?: string;
  onCreateNew?: (query: string) => void;
}

export const Combobox: React.FC<ComboboxProps> = ({
  options,
  value,
  onChange,
  placeholder = "Search...",
  isLoading = false,
  emptyText = "No matches found.",
  onCreateNew,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.id === value);
  const displayValue = isOpen ? query : selectedOption ? selectedOption.label : value;

  // Debounced search logic (ADR 0048 compliance)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(handler);
  }, [query]);

  const filteredOptions = options.filter(
    (o) =>
      o.label.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
      o.subLabel?.toLowerCase().includes(debouncedQuery.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const removeClick = safeAddEventListener("mousedown", handleClickOutside);
    return () => removeClick();
  }, []);

  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // When debounced query changes, reset the highlighted index
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [debouncedQuery, isOpen]);

  useEffect(() => {
    if (isOpen) {
       setQuery(selectedOption ? selectedOption.label : value);
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
      }
      return;
    }

    // Force flush the query if the user presses enter before the debounce finishes
    let activeQuery = debouncedQuery;
    let activeFilteredOptions = filteredOptions;
    if (e.key === "Enter" && query !== debouncedQuery) {
      activeQuery = query;
      setDebouncedQuery(query);
      activeFilteredOptions = options.filter(
        (o) =>
          o.label.toLowerCase().includes(query.toLowerCase()) ||
          o.subLabel?.toLowerCase().includes(query.toLowerCase())
      );
    }

    const itemsCount = activeFilteredOptions.length + (onCreateNew && activeQuery ? 1 : 0);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => {
          const next = prev < itemsCount - 1 ? prev + 1 : prev;
          scrollToIndex(next);
          return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : prev;
          scrollToIndex(next);
          return next;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < activeFilteredOptions.length) {
        onChange(activeFilteredOptions[highlightedIndex].id);
        setIsOpen(false);
      } else if (onCreateNew && activeQuery && highlightedIndex === activeFilteredOptions.length) {
        onCreateNew(activeQuery);
        setIsOpen(false);
      } else if (onCreateNew && activeQuery && highlightedIndex === -1 && activeFilteredOptions.length === 0) {
        onCreateNew(activeQuery);
        setIsOpen(false);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const scrollToIndex = (index: number) => {
    if (listboxRef.current) {
        const item = listboxRef.current.children[index] as HTMLElement;
        if (item) {
           item.scrollIntoView({ block: "nearest" });
        }
    }
  };

  // Virtualization is technically needed for 10K items but standard combobox virtualization in React is complex
  // Let's implement a simple slice virtualization to prevent DOM lockups
  const VIRTUAL_LIMIT = 50;
  const slicedOptions = filteredOptions.slice(0, VIRTUAL_LIMIT);

  return (
    <div className="relative w-full" ref={containerRef}>
      <div
        className="relative flex items-center w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-colors cursor-text"
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
      >
        <Search className="w-3.5 h-3.5 text-muted-foreground me-2" />
        <input
          ref={inputRef}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls="combobox-listbox"
          type="text"
          value={displayValue}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            if (!e.target.value && value) {
              onChange("");
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none min-w-0"
        />
        {isLoading && (
          <Loader2 className="w-4 h-4 text-muted-foreground animate-spin ms-2" />
        )}
        {value && !isLoading && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
              setQuery("");
            }}
            className="p-0.5 hover:bg-muted rounded text-muted-foreground ms-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="absolute z-40 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-md max-h-60 overflow-y-auto"
            role="listbox"
            id="combobox-listbox"
            ref={listboxRef}
          >
            {slicedOptions.length === 0 && !isLoading && (!onCreateNew || !debouncedQuery) ? (
              <div className="p-3 text-xs text-muted-foreground text-center">
                {emptyText}
              </div>
            ) : null}

            {slicedOptions.map((option, index) => (
              <div
                key={option.id}
                role="option"
                aria-selected={value === option.id}
                onClick={() => {
                  onChange(option.id);
                  setIsOpen(false);
                }}
                className={`flex flex-col px-3 py-2 text-xs cursor-pointer transition-colors border-b border-border/40 last:border-0 ${
                  highlightedIndex === index
                    ? "bg-muted"
                    : value === option.id
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted/50"
                }`}
              >
                <span className="font-medium text-foreground">{option.label}</span>
                {option.subLabel && (
                  <span className="text-[10px] text-muted-foreground font-mono mt-0.5">
                    {option.subLabel}
                  </span>
                )}
              </div>
            ))}

            {filteredOptions.length > VIRTUAL_LIMIT && (
               <div className="px-3 py-2 text-[10px] text-muted-foreground text-center border-t border-border/40">
                  Type more to see {filteredOptions.length - VIRTUAL_LIMIT} hidden results...
               </div>
            )}

            {onCreateNew && debouncedQuery && !options.some(o => o.id === debouncedQuery) && (
              <div
                role="option"
                aria-selected={false}
                onClick={() => {
                  onCreateNew(debouncedQuery);
                  setIsOpen(false);
                }}
                className={`flex items-center px-3 py-2 text-xs cursor-pointer text-primary font-medium transition-colors border-t border-border/40 ${
                  highlightedIndex === slicedOptions.length ? "bg-muted" : "hover:bg-muted/50"
                }`}
              >
                <span className="truncate">+ Create "{debouncedQuery}"</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

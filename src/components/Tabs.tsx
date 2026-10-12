import React, { createContext, useContext, useState, useRef, KeyboardEvent } from "react";

// Context to share state between Tabs, TabList, TabTriggers, and TabPanels
interface TabsContextType {
  activeTab: string;
  setActiveTab: (value: string) => void;
  orientation: "horizontal" | "vertical";
  registerTab: (value: string, element: HTMLButtonElement | null) => void;
  focusTab: (value: string) => void;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

export function Tabs({
  children,
  defaultValue,
  value,
  onValueChange,
  orientation = "horizontal",
  className = ""
}: {
  children: React.ReactNode;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  orientation?: "horizontal" | "vertical";
  className?: string;
}) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue || "");
  const activeTab = value !== undefined ? value : uncontrolledValue;
  const tabRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());

  const handleSetActiveTab = (newValue: string) => {
    if (value === undefined) setUncontrolledValue(newValue);
    onValueChange?.(newValue);
  };

  const registerTab = (tabValue: string, element: HTMLButtonElement | null) => {
    tabRefs.current.set(tabValue, element);
  };

  const focusTab = (tabValue: string) => {
    const el = tabRefs.current.get(tabValue);
    el?.focus();
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab: handleSetActiveTab, orientation, registerTab, focusTab }}>
      <div className={`w-full ${className}`}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabList({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const context = useContext(TabsContext);
  if (!context) throw new Error("TabList must be used within Tabs");

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const tabValues = Array.from((e.currentTarget.querySelectorAll('[role="tab"]') as NodeListOf<HTMLButtonElement>)).map(el => el.dataset.value);
    if (tabValues.length === 0) return;

    const currentIndex = tabValues.indexOf(context.activeTab);
    let nextIndex = currentIndex;

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % tabValues.length;
      e.preventDefault();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + tabValues.length) % tabValues.length;
      e.preventDefault();
    } else if (e.key === "Home") {
      nextIndex = 0;
      e.preventDefault();
    } else if (e.key === "End") {
      nextIndex = tabValues.length - 1;
      e.preventDefault();
    }

    if (nextIndex !== currentIndex && tabValues[nextIndex]) {
      const nextTab = tabValues[nextIndex]!;
      context.setActiveTab(nextTab);
      context.focusTab(nextTab);
    }
  };

  return (
    <div
      role="tablist"
      aria-orientation={context.orientation}
      onKeyDown={handleKeyDown}
      className={`relative flex items-center border-b border-border/40 overflow-x-auto no-scrollbar ${className}`}
      style={{
        maskImage: "linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)",
        WebkitMaskImage: "-webkit-linear-gradient(left, transparent, black 16px, black calc(100% - 16px), transparent)"
      }}
    >
      {children}
    </div>
  );
}

export function TabTrigger({
  children,
  value,
  className = "",
  count
}: {
  children: React.ReactNode;
  value: string;
  className?: string;
  count?: number | string;
}) {
  const context = useContext(TabsContext);
  if (!context) throw new Error("TabTrigger must be used within Tabs");

  const isActive = context.activeTab === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      aria-controls={`panel-${value}`}
      id={`tab-${value}`}
      data-value={value}
      tabIndex={isActive ? 0 : -1}
      onClick={() => context.setActiveTab(value)}
      ref={(el) => context.registerTab(value, el)}
      className={`
        relative px-4 py-2.5 text-sm font-medium whitespace-nowrap outline-none transition-colors duration-150
        focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background
        ${isActive ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}
        ${className}
      `}
    >
      {children}
      {count !== undefined && (
        <span className="text-xs text-muted-foreground/70 ms-1.5 font-normal">
          {count}
        </span>
      )}
      {isActive && (
        <div
          className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        />
      )}
    </button>
  );
}

export function TabPanel({
  children,
  value,
  className = ""
}: {
  children: React.ReactNode;
  value: string;
  className?: string;
}) {
  const context = useContext(TabsContext);
  if (!context) throw new Error("TabPanel must be used within Tabs");

  const isActive = context.activeTab === value;

  if (!isActive) return null;

  return (
    <div
      role="tabpanel"
      id={`panel-${value}`}
      aria-labelledby={`tab-${value}`}
      tabIndex={0}
      className={`animate-in fade-in duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${className}`}
    >
      {children}
    </div>
  );
}

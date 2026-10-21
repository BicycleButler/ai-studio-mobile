import React from "react";
import { SettingsTab } from "../../types";
import { SETTINGS_TABS_CONFIG } from "./SettingsTabsConfig";

export interface SettingsSidebarProps {
  activeTab: SettingsTab;
  setActiveTab: (tab: SettingsTab) => void;
  stopPreview: () => void;
  hasAnyAuth: boolean;
}

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  activeTab,
  setActiveTab,
  stopPreview,
  hasAnyAuth,
}) => {
  return (
    <div
      role="tablist"
      aria-label="Settings and Hub sections"
      className="flex border-b border-border bg-muted/40 px-2 sm:px-6 overflow-x-auto scrollbar-none shrink-0 touch-pan-x overscroll-x-contain gap-1"
    >
      {SETTINGS_TABS_CONFIG.map((tabConfig) => {
        const Icon = tabConfig.icon;
        const isActive = activeTab === tabConfig.id;

        return (
          <button
            key={tabConfig.id}
            type="button"
            role="tab"
            id={`tab-btn-${tabConfig.id}`}
            aria-selected={isActive}
            aria-controls={`tabpanel-${tabConfig.id}`}
            onClick={() => {
              stopPreview();
              setActiveTab(tabConfig.id);
            }}
            className={`flex flex-col items-center justify-center gap-1.5 py-3 px-3 min-w-[76px] sm:min-w-[84px] text-xs transition-colors shrink-0 cursor-pointer border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              isActive
                ? "border-primary text-primary bg-primary/10 font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:border-border font-medium"
            }`}
          >
            <div className="relative flex items-center justify-center">
              <Icon className="w-4 h-4" />
              {tabConfig.requiresAuthWarning && !hasAnyAuth && (
                <span className="absolute -top-1 -end-2 text-[10px] font-mono text-foreground font-bold" title="Authentication needed">
                  !
                </span>
              )}
            </div>
            <span className="whitespace-nowrap text-[11px]">{tabConfig.label}</span>
          </button>
        );
      })}
    </div>
  );
};

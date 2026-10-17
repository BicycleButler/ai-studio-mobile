import React from "react";
import {
  User,
  Sun,
  Sliders,
  Layers,
  Volume2,
  FolderHeart,
  Code2,
  Compass,
} from "lucide-react";
import { SettingsTab } from "../../types";


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
      <button
        type="button"
        role="tab"
        id="tab-btn-account"
        aria-selected={activeTab === "account"}
        aria-controls="tabpanel-account"
        onClick={() => {
          stopPreview();
          setActiveTab("account");
        }}
        className={`flex flex-col items-center justify-center gap-1.5 py-3 px-3 min-w-[76px] sm:min-w-[84px] text-xs transition-colors shrink-0 cursor-pointer border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          activeTab === "account"
            ? "border-primary text-primary bg-primary/10 font-semibold"
            : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:border-border font-medium"
        }`}
      >
        <div className="relative flex items-center justify-center">
          <User className="w-4 h-4" />
          {!hasAnyAuth && (
            <span className="absolute -top-1 -end-2 text-[10px] font-mono text-foreground font-bold" title="Authentication needed">
              !
            </span>
          )}
        </div>
        <span className="whitespace-nowrap text-[11px]">Profile</span>
      </button>

      <button
        type="button"
        role="tab"
        id="tab-btn-display"
        aria-selected={activeTab === "display"}
        aria-controls="tabpanel-display"
        onClick={() => {
          stopPreview();
          setActiveTab("display");
        }}
        className={`flex flex-col items-center justify-center gap-1.5 py-3 px-3 min-w-[76px] sm:min-w-[84px] text-xs transition-colors shrink-0 cursor-pointer border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          activeTab === "display"
            ? "border-primary text-primary bg-primary/10 font-semibold"
            : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:border-border font-medium"
        }`}
      >
        <Sun className="w-4 h-4" />
        <span className="whitespace-nowrap text-[11px]">Themes</span>
      </button>

      <button
        type="button"
        role="tab"
        id="tab-btn-security"
        aria-selected={activeTab === "security"}
        aria-controls="tabpanel-security"
        onClick={() => {
          stopPreview();
          setActiveTab("security");
        }}
        className={`flex flex-col items-center justify-center gap-1.5 py-3 px-3 min-w-[76px] sm:min-w-[84px] text-xs transition-colors shrink-0 cursor-pointer border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          activeTab === "security"
            ? "border-primary text-primary bg-primary/10 font-semibold"
            : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:border-border font-medium"
        }`}
      >
        <Sliders className="w-4 h-4" />
        <span className="whitespace-nowrap text-[11px]">Settings</span>
      </button>

      <button
        type="button"
        role="tab"
        id="tab-btn-model"
        aria-selected={activeTab === "model"}
        aria-controls="tabpanel-model"
        onClick={() => {
          stopPreview();
          setActiveTab("model");
        }}
        className={`flex flex-col items-center justify-center gap-1.5 py-3 px-3 min-w-[76px] sm:min-w-[84px] text-xs transition-colors shrink-0 cursor-pointer border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          activeTab === "model"
            ? "border-primary text-primary bg-primary/10 font-semibold"
            : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:border-border font-medium"
        }`}
      >
        <Layers className="w-4 h-4" />
        <span className="whitespace-nowrap text-[11px]">Models</span>
      </button>

      <button
        type="button"
        role="tab"
        id="tab-btn-audio"
        aria-selected={activeTab === "audio"}
        aria-controls="tabpanel-audio"
        onClick={() => {
          stopPreview();
          setActiveTab("audio");
        }}
        className={`flex flex-col items-center justify-center gap-1.5 py-3 px-3 min-w-[76px] sm:min-w-[84px] text-xs transition-colors shrink-0 cursor-pointer border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          activeTab === "audio"
            ? "border-primary text-primary bg-primary/10 font-semibold"
            : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:border-border font-medium"
        }`}
      >
        <Volume2 className="w-4 h-4" />
        <span className="whitespace-nowrap text-[11px]">Audio</span>
      </button>

      <button
        type="button"
        role="tab"
        id="tab-btn-library"
        aria-selected={activeTab === "library"}
        aria-controls="tabpanel-library"
        onClick={() => {
          stopPreview();
          setActiveTab("library");
        }}
        className={`flex flex-col items-center justify-center gap-1.5 py-3 px-3 min-w-[76px] sm:min-w-[84px] text-xs transition-colors shrink-0 cursor-pointer border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          activeTab === "library"
            ? "border-primary text-primary bg-primary/10 font-semibold"
            : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:border-border font-medium"
        }`}
      >
        <FolderHeart className="w-4 h-4" />
        <span className="whitespace-nowrap text-[11px]">Library</span>
      </button>

      <button
        type="button"
        role="tab"
        id="tab-btn-export"
        aria-selected={activeTab === "export"}
        aria-controls="tabpanel-export"
        onClick={() => {
          stopPreview();
          setActiveTab("export");
        }}
        className={`flex flex-col items-center justify-center gap-1.5 py-3 px-3 min-w-[76px] sm:min-w-[84px] text-xs transition-colors shrink-0 cursor-pointer border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          activeTab === "export"
            ? "border-primary text-primary bg-primary/10 font-semibold"
            : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:border-border font-medium"
        }`}
      >
        <Code2 className="w-4 h-4" />
        <span className="whitespace-nowrap text-[11px]">Code</span>
      </button>

      <button
        type="button"
        role="tab"
        id="tab-btn-companion"
        aria-selected={activeTab === "companion"}
        aria-controls="tabpanel-companion"
        onClick={() => {
          stopPreview();
          setActiveTab("companion");
        }}
        className={`flex flex-col items-center justify-center gap-1.5 py-3 px-3 min-w-[76px] sm:min-w-[84px] text-xs transition-colors shrink-0 cursor-pointer border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          activeTab === "companion"
            ? "border-primary text-primary bg-primary/10 font-semibold"
            : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:border-border font-medium"
        }`}
      >
        <Compass className="w-4 h-4" />
        <span className="whitespace-nowrap text-[11px]">Guide</span>
      </button>
    </div>
  );
};

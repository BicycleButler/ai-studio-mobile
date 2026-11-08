import React from "react";
import {
  Sun,
  Moon,
  Monitor,
  Laptop,
  Smartphone,
  Check,
} from "lucide-react";
import { ThemeMode } from "../../services/themeService";
import { DeviceFrameMode } from "../../types";

export interface SettingsDisplayTabProps {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  deviceMode: DeviceFrameMode;
  onSelectDeviceMode: (mode: DeviceFrameMode) => void;
}

export const SettingsDisplayTab: React.FC<SettingsDisplayTabProps> = ({
  themeMode,
  setThemeMode,
  deviceMode,
  onSelectDeviceMode,
}) => {
  return (
    <div className="space-y-5">
      {/* Theme Selection */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Theme Appearance
        </label>
        <div className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => setThemeMode("light")}
            className={`p-3 rounded-xl border text-start transition-colors cursor-pointer ${
              themeMode === "light"
                ? "bg-primary/20 border-primary ring-1 ring-primary"
                : "bg-card border-border hover:border-primary/50 hover:bg-muted"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-foreground" />
                <span className="font-semibold text-xs text-foreground">Light</span>
              </div>
              {themeMode === "light" && (
                <span className="text-xs text-muted-foreground/70 font-medium ml-1.5">
                  <Check className="w-2.5 h-2.5" />
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Minimal crisp high-contrast theme.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setThemeMode("dark")}
            className={`p-3 rounded-xl border text-start transition-colors cursor-pointer ${
              themeMode === "dark"
                ? "bg-primary/20 border-primary ring-1 ring-primary"
                : "bg-card border-border hover:border-primary/50 hover:bg-muted"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <Moon className="w-3.5 h-3.5 text-foreground" />
                <span className="font-semibold text-xs text-foreground">Dark</span>
              </div>
              {themeMode === "dark" && (
                <span className="text-xs text-muted-foreground/70 font-medium ml-1.5">
                  <Check className="w-2.5 h-2.5" />
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              AI Studio deep 4-tier dark theme.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setThemeMode("system")}
            className={`p-3 rounded-xl border text-start transition-colors cursor-pointer ${
              themeMode === "system"
                ? "bg-primary/20 border-primary ring-1 ring-primary"
                : "bg-card border-border hover:border-primary/50 hover:bg-muted"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5 text-foreground" />
                <span className="font-semibold text-xs text-foreground">System</span>
              </div>
              {themeMode === "system" && (
                <span className="text-xs text-muted-foreground/70 font-medium ml-1.5">
                  <Check className="w-2.5 h-2.5" />
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Automatically matches your OS preference.
            </p>
          </button>
        </div>
      </div>

      {/* Display View Mode */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Display View Mode
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onSelectDeviceMode("responsive")}
            className={`p-4 rounded-xl border text-start transition-colors cursor-pointer ${
              deviceMode === "responsive"
                ? "bg-primary/20 border-primary ring-1 ring-primary"
                : "bg-card border-border hover:border-primary/50 hover:bg-muted"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
                <Laptop className="w-4 h-4 text-primary" />
                <span>Responsive Full</span>
              </div>
              {deviceMode === "responsive" && (
                <span className="text-xs text-muted-foreground/70 font-medium ml-1.5">
                  <Check className="w-3 h-3" />
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Adapts fluidly to your full screen or preview window width.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onSelectDeviceMode("pixel")}
            className={`p-4 rounded-xl border text-start transition-colors cursor-pointer ${
              deviceMode === "pixel"
                ? "bg-primary/20 border-primary ring-1 ring-primary"
                : "bg-card border-border hover:border-primary/50 hover:bg-muted"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
                <Smartphone className="w-4 h-4 text-primary" />
                <span>Google Pixel 9</span>
              </div>
              {deviceMode === "pixel" && (
                <span className="text-xs text-muted-foreground/70 font-medium ml-1.5">
                  <Check className="w-3 h-3" />
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Realistic Android mobile frame simulation with status bar and bezel.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
};

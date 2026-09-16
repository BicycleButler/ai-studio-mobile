import React from "react";
import { Wifi, BatteryMedium, Signal } from "lucide-react";
import { DeviceFrameMode } from "../types";

interface AndroidFrameProps {
  mode: DeviceFrameMode;
  children: React.ReactNode;
}

export const AndroidFrame: React.FC<AndroidFrameProps> = ({ mode, children }) => {
  if (mode === "responsive") {
    return (
      <div className="w-full h-screen h-[100dvh] min-h-[100dvh] flex flex-col bg-background text-foreground overflow-hidden">
        {children}
      </div>
    );
  }

  // Pixel 9 Android Frame Simulation
  return (
    <div className="w-full min-h-screen min-h-[100dvh] bg-muted/60 flex items-center justify-center p-2 sm:p-6 overflow-y-auto">
      <div className="relative w-full max-w-[430px] h-[890px] max-h-[96vh] bg-background text-foreground rounded-[48px] shadow-2xl ring-1 ring-border outline outline-12 outline-card flex flex-col overflow-hidden border border-border">
        {/* Android Status Bar */}
        <div className="h-7 w-full bg-background text-foreground flex items-center justify-between px-7 shrink-0 select-none z-40 text-[11px] font-medium tracking-tight">
          <span>9:41</span>

          {/* Front camera punch hole */}
          <div className="w-3.5 h-3.5 rounded-full bg-foreground/90 ring-2 ring-border flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-card" />
          </div>

          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Signal className="w-3 h-3" />
            <Wifi className="w-3 h-3" />
            <BatteryMedium className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Screen Content */}
        <div className="flex-1 flex flex-col overflow-hidden relative bg-background">
          {children}
        </div>

        {/* Android Gesture Navigation Bar Pill */}
        <div className="h-4 w-full bg-background flex items-center justify-center shrink-0 z-40">
          <div className="w-32 h-1 bg-muted-foreground/40 rounded-full" />
        </div>
      </div>
    </div>
  );
};

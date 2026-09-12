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
      <div className="w-full h-screen flex flex-col bg-[#131314] text-[#e3e3e3] overflow-hidden">
        {children}
      </div>
    );
  }

  // Pixel 9 Android Frame Simulation
  return (
    <div className="w-full min-h-screen bg-[#090a0c] flex items-center justify-center p-2 sm:p-6 overflow-y-auto">
      <div className="relative w-full max-w-[430px] h-[890px] max-h-[96vh] bg-[#131314] rounded-[48px] shadow-2xl ring-1 ring-[#343741] outline outline-12 outline-[#22242a] flex flex-col overflow-hidden border border-[#30333b]">
        {/* Android Status Bar */}
        <div className="h-7 w-full bg-[#131314] text-white flex items-center justify-between px-7 shrink-0 select-none z-40 text-[11px] font-medium tracking-tight">
          <span>9:41</span>

          {/* Front camera punch hole */}
          <div className="w-3.5 h-3.5 rounded-full bg-black ring-2 ring-[#22242a] flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-[#0a1828]" />
          </div>

          <div className="flex items-center gap-1.5 text-zinc-300">
            <Signal className="w-3 h-3" />
            <Wifi className="w-3 h-3" />
            <BatteryMedium className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Screen Content */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {children}
        </div>

        {/* Android Gesture Navigation Bar Pill */}
        <div className="h-4 w-full bg-[#131314] flex items-center justify-center shrink-0 z-40">
          <div className="w-32 h-1 bg-[#474a54] rounded-full" />
        </div>
      </div>
    </div>
  );
};

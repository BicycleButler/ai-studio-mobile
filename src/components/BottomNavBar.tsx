import React from "react";
import { MessageSquare, Sliders, FolderHeart, Code2, Compass } from "lucide-react";
import { ActiveTab } from "../types";

interface BottomNavBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onSelectTab,
}) => {
  const tabs = [
    {
      id: "chat" as ActiveTab,
      label: "Prompt",
      icon: MessageSquare,
    },
    {
      id: "parameters" as ActiveTab,
      label: "Tune",
      icon: Sliders,
    },
    {
      id: "library" as ActiveTab,
      label: "Library",
      icon: FolderHeart,
    },
    {
      id: "export" as ActiveTab,
      label: "Get Code",
      icon: Code2,
    },
    {
      id: "companion" as ActiveTab,
      label: "Companion",
      icon: Compass,
    },
  ];

  return (
    <nav
      id="android-bottom-nav"
      className="sticky bottom-0 z-30 bg-[#131314]/95 backdrop-blur-lg border-t border-[#2b2c31] px-2 py-1.5"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              onClick={() => onSelectTab(tab.id)}
              className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors relative group"
            >
              {/* Material You pill highlight */}
              <div
                className={`flex items-center justify-center w-12 h-7 rounded-full transition-colors duration-200 ${
                  isActive
                    ? "bg-blue-600/25 text-blue-400"
                    : "text-[#9aa0a6] group-hover:text-[#c4c7c5] group-hover:bg-[#1f1f23]"
                }`}
              >
                <Icon
                  className={`w-4 h-4 transition-transform ${
                    isActive ? "scale-110 stroke-[2.2]" : "stroke-[1.8]"
                  }`}
                />
              </div>
              <span
                className={`text-[10px] mt-0.5 font-medium transition-colors ${
                  isActive ? "text-blue-400 font-semibold" : "text-[#9aa0a6]"
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

import React, { useState } from "react";
import {
  FolderHeart,
  Trash2,
  Sparkles,
  ArrowRight,
  BookmarkPlus,
  Calendar,
  Layers,
} from "lucide-react";
import { SavedPrompt } from "../types";
import { STARTER_TEMPLATES } from "../data/templates";

interface LibraryModalProps {
  savedPrompts: SavedPrompt[];
  onLoadPrompt: (prompt: SavedPrompt) => void;
  onSaveCurrentPrompt: (title: string) => void;
  onDeletePrompt: (id: string) => void;
  currentTitle?: string;
  isEmbedded?: boolean;
}

export const LibraryModal: React.FC<LibraryModalProps> = ({
  savedPrompts,
  onLoadPrompt,
  onSaveCurrentPrompt,
  onDeletePrompt,
  currentTitle = "My Custom Prompt",
  isEmbedded = false,
}) => {
  const [newTitle, setNewTitle] = useState(currentTitle);
  const [showSaveForm, setShowSaveForm] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onSaveCurrentPrompt(newTitle.trim());
    setShowSaveForm(false);
  };

  return (
    <div
      className={`flex flex-col space-y-4 ${
        isEmbedded ? "bg-transparent p-0" : "h-full overflow-y-auto bg-[#131314] p-3.5"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#2b2c31]">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
            <FolderHeart className="w-4 h-4 text-blue-400" />
            <span>Prompt Library & Templates</span>
          </h2>
          <p className="text-xs text-[#9aa0a6] mt-0.5">
            Quick-load starter templates or save prompts for future mobile sessions.
          </p>
        </div>
        <button
          onClick={() => setShowSaveForm(!showSaveForm)}
          className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1 shadow-sm transition-colors"
        >
          <BookmarkPlus className="w-3.5 h-3.5" />
          <span>Save Current</span>
        </button>
      </div>

      {/* Save current prompt form */}
      {showSaveForm && (
        <form
          onSubmit={handleSave}
          className="bg-[#1a1b20] border border-blue-500/40 rounded-xl p-3 space-y-2.5 animate-in fade-in"
        >
          <label className="text-xs font-semibold text-blue-300">
            Prompt Name
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g., Android Navigation Assistant"
              className="flex-1 bg-[#121214] border border-[#2d2f36] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500"
            >
              Save
            </button>
          </div>
        </form>
      )}

      {/* 1. Starter Templates */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-[#9aa0a6] uppercase tracking-wider px-1">
          Google AI Studio Templates
        </div>
        <div className="grid grid-cols-1 gap-2">
          {STARTER_TEMPLATES.map((tmpl) => (
            <div
              key={tmpl.id}
              onClick={() => onLoadPrompt(tmpl)}
              className="group p-3 rounded-xl bg-[#1a1b20] hover:bg-[#22242b] border border-[#2b2c31] hover:border-blue-500/50 cursor-pointer transition-colors flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <span className="text-xs font-semibold text-white group-hover:text-blue-300 transition-colors">
                    {tmpl.title}
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#282a30] text-zinc-300 font-mono">
                  {tmpl.type}
                </span>
              </div>

              <p className="text-[11px] text-[#9aa0a6] line-clamp-2 mb-2">
                {tmpl.config.systemInstruction || "Ready-to-run prompt template"}
              </p>

              <div className="flex items-center justify-between text-[10px] text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-3 h-3 text-zinc-400" />
                  <span>{tmpl.config.model}</span>
                </div>
                <span className="text-blue-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                  Load Template <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. User Saved Prompts */}
      <div className="space-y-2 pt-2">
        <div className="text-[11px] font-semibold text-[#9aa0a6] uppercase tracking-wider px-1">
          My Saved Prompts ({savedPrompts.length})
        </div>

        {savedPrompts.length === 0 ? (
          <div className="p-6 rounded-xl bg-[#17181c] border border-dashed border-[#2b2c31] text-center text-xs text-zinc-500">
            No saved prompts yet. Click &quot;Save Current&quot; above to store your mobile prompt configurations.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {savedPrompts.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-[#1a1b20] border border-[#2b2c31] hover:border-[#3a3d46] transition-colors flex items-center justify-between"
              >
                <div
                  onClick={() => onLoadPrompt(item)}
                  className="flex-1 cursor-pointer min-w-0 pr-2"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-white truncate">
                      {item.title}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#282a30] text-zinc-400">
                      {item.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(item.updatedAt).toLocaleDateString()}
                    </span>
                    <span>• {item.config.model}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onLoadPrompt(item)}
                    className="px-2.5 py-1 text-xs rounded-lg bg-[#25272e] hover:bg-blue-600 hover:text-white text-zinc-300 transition-colors"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => onDeletePrompt(item.id)}
                    className="p-1.5 text-zinc-500 hover:text-rose-400 rounded-lg hover:bg-[#25272e] transition-colors"
                    title="Delete prompt"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

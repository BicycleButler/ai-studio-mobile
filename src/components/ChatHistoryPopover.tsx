import React from "react";
import {
  Plus,
  Clock,
  ArrowRight,
  Square,
  CheckSquare,
  MessageSquare,
  Trash2,
} from "lucide-react";
import { ChatSession } from "../types";
import { formatRelativeTime } from "../utils/timeUtils";
import { BatchSelectionHeader } from "./BatchSelectionHeader";

export interface ChatHistoryPopoverProps {
  isJulesMode: boolean;
  historySessions?: ChatSession[];
  validHistorySessions: ChatSession[];
  selectedHistoryIds: Set<string>;
  toggleHistorySelection: (id: string, e: React.MouseEvent | React.KeyboardEvent, index: number) => void;
  toggleSelectAllHistory: () => void;
  handleStartNewChat: () => void;
  handleSelectSession: (session: ChatSession) => void;
  handleDeleteSession: (id: string) => void;
  currentSessionId: string | null;
  popoverRef: React.RefObject<HTMLDivElement | null>;
  getHistorySelectionState: (items?: string[]) => "none" | "some" | "all";
}

export const ChatHistoryPopover: React.FC<ChatHistoryPopoverProps> = ({
  isJulesMode,
  validHistorySessions,
  selectedHistoryIds,
  toggleHistorySelection,
  toggleSelectAllHistory,
  handleStartNewChat,
  handleSelectSession,
  handleDeleteSession,
  currentSessionId,
  popoverRef,
  getHistorySelectionState,
}) => {
  return (
    <div
      ref={popoverRef}
      id="chat-window-history-popover"
      role="dialog"
      aria-label={isJulesMode ? "New task and history menu" : "New chat and history menu"}
      className="absolute end-0 top-full mt-2 z-40 w-72 sm:w-80 max-w-[calc(100vw-24px)] rounded-2xl bg-popover/98 border border-border shadow-2xl overflow-hidden backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-150 ease-out"
    >
      {/* Arrow Indicator pointing up to Plus button */}
      <div className="absolute -top-1.5 end-3 w-3 h-3 rotate-45 bg-popover border-t border-s border-border pointer-events-none" />

      {/* 1. Primary Action: Start New Chat */}
      <button
        type="button"
        id="chat-popover-new-chat-btn"
        onClick={handleStartNewChat}
        className="w-full p-3 flex items-center gap-3 text-start text-xs font-semibold text-foreground hover:bg-muted/70 active:bg-muted transition-colors group border-0 bg-transparent cursor-pointer"
      >
        <div className="w-7 h-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
          <Plus className="w-4 h-4 stroke-[2.5]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="leading-tight text-foreground font-medium">
            {isJulesMode ? "Start New Task" : "Start New Chat"}
          </div>
          <div className="text-[10px] text-muted-foreground font-normal mt-0.5">
            {isJulesMode ? "Create a clean task workspace" : "Fresh conversation & clean context"}
          </div>
        </div>
        <ArrowRight className="rtl:rotate-180 w-3.5 h-3.5 text-muted-foreground/60 group-hover:text-foreground group-hover:translate-x-0.5 group-hover:rtl:-translate-x-0.5 transition" />
      </button>

      <div className="border-t border-border" />

      {/* 2. Historical Chats Header */}
      <div className="px-3 py-2 bg-muted/40 flex items-center justify-between border-b border-border/60">
        <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <span>{isJulesMode ? "Task History" : "Recent Chats"}</span>
        </span>
        <span className="px-1.5 py-0.5 rounded-full bg-muted text-[10px] font-mono font-medium text-muted-foreground border border-border/40">
          {validHistorySessions.length} {validHistorySessions.length === 1 ? "chat" : "chats"}
        </span>
      </div>

      {/* 3. Batch Select All Toggle (Only if there are valid history items) */}
      {validHistorySessions.length > 0 && (
        <BatchSelectionHeader
          selectedCount={selectedHistoryIds.size}
          totalCount={validHistorySessions.length}
          selectionState={getHistorySelectionState(validHistorySessions.map(s => s.id))}
          onToggleSelectAll={toggleSelectAllHistory}
          className="!px-3 !bg-muted/20 border-border/40"
        />
      )}

      {/* 4. Scrollable History List */}
      <div className="max-h-[45vh] overflow-y-auto overscroll-contain">
        {validHistorySessions.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
            <MessageSquare className="w-6 h-6 text-muted-foreground/40 mb-1" />
            <p>No recent conversations</p>
          </div>
        ) : (
          validHistorySessions.map((session, index) => {
            const isActive = session.id === currentSessionId;
            const isSelected = selectedHistoryIds.has(session.id);

            return (
              <div
                key={session.id}
                className={`flex items-center justify-between gap-2 p-2.5 transition-colors group ${
                  isActive ? "bg-primary/10 hover:bg-primary/15" :
                  isSelected ? "bg-primary/5" : "hover:bg-muted/70"
                }`}
              >
                <button
                  type="button"
                  onClick={(e) => toggleHistorySelection(session.id, e, index)}
                  className="me-1 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-0"
                  aria-label={`Select chat ${session.title}`}
                >
                  {isSelected ? (
                    <CheckSquare className="w-4 h-4 text-primary" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectSession(session)}
                  className="flex-1 min-w-0 text-start flex items-start gap-2.5 border-0 bg-transparent cursor-pointer p-0"
                >
                  <div className="mt-0.5 shrink-0">
                    <MessageSquare
                      className={`w-3.5 h-3.5 ${
                        isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-xs truncate font-medium ${
                        isActive ? "text-primary font-semibold" : "text-foreground group-hover:text-foreground"
                      }`}
                    >
                      {session.title || "Untitled Conversation"}
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      {isActive && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-medium text-primary bg-primary/15 border border-primary/25">
                          Active
                        </span>
                      )}
                      <span>{formatRelativeTime(session.updatedAt)}</span>
                      <span>•</span>
                      <span>
                        {session.messages?.length || 0}{" "}
                        {session.messages?.length === 1 ? "msg" : "msgs"}
                      </span>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  id={`chat-delete-session-${session.id}`}
                  aria-label={`Delete chat: ${session.title}`}
                  title="Delete chat"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSession(session.id);
                  }}
                  className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-muted/40 rounded-lg transition-colors shrink-0 opacity-60 group-hover:opacity-100 border-0 bg-transparent cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

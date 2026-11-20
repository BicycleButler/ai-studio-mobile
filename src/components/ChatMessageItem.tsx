import React from "react";
import { Copy, Check, RotateCcw, Square, Volume2 } from "lucide-react";
import Markdown from "react-markdown";
import { ChatMessage } from "../types";

export interface ChatMessageItemProps {
  msg: ChatMessage;
  defaultModelName: string;
  webllmLoadingText?: string;
  isExpanded: boolean;
  isCopied: boolean;
  isSpeaking: boolean;
  getTemplateTitle: (templateId: string) => string;
  onToggleExpanded: (messageId: string) => void;
  onCopy: (id: string, text: string) => void;
  onRegenerate: () => void;
  onToggleSpeech: (text: string) => void;
  onStopPlayback: () => void;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = React.memo(
  ({
    msg,
    defaultModelName,
    webllmLoadingText,
    isExpanded,
    isCopied,
    isSpeaking,
    getTemplateTitle,
    onToggleExpanded,
    onCopy,
    onRegenerate,
    onToggleSpeech,
    onStopPlayback,
  }) => {
    const markdownContent =
      msg.text ||
      (msg.isStreaming ? webllmLoadingText || "Thinking..." : "");

    return (
      <div
        className={`flex flex-col ${
          msg.role === "user" ? "items-end" : "items-start"
        }`}
      >
        {/* Sender label */}
        <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-muted-foreground">
          {msg.role === "user" ? (
            <span className="font-medium text-foreground">User</span>
          ) : (
            <div className="flex items-center gap-1">
              <span className="font-medium text-foreground">
                {msg.modelName || defaultModelName}
              </span>
              {msg.tokenCount && (
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  · {msg.tokenCount} tokens
                </span>
              )}
              {msg.durationMs && (
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  · {(msg.durationMs / 1000).toFixed(2)}s
                </span>
              )}
            </div>
          )}
        </div>

        {/* Message bubble */}
        <div
          className={`max-w-[95%] sm:max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed ${
            msg.role === "user"
              ? "bg-primary text-primary-foreground rounded-tr-none shadow-sm"
              : "bg-card text-card-foreground rounded-tl-none shadow-sm"
          }`}
        >
          {/* Images preview if present */}
          {msg.images && msg.images.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {msg.images.map((img) => (
                <div
                  key={img.id}
                  className="relative rounded-lg overflow-hidden max-w-[160px] max-h-[160px]"
                >
                  <img
                    src={img.previewUrl}
                    alt={img.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Message content */}
          {msg.role === "model" ? (
            <div className="prose dark:prose-invert prose-xs sm:prose-sm max-w-none break-words [&>pre]:bg-muted [&>pre]:p-3 [&>pre]:rounded-xl [&>pre]:border [&>pre]:border-border [&>pre]:overflow-x-auto [&>code]:text-primary [&>code]:bg-muted [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded [&>ul]:list-disc [&>ul]:ps-4 [&>ol]:list-decimal [&>ol]:ps-4">
              <Markdown>{markdownContent}</Markdown>
              {msg.isStreaming && (
                <span className="inline-block w-1.5 h-3.5 bg-primary ms-1 animate-pulse align-middle" />
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {/* Structured Provenance Display */}
              {msg.templateIds && msg.templateIds.length > 0 && (
                <div className="pb-1.5 border-b border-primary-foreground/20 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    <div className="flex items-center gap-1 flex-wrap">
                      {msg.templateIds.map((tplId, idx) => (
                        <span
                          key={`${msg.id}-${tplId}-${idx}`}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/20 text-[10px] font-medium tracking-tight text-primary-foreground border border-primary-foreground/20"
                        >
                          <span className="font-mono text-[9px] opacity-75 font-bold">
                            #{idx + 1}
                          </span>
                          <span>{getTemplateTitle(tplId)}</span>
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      id={`toggle-composite-prompt-${msg.id}`}
                      onClick={() => onToggleExpanded(msg.id)}
                      className="text-[10px] text-primary-foreground/90 hover:text-white underline font-medium cursor-pointer"
                    >
                      {isExpanded ? "Hide full prompt" : "Inspect full prompt"}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="p-2 rounded-xl bg-black/30 border border-primary-foreground/20 text-[11px] font-mono text-primary-foreground whitespace-pre-wrap leading-relaxed animate-in fade-in">
                      {msg.text}
                    </div>
                  )}
                </div>
              )}

              <p className="whitespace-pre-wrap">
                {msg.rawUserText !== undefined ? msg.rawUserText : msg.text}
              </p>
            </div>
          )}

          {msg.error && (
            <div className="mt-2 p-2 rounded-lg bg-muted/40 border border-destructive/30 text-destructive text-xs">
              {msg.error}
            </div>
          )}
        </div>

        {/* Action buttons on model responses */}
        {msg.role === "model" && !msg.isStreaming && (
          <div className="flex items-center gap-1 mt-1 px-1">
            <button
              onClick={() => onCopy(msg.id, msg.text)}
              className="min-w-[44px] min-h-[44px] p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer flex items-center justify-center touch-manipulation"
              title="Copy response"
              aria-label="Copy response"
            >
              {isCopied ? (
                <Check className="w-4 h-4 text-primary" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={onRegenerate}
              className="min-w-[44px] min-h-[44px] p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer flex items-center justify-center touch-manipulation"
              title="Regenerate"
              aria-label="Regenerate response"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (isSpeaking) {
                  onStopPlayback();
                } else {
                  onToggleSpeech(msg.text);
                }
              }}
              className={`min-w-[44px] min-h-[44px] p-2.5 rounded-lg transition-colors flex items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer touch-manipulation ${
                isSpeaking ? "text-primary bg-primary/10" : ""
              }`}
              title={isSpeaking ? "Stop speech" : "Read aloud response"}
              aria-label={isSpeaking ? "Stop speech" : "Read aloud response"}
            >
              {isSpeaking ? (
                <Square className="w-4 h-4 fill-primary text-primary" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
          </div>
        )}
      </div>
    );
  }
);

ChatMessageItem.displayName = "ChatMessageItem";

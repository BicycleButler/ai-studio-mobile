import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Send,
  Square,
  Image as ImageIcon,
  X,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Trash2,
  Loader2,
  ArrowRight,
  Volume2,
  Mic,
  Plus,
  Clock,
  MessageSquare,
  Bot,
  FolderGit2,
  Layers,
} from "lucide-react";
import Markdown from "react-markdown";
import {
  ChatMessage,
  MessageAttachment,
  PromptConfig,
  GoogleUser,
  ChatSession,
  JulesSession,
} from "../types";
import { compressImageForGemini } from "../utils/imageCompressor";
import { extractSpokenText } from "../utils/speechExtractor";
import {
  SpeechSettings,
  loadSpeechSettings,
} from "../services/speechVoices";
import { getAuthHeaders } from "../services/auth";
import { SettingsTab } from "./UnifiedSettingsModal";
import { useSpeechToText } from "../hooks/useSpeechToText";
import {
  getChatSessions,
  deleteChatSession,
  formatRelativeTime,
} from "../services/chatHistoryService";
import { JulesActivityCard } from "./JulesActivityCard";
import { GoogleIcon } from "./GoogleIcon";
import { PromptTemplateDrawer } from "./PromptTemplateDrawer";
import {
  composePrompt,
  getTemplateById,
  getAllTemplates,
} from "../services/promptTemplateService";
import { PromptTemplate } from "../types";

interface ChatWorkspaceProps {
  messages: ChatMessage[];
  onSendMessage: (
    text: string,
    attachments?: MessageAttachment[],
    templateIds?: string[],
    rawUserText?: string
  ) => void;
  onClearMessages: () => void;
  onRegenerate: () => void;
  onStopGeneration: () => void;
  isGenerating: boolean;
  config: PromptConfig;
  onUpdateSystemInstruction: (inst: string) => void;
  onOpenParameters: () => void;
  hasApiKey?: boolean;
  googleUser?: GoogleUser | null;
  onOpenAuth?: () => void;
  speechSettings?: SpeechSettings;
  onSaveSpeechSettings?: (settings: SpeechSettings) => void;
  onOpenSettings?: (tab?: SettingsTab) => void;
  activeProjectId?: string;
  currentSessionId?: string | null;
  onSelectSession?: (session: ChatSession) => void;
  onNewChat?: () => void;
  isJulesMode?: boolean;
  activeJulesSession?: JulesSession | null;
  onOpenJulesSessions?: () => void;
  onApproveJulesPlan?: (taskId: string) => void;
  onRejectJulesPlan?: (taskId: string) => void;
  isApprovingJulesPlan?: boolean;
}

export const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({
  messages,
  onSendMessage,
  onClearMessages,
  onRegenerate,
  onStopGeneration,
  isGenerating,
  config: _config,
  onUpdateSystemInstruction: _onUpdateSystemInstruction,
  onOpenParameters: _onOpenParameters,
  hasApiKey = true,
  googleUser = null,
  onOpenAuth,
  speechSettings: propSpeechSettings,
  onSaveSpeechSettings: _onSaveSpeechSettings,
  onOpenSettings: _onOpenSettings,
  activeProjectId,
  currentSessionId,
  onSelectSession,
  onNewChat,
  isJulesMode = false,
  activeJulesSession = null,
  onOpenJulesSessions,
  onApproveJulesPlan,
  onRejectJulesPlan,
  isApprovingJulesPlan = false,
}) => {
  const [inputText, setInputText] = useState("");
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [isOptimizingImage, setIsOptimizingImage] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isBufferingAudio, setIsBufferingAudio] = useState(false);
  const [localSpeechSettings] = useState<SpeechSettings>(() =>
    loadSpeechSettings()
  );

  // History & New Chat Popover State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historySessions, setHistorySessions] = useState<ChatSession[]>(() =>
    getChatSessions(activeProjectId)
  );
  const historyPopoverRef = useRef<HTMLDivElement>(null);
  const historyButtonRef = useRef<HTMLButtonElement>(null);

  // Prompt Templates State (Strict FIFO selection order)
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [isTemplateDrawerOpen, setIsTemplateDrawerOpen] = useState(false);
  const [expandedMessageIds, setExpandedMessageIds] = useState<Set<string>>(new Set());
  const [allTemplatesList, setAllTemplatesList] = useState<PromptTemplate[]>(() => getAllTemplates());

  // Refresh templates list when drawer toggles
  useEffect(() => {
    setAllTemplatesList(getAllTemplates());
  }, [isTemplateDrawerOpen]);

  const handleToggleTemplate = (templateId: string) => {
    setSelectedTemplateIds((prev) =>
      prev.includes(templateId)
        ? prev.filter((id) => id !== templateId)
        : [...prev, templateId]
    );
  };

  const handleRemoveTemplate = (templateId: string) => {
    setSelectedTemplateIds((prev) => prev.filter((id) => id !== templateId));
  };

  const handleClearAllTemplates = () => {
    setSelectedTemplateIds([]);
  };

  const toggleMessageExpanded = (messageId: string) => {
    setExpandedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  // Resolve selected template objects in strict FIFO order
  const selectedTemplateObjects = useMemo(() => {
    const map = new Map<string, PromptTemplate>();
    allTemplatesList.forEach((t) => map.set(t.id, t));
    return selectedTemplateIds
      .map((id) => map.get(id))
      .filter((t): t is PromptTemplate => Boolean(t));
  }, [allTemplatesList, selectedTemplateIds]);

  // Sync saved history sessions on project change, messages change, or popover toggle
  useEffect(() => {
    setHistorySessions(getChatSessions(activeProjectId));
  }, [activeProjectId, messages.length, isHistoryOpen]);

  // Click outside and escape key handling for popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        historyPopoverRef.current &&
        !historyPopoverRef.current.contains(event.target as Node) &&
        historyButtonRef.current &&
        !historyButtonRef.current.contains(event.target as Node)
      ) {
        setIsHistoryOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsHistoryOpen(false);
      }
    };

    if (isHistoryOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isHistoryOpen]);

  const speechSettings = propSpeechSettings || localSpeechSettings;

  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const speechBaseTextRef = useRef<string>("");

  const {
    isListening,
    transcript: _speechTranscript,
    startListening,
    stopListening,
  } = useSpeechToText({
    onTranscript: (spokenChunk) => {
      const base = speechBaseTextRef.current;
      const sep = base && !base.endsWith(" ") ? " " : "";
      setInputText(base ? `${base}${sep}${spokenChunk}` : spokenChunk);
    },
  });

  const handleActivatePromptSpeech = () => {
    // Synchronously focus the prompt instructions textarea (activates mobile keyboard and keyboard mic)
    if (textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
      textareaRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    if (isListening) {
      stopListening();
    } else {
      speechBaseTextRef.current = inputText;
      startListening();
    }
  };

  const stopAllPlayback = () => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setIsBufferingAudio(false);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  // Adjust textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputText]);

  // Cancel ongoing speech synthesis or audio playback if a new generation begins
  useEffect(() => {
    if (isGenerating) {
      stopAllPlayback();
    }
  }, [isGenerating]);

  // Clean up speech synthesis on component unmount
  useEffect(() => {
    return () => {
      stopAllPlayback();
    };
  }, []);

  // Identify the most recent response from the model/agent
  const lastModelMessage = [...messages]
    .reverse()
    .find((m) => m.role === "model" && m.text && m.text.trim().length > 0);

  // Helper for on-device speech synthesis fallback
  const fallbackToDeviceSpeech = (textToSpeak: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setIsSpeaking(false);
      setIsBufferingAudio(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = speechSettings.playbackRate;

    // Pick chosen device voice or best natural voice
    const rawVoices = window.speechSynthesis.getVoices();
    if (speechSettings.deviceVoiceURI) {
      const matched = rawVoices.find(
        (v) => v.voiceURI === speechSettings.deviceVoiceURI
      );
      if (matched) utterance.voice = matched;
    } else if (rawVoices.length > 0) {
      const naturalVoice = rawVoices.find((v) => {
        const name = v.name.toLowerCase();
        return (
          name.includes("natural") ||
          name.includes("enhanced") ||
          name.includes("google") ||
          name.includes("siri") ||
          name.includes("online")
        );
      });
      if (naturalVoice) utterance.voice = naturalVoice;
    }

    utterance.onstart = () => {
      setIsBufferingAudio(false);
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setIsBufferingAudio(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleToggleSpeech = async (customText?: string) => {
    if (isSpeaking || isBufferingAudio) {
      stopAllPlayback();
      return;
    }

    const textToProcess = customText || lastModelMessage?.text;
    if (!textToProcess) return;

    // Extract spoken text strictly omitting code blocks and formatting
    const spokenText = extractSpokenText(textToProcess);
    const contentToSpeak =
      spokenText.trim() ||
      "The agent response contains code only, which was omitted.";

    if (speechSettings.engine === "gemini") {
      setIsBufferingAudio(true);
      try {
        const authHeaders = getAuthHeaders();
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify({
            text: contentToSpeak,
            voiceName: speechSettings.geminiVoice,
          }),
        });

        if (!res.ok) {
          throw new Error(`TTS server error HTTP ${res.status}`);
        }

        const data = await res.json();
        if (!data.audioUrl) {
          throw new Error("No audio payload returned from Gemini TTS");
        }

        const audio = new Audio(data.audioUrl);
        audio.playbackRate = speechSettings.playbackRate;
        activeAudioRef.current = audio;

        audio.onplay = () => {
          setIsBufferingAudio(false);
          setIsSpeaking(true);
        };

        audio.onended = () => {
          setIsSpeaking(false);
          activeAudioRef.current = null;
        };

        audio.onerror = () => {
          console.warn("Audio element error, falling back to on-device natural voice");
          fallbackToDeviceSpeech(contentToSpeak);
        };

        await audio.play();
      } catch (err) {
        console.warn("Gemini Studio TTS failed, falling back to on-device voice:", err);
        fallbackToDeviceSpeech(contentToSpeak);
      }
    } else {
      fallbackToDeviceSpeech(contentToSpeak);
    }
  };

  const handleSend = () => {
    if (
      (!inputText.trim() && attachments.length === 0 && selectedTemplateIds.length === 0) ||
      isGenerating ||
      isOptimizingImage
    )
      return;
    stopAllPlayback();
    if (!hasApiKey && onOpenAuth) {
      onOpenAuth();
      return;
    }

    let textToSend = inputText.trim();
    let appliedTemplateIds: string[] | undefined = undefined;
    let userRawText: string | undefined = undefined;

    if (selectedTemplateIds.length > 0) {
      const composed = composePrompt(selectedTemplateIds, inputText.trim());
      textToSend = composed.combinedText;
      appliedTemplateIds = composed.templateIds;
      userRawText = composed.userText;
    }

    onSendMessage(textToSend, attachments, appliedTemplateIds, userRawText);
    setInputText("");
    setAttachments([]);
    setSelectedTemplateIds([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) return;

    setIsOptimizingImage(true);
    try {
      const compressedList = await Promise.all(
        imageFiles.map((file) => compressImageForGemini(file))
      );
      setAttachments((prev) => [...prev, ...compressedList]);
    } catch (err: unknown) {
      console.error("Failed to compress image attachment:", err);
    } finally {
      setIsOptimizingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearChat = () => {
    stopAllPlayback();
    onClearMessages();
  };

  const handleStartNewChat = () => {
    stopAllPlayback();
    setIsHistoryOpen(false);
    if (onNewChat) {
      onNewChat();
    } else {
      onClearMessages();
    }
  };

  const handleSelectSession = (session: ChatSession) => {
    stopAllPlayback();
    setIsHistoryOpen(false);
    if (onSelectSession) {
      onSelectSession(session);
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    deleteChatSession(sessionId, activeProjectId);
    const updated = getChatSessions(activeProjectId);
    setHistorySessions(updated);
    if (sessionId === currentSessionId) {
      if (onNewChat) {
        onNewChat();
      } else {
        onClearMessages();
      }
    }
  };

  const starterChips = [
    "Write an Android Jetpack Compose animation",
    "Explain how Gemini 3.8 Flash handles multimodal tokens",
    "Design a JSON schema for a food delivery order",
    "Refactor this function to be more memory-efficient",
  ];

  const julesStarterChips = [
    "Fix syntax errors or failing linter checks in this repository",
    "Refactor the authentication flow to use modern token-based auth",
    "Add comprehensive unit test coverage with Vitest or Jest",
    "Optimize mobile responsive layouts and improve touch targets",
  ];

  return (
    <div className="flex flex-col h-full flex-1 overflow-hidden bg-background relative">
      {/* Contextual Subheader: Jules Repository Header OR Gemini Prompt Workspace Bar */}
      {isJulesMode ? (
        <div className="px-3 py-2 bg-card border-b border-border flex items-center justify-between gap-2 shrink-0 z-20">
          <div className="flex items-center gap-2 min-w-0">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-foreground truncate">
                Google Jules Agent
              </div>
              <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 font-mono truncate">
                <span className="text-foreground truncate">
                  {activeJulesSession ? activeJulesSession.repository : "No repository selected"}
                </span>
                {activeJulesSession && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">{activeJulesSession.branch}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onOpenJulesSessions && (
              <button
                type="button"
                id="jules-switch-task-btn"
                onClick={onOpenJulesSessions}
                className="px-2 py-1 rounded-lg bg-muted hover:bg-muted/80 text-foreground border border-border text-[11px] font-medium transition-colors shrink-0 shadow-xs flex items-center gap-1 cursor-pointer"
                title="Manage Jules Tasks & Sessions"
              >
                <Bot className="w-3 h-3 text-primary" />
                <span className="hidden xs:inline">Tasks</span>
              </button>
            )}
            <button
              ref={historyButtonRef}
              type="button"
              id="chat-window-new-and-history-btn"
              aria-label="New chat and historical chats"
              aria-haspopup="true"
              aria-expanded={isHistoryOpen}
              title="New task & history"
              onClick={() => setIsHistoryOpen((prev) => !prev)}
              className={`h-7 px-2 flex items-center gap-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                isHistoryOpen
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted hover:bg-muted/80 text-foreground border-border"
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="text-[11px]">New</span>
            </button>
            <button
              type="button"
              id="chat-top-right-templates-btn"
              aria-label="Prompt Templates"
              title="Prompt Templates"
              onClick={() => setIsTemplateDrawerOpen(true)}
              className={`h-7 px-2 flex items-center gap-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                selectedTemplateIds.length > 0
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted hover:bg-muted/80 text-foreground border-border"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden xs:inline text-[11px]">Templates</span>
              {selectedTemplateIds.length > 0 && (
                <span className="w-3.5 h-3.5 rounded-full bg-primary-foreground text-primary text-[9px] font-mono font-bold flex items-center justify-center">
                  {selectedTemplateIds.length}
                </span>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* Floating controls: '+' New/History button and directly below it the Templates button */
        <div className="absolute top-1.5 right-2 z-30 flex flex-col items-center gap-1">
          <button
            ref={historyButtonRef}
            type="button"
            id="chat-window-new-and-history-btn"
            aria-label="Chats menu"
            aria-haspopup="true"
            aria-expanded={isHistoryOpen}
            title="Chats menu"
            onClick={() => setIsHistoryOpen((prev) => !prev)}
            className="w-9 h-9 min-w-[36px] min-h-[36px] sm:w-10 sm:h-10 sm:min-w-[40px] sm:min-h-[40px] flex items-center justify-center p-0 border-0 bg-transparent text-muted-foreground hover:text-foreground active:scale-95 transition-colors cursor-pointer rounded-xl focus:outline-none"
          >
            <Plus className="w-[11px] h-[11px]" />
          </button>

          {/* Accordion trigger button placed directly below the '+' icon (id="chat-top-right-templates-btn") */}
          <button
            type="button"
            id="chat-top-right-templates-btn"
            aria-label="Prompt Templates"
            title="Prompt Templates (Modular directives)"
            onClick={() => setIsTemplateDrawerOpen(true)}
            className={`relative w-9 h-9 min-w-[36px] min-h-[36px] sm:w-10 sm:h-10 sm:min-w-[40px] sm:min-h-[40px] flex items-center justify-center p-0 border-0 bg-transparent transition-colors cursor-pointer rounded-xl focus:outline-none active:scale-95 ${
              selectedTemplateIds.length > 0
                ? "text-primary hover:text-primary/90"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="w-4 h-4" />
            {selectedTemplateIds.length > 0 && (
              <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-primary text-primary-foreground text-[8px] font-mono font-bold flex items-center justify-center shadow-xs">
                {selectedTemplateIds.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Anchored History & New Chat Popover Menu */}
      {isHistoryOpen && (
        <div
          ref={historyPopoverRef}
          id="chat-window-history-popover"
          className="absolute right-2 top-11 z-40 w-72 sm:w-80 max-w-[calc(100vw-24px)] rounded-2xl bg-popover border border-border shadow-2xl overflow-hidden backdrop-blur-md"
        >
          {/* 1. Primary Action: Start New Chat */}
          <button
            type="button"
            id="chat-popover-new-chat-btn"
            onClick={handleStartNewChat}
            className="w-full p-3 flex items-center gap-2.5 text-left text-xs font-semibold text-foreground hover:bg-muted active:bg-muted/80 transition-colors group border-0 bg-transparent cursor-pointer"
          >
            <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary/20">
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="leading-none text-foreground">Start New Chat</div>
              <div className="text-[10px] text-muted-foreground font-normal mt-0.5">Fresh conversation</div>
            </div>
          </button>

          <div className="border-t border-border" />

          {/* 2. Historical Chats Header */}
          <div className="px-3 py-2 bg-muted/50 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span>Recent Chats</span>
            </span>
            <span className="px-1.5 py-0.5 rounded-full bg-muted text-[10px] font-mono text-muted-foreground">
              {historySessions.length}
            </span>
          </div>

          {/* 3. Historical Chats Scrollable List */}
          <div className="max-h-60 sm:max-h-72 overflow-y-auto divide-y divide-border">
            {historySessions.length === 0 ? (
              <div className="p-4 text-center">
                <Clock className="w-5 h-5 text-muted-foreground mx-auto mb-1.5" />
                <p className="text-xs text-muted-foreground font-medium">No previous chats</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Send a message to save your conversation history.
                </p>
              </div>
            ) : (
              historySessions.map((session) => {
                const isActive = session.id === currentSessionId;
                return (
                  <div
                    key={session.id}
                    className={`flex items-center justify-between gap-2 p-2.5 transition-colors group ${
                      isActive ? "bg-primary/10" : "hover:bg-muted"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectSession(session)}
                      className="flex-1 min-w-0 text-left flex items-start gap-2 border-0 bg-transparent cursor-pointer p-0"
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
                            isActive ? "text-primary" : "text-foreground group-hover:text-foreground"
                          }`}
                        >
                          {session.title || "Untitled Conversation"}
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          {isActive && (
                            <span className="text-[9px] px-1 py-0.2 rounded font-mono text-primary bg-primary/10 border border-primary/20">
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
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors shrink-0 opacity-70 group-hover:opacity-100 border-0 bg-transparent cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {messages.length === 0 ? (
          isJulesMode ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4 max-w-md mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-muted/40 border border-border flex items-center justify-center mb-3">
                <Bot className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                Google Jules Autonomous Agent
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Autonomous task execution on GitHub repositories. Jules explores the codebase, builds a plan, implements code changes, and creates a pull request.
              </p>

              {activeJulesSession ? (
                <div className="w-full mb-3.5 p-3 rounded-xl bg-muted/40 border border-border text-left flex items-center justify-between">
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-primary">
                      Active Repository
                    </span>
                    <div className="text-xs font-semibold text-foreground font-mono truncate">
                      {activeJulesSession.repository}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Base branch: <span className="font-mono text-foreground">{activeJulesSession.branch}</span>
                    </div>
                  </div>
                  {onOpenJulesSessions && (
                    <button
                      type="button"
                      onClick={onOpenJulesSessions}
                      className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-xs font-medium border border-border transition-colors shrink-0 cursor-pointer"
                    >
                      Change
                    </button>
                  )}
                </div>
              ) : (
                <div className="w-full mb-3.5 p-3.5 rounded-2xl bg-card border border-border text-left shadow-sm">
                  <div className="flex items-center gap-2 mb-1.5">
                    <FolderGit2 className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-xs text-foreground">
                      Select or create a Jules task
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-3">
                    Choose which authorized GitHub repository Jules should clone, plan, and commit changes to.
                  </p>
                  {onOpenJulesSessions && (
                    <button
                      type="button"
                      onClick={onOpenJulesSessions}
                      className="w-full py-2 px-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-sm active:scale-95 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Choose Repository & Task</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 gap-2 w-full text-left">
                {julesStarterChips.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSendMessage(chip)}
                    className="p-2.5 rounded-xl bg-card hover:bg-muted border border-border text-xs text-muted-foreground hover:text-foreground transition-colors text-left flex items-center justify-between group cursor-pointer"
                  >
                    <span className="truncate">{chip}</span>
                    <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                      →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-4 max-w-md mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-muted/40 border border-border flex items-center justify-center mb-3">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                Google AI Studio Playground
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Engineered with Gemini 3.8 Flash for fast mobile prototyping, testing, and Android app integration.
              </p>

              {/* Authentication prompt card if not authenticated */}
              {!hasApiKey ? (
                <div className="w-full mb-3.5 p-3.5 rounded-2xl bg-card border border-border text-left shadow-sm">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-5 h-5 rounded-full bg-card flex items-center justify-center p-0.5 shrink-0 border border-border">
                      <GoogleIcon className="w-full h-full" />
                    </div>
                    <span className="font-semibold text-xs text-foreground">
                      Sign in with Google AI Studio
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
                    Connect your Google account to sync live models, prompts, and run code directly from your AI Studio environment.
                  </p>
                  {onOpenAuth && (
                    <button
                      type="button"
                      onClick={onOpenAuth}
                      className="w-full py-2 px-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-sm active:scale-95 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Connect Google Account</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ) : googleUser ? (
                <div className="w-full mb-3 p-2.5 rounded-xl bg-card border border-border flex items-center justify-between gap-2 text-left">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
                      Live
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate">
                      Synced: <span className="font-semibold text-foreground">{googleUser.email}</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="text-[10px] text-primary hover:text-primary/80 font-medium shrink-0 underline cursor-pointer"
                  >
                    Manage
                  </button>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-2 w-full text-left">
                {starterChips.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSendMessage(chip)}
                    className="p-2.5 rounded-xl bg-card hover:bg-muted border border-border text-xs text-muted-foreground hover:text-foreground transition-colors text-left flex items-center justify-between group cursor-pointer"
                  >
                    <span className="truncate">{chip}</span>
                    <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                      →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === "user" ? "items-end" : "items-start"
              }`}
            >
              {/* Sender label */}
              <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-muted-foreground">
                {msg.role === "user" ? (
                  <span className="font-medium text-foreground">User</span>
                ) : msg.julesActivity ? (
                  <div className="flex items-center gap-1 text-foreground">
                    <Bot className="w-3.5 h-3.5 text-primary" />
                    <span className="font-medium">Jules Coding Agent</span>
                    {activeJulesSession && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        • {activeJulesSession.repository}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-primary" />
                    <span className="font-medium text-foreground">Gemini</span>
                    {msg.tokenCount && (
                      <span className="text-[10px] text-muted-foreground">
                        • {msg.tokenCount} tokens
                      </span>
                    )}
                    {msg.durationMs && (
                      <span className="text-[10px] text-muted-foreground">
                        • {(msg.durationMs / 1000).toFixed(2)}s
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Message bubble */}
              <div
                className={`max-w-[95%] sm:max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-none shadow-xs"
                    : "bg-card text-card-foreground border border-border rounded-tl-none shadow-xs"
                }`}
              >
                {/* Images preview if present */}
                {msg.images && msg.images.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {msg.images.map((img) => (
                      <div
                        key={img.id}
                        className="relative rounded-lg overflow-hidden border border-border max-w-[160px] max-h-[160px]"
                      >
                        <img
                          src={img.previewUrl}
                          alt={img.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Jules Activity Card if present */}
                {msg.julesActivity ? (
                  <div className="w-full">
                    {msg.text && (
                      <p className="text-xs text-foreground mb-2 font-medium">
                        {msg.text}
                      </p>
                    )}
                    <JulesActivityCard
                      activity={msg.julesActivity}
                      onApprovePlan={onApproveJulesPlan}
                      onRejectPlan={onRejectJulesPlan}
                      isApproving={isApprovingJulesPlan}
                    />
                  </div>
                ) : msg.role === "model" ? (
                  <div className="prose dark:prose-invert prose-xs sm:prose-sm max-w-none break-words [&>pre]:bg-muted [&>pre]:p-3 [&>pre]:rounded-xl [&>pre]:border [&>pre]:border-border [&>pre]:overflow-x-auto [&>code]:text-primary [&>code]:bg-muted [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4">
                    <Markdown>{msg.text || (msg.isStreaming ? "Thinking..." : "")}</Markdown>
                    {msg.isStreaming && (
                      <span className="inline-block w-1.5 h-3.5 bg-primary ml-1 animate-pulse align-middle" />
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {/* Question 4 Decision (Option B): Structured Provenance Display */}
                    {msg.templateIds && msg.templateIds.length > 0 && (
                      <div className="pb-1.5 border-b border-primary-foreground/20 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-1.5 flex-wrap">
                          <div className="flex items-center gap-1 flex-wrap">
                            {msg.templateIds.map((tplId, idx) => {
                              const tpl = getTemplateById(tplId);
                              return (
                                <span
                                  key={`${msg.id}-${tplId}-${idx}`}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/20 text-[10px] font-medium tracking-tight text-primary-foreground border border-primary-foreground/20"
                                >
                                  <span className="font-mono text-[9px] opacity-75 font-bold">
                                    #{idx + 1}
                                  </span>
                                  <span>{tpl ? tpl.title : tplId}</span>
                                </span>
                              );
                            })}
                          </div>
                          <button
                            type="button"
                            id={`toggle-composite-prompt-${msg.id}`}
                            onClick={() => toggleMessageExpanded(msg.id)}
                            className="text-[10px] text-primary-foreground/90 hover:text-white underline font-medium cursor-pointer"
                          >
                            {expandedMessageIds.has(msg.id)
                              ? "Hide full prompt"
                              : "Inspect full prompt"}
                          </button>
                        </div>

                        {expandedMessageIds.has(msg.id) && (
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
                  <div className="mt-2 p-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                    {msg.error}
                  </div>
                )}
              </div>

              {/* Action buttons on model responses */}
              {msg.role === "model" && !msg.isStreaming && (
                <div className="flex items-center gap-1 mt-1 px-1">
                  <button
                    onClick={() => handleCopy(msg.id, msg.text)}
                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                    title="Copy response"
                  >
                    {copiedId === msg.id ? (
                      <Check className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    onClick={onRegenerate}
                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                    title="Regenerate"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (isSpeaking) {
                        stopAllPlayback();
                      } else {
                        handleToggleSpeech(msg.text);
                      }
                    }}
                    className={`p-1 rounded transition-colors flex items-center gap-1 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer ${
                      isSpeaking ? "text-primary bg-primary/10" : ""
                    }`}
                    title={isSpeaking ? "Stop speech" : "Read aloud response"}
                    aria-label={isSpeaking ? "Stop speech" : "Read aloud response"}
                  >
                    {isSpeaking ? (
                      <Square className="w-3.5 h-3.5 fill-primary text-primary" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Attachment Preview Drawer */}
      {attachments.length > 0 && (
        <div className="px-3 py-1.5 bg-card border-t border-border flex items-center gap-2 overflow-x-auto">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="relative flex items-center gap-2 bg-muted border border-border rounded-lg p-1.5 shrink-0"
            >
              <img
                src={att.previewUrl}
                alt={att.name}
                className="w-8 h-8 rounded object-cover"
              />
              <div className="text-[10px] text-foreground truncate max-w-[90px]">
                {att.name}
              </div>
              <button
                onClick={() => removeAttachment(att.id)}
                className="p-0.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Selected Prompt Templates Tray (Strict FIFO Order with #1, #2 numbered pills) */}
      {selectedTemplateIds.length > 0 && (
        <div
          id="chat-selected-templates-tray"
          className="px-3 py-1.5 bg-card border-t border-border flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0"
        >
          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mr-1 shrink-0">
            <Layers className="w-3 h-3 text-primary" />
            <span className="hidden xs:inline">Directives:</span>
          </div>

          {selectedTemplateObjects.map((template, idx) => (
            <div
              key={template.id}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/10 border border-primary/20 text-foreground text-xs shrink-0 animate-in fade-in zoom-in-95"
            >
              <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                #{idx + 1}
              </span>
              <span className="font-medium truncate max-w-[120px] sm:max-w-[160px]">
                {template.title}
              </span>
              <button
                type="button"
                onClick={() => handleRemoveTemplate(template.id)}
                className="p-0.5 rounded-full hover:bg-destructive/20 text-muted-foreground hover:text-destructive cursor-pointer shrink-0 transition-colors"
                title={`Dismiss #${idx + 1} ${template.title} (Dismiss to reorder)`}
                aria-label={`Remove template ${template.title}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}

          <button
            type="button"
            id="tray-add-template-btn"
            onClick={() => setIsTemplateDrawerOpen(true)}
            className="h-6 px-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground border border-border text-[11px] font-medium flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
            title="Add or configure templates"
          >
            <Plus className="w-3 h-3" />
            <span>Add</span>
          </button>

          {selectedTemplateIds.length > 1 && (
            <button
              type="button"
              id="tray-clear-all-btn"
              onClick={handleClearAllTemplates}
              className="text-[11px] text-muted-foreground hover:text-destructive px-1 shrink-0 transition-colors cursor-pointer"
              title="Clear all selected templates"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Input Dock (Android Mobile Floating Keyboard Clearance) */}
      <div className="p-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] bg-card border-t border-border">
        <div className="flex items-end gap-1.5 bg-background rounded-2xl border border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/50 p-1.5 transition-colors">
          {/* Media Attach button */}
          <button
            type="button"
            id="chat-attach-btn"
            disabled={isOptimizingImage}
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
            title={isOptimizingImage ? "Compressing image..." : "Attach image or screenshot"}
          >
            {isOptimizingImage ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <ImageIcon className="w-4 h-4" />
            )}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            multiple
            className="hidden"
          />

          {/* Prompt textarea */}
          <textarea
            ref={textareaRef}
            id="chat-prompt-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isJulesMode
                ? activeJulesSession
                  ? `Describe a task or fix for Jules on ${activeJulesSession.repository}...`
                  : "Select a repository to dispatch a Jules task..."
                : "Type prompt or test instructions..."
            }
            rows={1}
            className="flex-1 bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none py-1.5 px-1 max-h-28"
          />

          {/* Prompt Microphone button inside dock */}
          <button
            type="button"
            id="chat-mic-btn"
            onClick={handleActivatePromptSpeech}
            className={`p-2 rounded-xl transition-colors shrink-0 cursor-pointer ${
              isListening
                ? "bg-destructive text-destructive-foreground animate-pulse"
                : "text-muted-foreground hover:text-primary hover:bg-muted"
            }`}
            title={
              isListening
                ? "Stop speech-to-text"
                : "Activate keyboard mic / speech-to-text"
            }
            aria-label="Activate keyboard mic or speech-to-text"
          >
            <Mic className="w-4 h-4" />
          </button>

          {/* Clear chat button if messages exist and input is empty */}
          {messages.length > 0 && !inputText && (
            <button
              type="button"
              id="chat-clear-btn"
              onClick={handleClearChat}
              className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-muted transition-colors shrink-0 cursor-pointer"
              title="Reset prompt"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* Send / Stop button */}
          {isGenerating ? (
            <button
              type="button"
              id="chat-stop-btn"
              onClick={onStopGeneration}
              className="p-2.5 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground transition-colors shrink-0 shadow-xs cursor-pointer"
              title="Stop generation"
            >
              <Square className="w-4 h-4 fill-destructive-foreground" />
            </button>
          ) : (
            <button
              type="button"
              id="chat-send-btn"
              onClick={handleSend}
              disabled={
                !inputText.trim() && attachments.length === 0 && selectedTemplateIds.length === 0
              }
              className={`p-2.5 rounded-xl transition-colors shrink-0 flex items-center gap-1 font-semibold ${
                inputText.trim() || attachments.length > 0 || selectedTemplateIds.length > 0
                  ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs active:scale-95 cursor-pointer"
                  : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
              }`}
              title={isJulesMode ? "Dispatch Jules task" : "Run prompt"}
            >
              {isJulesMode ? <Bot className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Full-Screen Mobile Drawer for Prompt Templates (Selection, Filtering, Authoring, Preview) */}
      <PromptTemplateDrawer
        isOpen={isTemplateDrawerOpen}
        onClose={() => setIsTemplateDrawerOpen(false)}
        selectedTemplateIds={selectedTemplateIds}
        onToggleTemplate={handleToggleTemplate}
        onRemoveTemplate={handleRemoveTemplate}
        onClearAllTemplates={handleClearAllTemplates}
        draftUserText={inputText}
      />
    </div>
  );
};

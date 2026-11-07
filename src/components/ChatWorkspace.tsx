import { useWorkspace } from "../contexts/WorkspaceContext";
import { ChatHistoryPopover } from "./ChatHistoryPopover";
import { useBatchSelection } from "../hooks/useBatchSelection";
import React, { useState, useRef, useEffect, useMemo , useCallback} from "react";
import {
  Send,
  Square,
  Image as ImageIcon,
  X,
  Copy,
  Check,
  RotateCcw,
  Loader2,
  ArrowRight,
  Volume2,
  Plus,
  MessageSquare,
  Bot,
  FolderGit2,
  Layers,
  Mic,
  Maximize2,
  Minimize2,
} from "lucide-react";
import Markdown from "react-markdown";
import { motion, AnimatePresence } from "motion/react";
import { BatchDeleteOverlay } from "./BatchDeleteOverlay";
import {
  ChatMessage,
  MessageAttachment,
  ChatSession,
  JulesSession,
} from "../types";
import { extractSpokenText } from "../utils/speechExtractor";
import {
  SpeechSettings,
} from "../services/speechVoices";
import { ISentenceSpeechQueue } from "../services/sentenceSpeechQueue";
import { useSpeechToText } from "../hooks/useSpeechToText";
import { useStore } from "../hooks/useStore";
import { JulesActivityCard } from "./JulesActivityCard";
import { GoogleIcon } from "./GoogleIcon";
import { PromptTemplateDrawer } from "./PromptTemplateDrawer";
import { useServices } from "../services/ServiceContext";
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
  const {
    config: _config,
    onUpdateSystemInstruction: _onUpdateSystemInstruction,
    onOpenParameters: _onOpenParameters,
    hasApiKey,
    onOpenAuth,
    onOpenSettings,
    activeProjectId,
    onOpenBottomNav: _onOpenBottomNav,
    isTemplateDrawerOpen: propIsTemplateDrawerOpen,
    onOpenTemplateDrawer: propOnOpenTemplateDrawer,
    onCloseTemplateDrawer: propOnCloseTemplateDrawer,
    selectedTemplateIds: propSelectedTemplateIds,
    onToggleTemplate: propOnToggleTemplate,
    onRemoveTemplate: propOnRemoveTemplate,
    onClearAllTemplates: propOnClearAllTemplates,
    speechSettings: propSpeechSettings,
    onSaveSpeechSettings,
  } = useWorkspace();
  const googleUser: { email: string } | null = null;

  const [inputText, setInputText] = useState("");
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [isOptimizingImage, setIsOptimizingImage] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { speechVoicesService, logger, clipboardService, platformService, createSentenceSpeechQueue } = useServices();

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isBufferingAudio, setIsBufferingAudio] = useState(false);
  const [localSpeechSettings] = useState<SpeechSettings>(() =>
    speechVoicesService.loadSpeechSettings()
  );

  // History & New Chat Popover State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const { julesStorageService, chatHistoryService, imageCompressor } = useServices();
  const rawChatSessions = useStore(chatHistoryService.getChatCollection(activeProjectId));
  const julesSessionsState = useStore(julesStorageService.julesSessionsManager);

  const historySessions = useMemo<ChatSession[]>(() => {
    if (isJulesMode) {
      return julesSessionsState.items.map((js) => ({
        id: js.id,
        title: js.title || js.repository,
        messages: js.messages || [],
        createdAt: js.createdAt,
        updatedAt: js.updatedAt,
        model: "Jules Agent",
      }));
    }
    return [...rawChatSessions].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [isJulesMode, julesSessionsState.items, rawChatSessions]);

  const validHistorySessions = useMemo(() => {
    return historySessions.filter((s) => !chatHistoryService.isMockChatSession(s));
  }, [historySessions, chatHistoryService]);

  const {
    selectedIds: selectedHistoryIds,
    toggleSelection: toggleHistorySelectionRaw,
    toggleSelectAll: toggleSelectAllHistoryRaw,
    getSelectionState: getHistorySelectionState,
    clearSelection: clearHistorySelection,
  } = useBatchSelection({
    items: validHistorySessions,
    getItemId: (s) => s.id,
    isActive: isHistoryOpen,
    enableShortcuts: true
  });

  const handleBulkDeleteHistory = () => {
    const ids = Array.from(selectedHistoryIds);
    chatHistoryService.bulkDeleteChatSessions(ids, activeProjectId || "");

    // Check if current session was deleted
    if (new Set(ids).has(currentSessionId!)) {
      if (onNewChat) {
        onNewChat();
      }
    }
    clearHistorySelection();
  };

  const toggleHistorySelection = useCallback((id: string, e: React.MouseEvent | React.KeyboardEvent, index: number) => {
    toggleHistorySelectionRaw(id, e, index, validHistorySessions.map(s => s.id));
  }, [toggleHistorySelectionRaw, validHistorySessions]);

  const toggleSelectAllHistory = useCallback(() => {
    toggleSelectAllHistoryRaw(validHistorySessions.map(s => s.id));
  }, [toggleSelectAllHistoryRaw, validHistorySessions]);

  // Clear selection on popover close
  useEffect(() => {
    if (!isHistoryOpen) {
      clearHistorySelection();
    }
  }, [isHistoryOpen, clearHistorySelection]);

  const historyPopoverRef = useRef<HTMLDivElement>(null);
  const historyButtonRef = useRef<HTMLButtonElement>(null);

  // Filter out any mock/test sessions to ensure purely authentic history

  // Prompt Templates State (Strict FIFO selection order)
  const [internalSelectedTemplateIds, setInternalSelectedTemplateIds] = useState<string[]>([]);
  const [internalIsTemplateDrawerOpen, setInternalIsTemplateDrawerOpen] = useState(false);

  const selectedTemplateIds =
    propSelectedTemplateIds !== undefined
      ? propSelectedTemplateIds
      : internalSelectedTemplateIds;
  const isTemplateDrawerOpen =
    propIsTemplateDrawerOpen !== undefined
      ? propIsTemplateDrawerOpen
      : internalIsTemplateDrawerOpen;

  const { promptTemplateService } = useServices();
  const [expandedMessageIds, setExpandedMessageIds] = useState<Set<string>>(new Set());
  const [allTemplatesList, setAllTemplatesList] = useState<PromptTemplate[]>(() => promptTemplateService.getAllTemplates());

  // Refresh templates list when drawer toggles
  useEffect(() => {
    setAllTemplatesList(promptTemplateService.getAllTemplates());
  }, [isTemplateDrawerOpen, promptTemplateService]);

  const handleToggleTemplate = (templateId: string) => {
    if (propOnToggleTemplate) {
      propOnToggleTemplate(templateId);
    } else {
      setInternalSelectedTemplateIds((prev) =>
        prev.includes(templateId)
          ? prev.filter((id) => id !== templateId)
          : [...prev, templateId]
      );
    }
  };

  const handleRemoveTemplate = (templateId: string) => {
    if (propOnRemoveTemplate) {
      propOnRemoveTemplate(templateId);
    } else {
      setInternalSelectedTemplateIds((prev) =>
        prev.filter((id) => id !== templateId)
      );
    }
  };

  const handleClearAllTemplates = () => {
    if (propOnClearAllTemplates) {
      propOnClearAllTemplates();
    } else {
      setInternalSelectedTemplateIds([]);
    }
  };

  const handleOpenTemplateDrawer = () => {
    if (propOnOpenTemplateDrawer) {
      propOnOpenTemplateDrawer();
    } else {
      setInternalIsTemplateDrawerOpen(true);
    }
  };

  const handleCloseTemplateDrawer = () => {
    if (propOnCloseTemplateDrawer) {
      propOnCloseTemplateDrawer();
    } else {
      setInternalIsTemplateDrawerOpen(false);
    }
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
      if (event.key === "Escape" && selectedHistoryIds.size === 0) {
        setIsHistoryOpen(false);
        historyButtonRef.current?.focus();
      }
    };

    let removeMouse: (() => void) | null = null;
    let removeTouch: (() => void) | null = null;
    let removeKey: (() => void) | null = null;

    if (isHistoryOpen) {
      removeMouse = platformService.addDocumentListener("mousedown", handleClickOutside);
      removeTouch = platformService.addDocumentListener("touchstart", handleClickOutside as EventListener);
      removeKey = platformService.addDocumentListener("keydown", handleKeyDown);
    }

    return () => {
      removeMouse?.();
      removeTouch?.();
      removeKey?.();
    };
  }, [isHistoryOpen]);

  const speechSettings = propSpeechSettings || localSpeechSettings;

  // Conversational Two-Way Voice state machine
  const [isVoiceModeActive, setIsVoiceModeActive] = useState<boolean>(() => {
    return Boolean(speechSettings.handsFreeMode);
  });
  const [voiceState, setVoiceState] = useState<"idle" | "listening" | "processing" | "speaking">("idle");
  const isVoiceModeActiveRef = useRef<boolean>(isVoiceModeActive);
  isVoiceModeActiveRef.current = isVoiceModeActive;

  const sentenceQueueRef = useRef<ISentenceSpeechQueue | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const touchIsDraggingRef = useRef<boolean>(false);

  // Mobile virtual keyboard focus & visibility state
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false);

  // Expanded card height (250% of 80px = 200px) toggled via the borderless transparent button
  const [isInputHeightExpanded, setIsInputHeightExpanded] = useState<boolean>(false);

  const hasDraftContent = Boolean(
    inputText.trim() || attachments.length > 0 || selectedTemplateIds.length > 0
  );
  // Input expands to 100% when focused or has draft content
  const isInputExpanded = isInputFocused || hasDraftContent;

  const speechBaseTextRef = useRef<string>("");

  // Dismiss / hide the mobile soft keyboard safely across platforms
  const hideKeyboard = () => {
    if (platformService.isBrowserEnv() && "virtualKeyboard" in platformService.getNavigator()!) {
      try {
        (platformService.getNavigator()! as { virtualKeyboard?: { hide?: () => void } }).virtualKeyboard?.hide?.();
      } catch {
        // ignore
      }
    }
    if (textareaRef.current && platformService.getDocument()!.activeElement === textareaRef.current) {
      textareaRef.current.blur();
    } else if (platformService.getDocument()!.activeElement instanceof HTMLElement) {
      (platformService.getDocument()!.activeElement as HTMLElement)?.blur();
    }
    setIsInputFocused(false);
  };

  const {
    isListening,
    isAudioDetected,
    transcript: _speechTranscript,
    silenceCountdownMs,
    error: speechError,
    startListening,
    stopListening,
    clearSilenceCountdown,
    clearTranscript,
  } = useSpeechToText({
    continuous: true,
    continuousListening: isVoiceModeActive,
    autoSendOnSilence: isVoiceModeActive,
    silenceTimeoutMs: speechSettings.silenceTimeoutMs || 1500,
    isMuted: isSpeaking,
    onTranscript: (spokenChunk) => {
      const base = speechBaseTextRef.current;
      const sep = base && !base.endsWith(" ") ? " " : "";
      setInputText(base ? `${base}${sep}${spokenChunk}` : spokenChunk);
    },
    onSilenceAutoSend: (spokenText) => {
      if (!spokenText.trim()) return;
      if (isGenerating) {
        // Assistant is already processing: keep listening without dropping input
        startListening(undefined, true);
        return;
      }

      // Guard against offline or missing API key so voice state does not hang indefinitely
      if (platformService.isBrowserEnv() && !platformService.getNavigator()!.onLine) {
        setVoiceState("listening");
        startListening(undefined, true);
        return;
      }
      if (!hasApiKey) {
        onOpenSettings?.("account");
        setVoiceState("listening");
        startListening(undefined, true);
        return;
      }

      setVoiceState("processing");
      speechBaseTextRef.current = "";
      clearTranscript();
      setInputText("");

      let textToSend = spokenText.trim();
      let appliedTemplateIds: string[] | undefined = undefined;
      let userRawText: string | undefined = undefined;

      if (selectedTemplateIds.length > 0) {
        const composed = promptTemplateService.composePrompt(selectedTemplateIds, spokenText.trim());
        textToSend = composed.combinedText;
        appliedTemplateIds = composed.templateIds;
        userRawText = composed.userText;
      }

      onSendMessage(
        textToSend,
        attachments.length > 0 ? attachments : undefined,
        appliedTemplateIds,
        userRawText || spokenText.trim()
      );
      setAttachments([]);
      handleClearAllTemplates();
    },
  });

  // Keep conversational voice state synced with mic listening
  useEffect(() => {
    if (isListening && !isSpeaking) {
      setVoiceState("listening");
    } else if (!isListening && voiceState === "listening") {
      if (!isGenerating && !isSpeaking) {
        setVoiceState("idle");
      }
    }
  }, [isListening, isSpeaking, isGenerating, voiceState]);

  // Sync handsFreeMode from speechSettings prop when toggled in Settings modal
  useEffect(() => {
    if (speechSettings.handsFreeMode !== isVoiceModeActive) {
      setIsVoiceModeActive(speechSettings.handsFreeMode);
      if (speechSettings.handsFreeMode) {
        startListening(undefined, true);
        setVoiceState("listening");
      } else {
        stopListening();
        stopAllPlayback();
        setVoiceState("idle");
      }
    }
  }, [speechSettings.handsFreeMode]);

  const handleToggleVoiceMode = () => {
    const next = !isVoiceModeActive;
    setIsVoiceModeActive(next);
    setIsInputHeightExpanded(false);

    if (onSaveSpeechSettings) {
      onSaveSpeechSettings({ ...speechSettings, handsFreeMode: next });
    }

    if (next) {
      // ENTERING HANDS-FREE VOICE MODE
      stopAllPlayback();
      // Append mode: preserve existing text input as base buffer so speech appends
      speechBaseTextRef.current = inputText.trim();
      startListening(undefined, true);
      setVoiceState("listening");
    } else {
      // EXITING HANDS-FREE VOICE MODE
      stopListening();
      stopAllPlayback();
      clearSilenceCountdown();
      setVoiceState("idle");

      // Auto-expand into 100% text input interface if user spoke or has draft text
      if (inputText.trim()) {
        setIsInputFocused(true);
        platformService.setTimeout(() => {
          textareaRef.current?.focus();
          const len = textareaRef.current?.value.length || 0;
          textareaRef.current?.setSelectionRange(len, len);
        }, 50);
      }
    }
  };

  const handleInterrupt = () => {
    // 1. Immediately cancel the ongoing model stream if active
    if (isGenerating && onStopGeneration) {
      onStopGeneration();
    }
    // 2. Halt all speech playback and audio buffers
    stopAllPlayback();
    // 3. Immediately reopen microphone for continuous conversational turn
    if (isVoiceModeActive) {
      speechBaseTextRef.current = "";
      clearTranscript();
      setInputText("");
      startListening(undefined, true);
      setVoiceState("listening");
    } else {
      setVoiceState("idle");
    }
  };

  const stopAllPlayback = () => {
    if (sentenceQueueRef.current) {
      sentenceQueueRef.current.cancel();
      sentenceQueueRef.current = null;
    }
    if (activeUtteranceRef.current) {
      activeUtteranceRef.current = null;
    }
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    const synth = platformService.getSpeechSynthesis();
    if (synth) {
      try {
        synth.cancel();
      } catch {
        // Safe ignore
      }
    }
    setIsSpeaking(false);
    setIsBufferingAudio(false);
  };

  // Scroll anchoring: Keep latest message pinned on messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  // visualViewport scroll anchoring: dynamically re-anchor messages on mobile keyboard resize
  useEffect(() => {
    const vvInit = platformService.getVisualViewport();
    let previousHeight = vvInit ? vvInit.height : 0;

    const handleViewportResize = () => {
      const vv = platformService.getVisualViewport();
      if (!vv) return;
      // If viewport shrunk significantly (soft keyboard appeared) or input is focused
      if (vv.height < previousHeight || isInputFocused) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }
      previousHeight = vv.height;
    };

    const handleViewportScroll = () => {
      if (isInputFocused) {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
      }
    };

    // Safari visualViewport standard event usage
    const handleResizeWrapper = () => handleViewportResize();
    const handleScrollWrapper = () => handleViewportScroll();

    const removeResize = platformService.addVisualViewportListener("resize", handleResizeWrapper);
    const removeScroll = platformService.addVisualViewportListener("scroll", handleScrollWrapper);

    return () => {
      removeResize();
      removeScroll();
    };
  }, [isInputFocused, platformService]);

  // Adjust textarea height: limit multi-line auto-expansion to max 3 lines on mobile (~72px)
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const win = platformService.getWindow();
      const isMobile = win ? win.innerWidth < 640 : false;
      const maxHeight = isMobile ? 72 : 112;
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, maxHeight)}px`;
    }
  }, [inputText]);

  // Cancel ongoing speech synthesis or audio playback if a new generation begins
  useEffect(() => {
    if (isGenerating) {
      stopAllPlayback();
      setVoiceState("processing");
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

  // Streaming sentence-pipelined speech playback
  const streamingModelMessage = useMemo(() => {
    return messages.find((m) => m.role === "model" && m.isStreaming);
  }, [messages]);

  const prevStreamingTextRef = useRef<string>("");

  useEffect(() => {
    if (streamingModelMessage && streamingModelMessage.text) {
      const currentText = streamingModelMessage.text;
      const shouldStreamSpeech =
        (isVoiceModeActive || speechSettings.autoReadResponses) &&
        speechSettings.sentenceStreaming &&
        speechSettings.engine === "device"; // Device speech is 100% free with 0ms network latency

      if (shouldStreamSpeech) {
        if (!sentenceQueueRef.current) {
          sentenceQueueRef.current = createSentenceSpeechQueue({
            speechSettings,
            speechVoicesService,
            onSentenceStart: () => {
              setIsSpeaking(true);
              setVoiceState("speaking");
            },
            onAllSentencesCompleted: () => {
              setIsSpeaking(false);
              sentenceQueueRef.current = null;
              if (isVoiceModeActiveRef.current) {
                // Wait 350ms acoustic grace period to prevent microphone echo
                platformService.setTimeout(() => {
                  if (isVoiceModeActiveRef.current) {
                    speechBaseTextRef.current = "";
                    clearTranscript();
                    setInputText("");
                    startListening(undefined, true);
                    setVoiceState("listening");
                  }
                }, 350);
              } else {
                setVoiceState("idle");
              }
            },
            onInterrupted: () => {
              setIsSpeaking(false);
              sentenceQueueRef.current = null;
            },
          });
        }
        sentenceQueueRef.current.feed(currentText, true);
        prevStreamingTextRef.current = currentText;
      }
    }
  }, [streamingModelMessage?.text, isVoiceModeActive, speechSettings, startListening]);

  // When generation finishes, finalize sentence speech queue or trigger non-streaming speech
  useEffect(() => {
    if (!isGenerating && prevStreamingTextRef.current) {
      if (sentenceQueueRef.current) {
        sentenceQueueRef.current.finalize();
      }
      prevStreamingTextRef.current = "";
    } else if (!isGenerating && (isVoiceModeActive || speechSettings.autoReadResponses)) {
      // If sentence streaming was disabled or engine is gemini, read full completed message
      if (!speechSettings.sentenceStreaming || speechSettings.engine === "gemini") {
        if (lastModelMessage?.text && !isSpeaking && !isBufferingAudio) {
          void handleToggleSpeech(lastModelMessage.text);
        }
      } else if (isVoiceModeActive && !sentenceQueueRef.current && !isSpeaking && !isBufferingAudio) {
        // Recover to listening state if generation finished without speaking (e.g. error, code-only, or stopped)
        platformService.setTimeout(() => {
          if (isVoiceModeActiveRef.current && !sentenceQueueRef.current && !isSpeaking) {
            speechBaseTextRef.current = "";
            clearTranscript();
            setInputText("");
            startListening(undefined, true);
            setVoiceState("listening");
          }
        }, 350);
      }
    } else if (!isGenerating && isVoiceModeActive && voiceState === "processing") {
      // Fallback recovery if voiceState is stuck on processing
      platformService.setTimeout(() => {
        if (isVoiceModeActiveRef.current && !sentenceQueueRef.current && !isSpeaking) {
          speechBaseTextRef.current = "";
          clearTranscript();
          setInputText("");
          startListening(undefined, true);
          setVoiceState("listening");
        }
      }, 350);
    }
  }, [isGenerating]);

  // Helper for on-device speech synthesis fallback
  const fallbackToDeviceSpeech = (textToSpeak: string) => {
    const synth = platformService.getSpeechSynthesis();
    if (!synth) {
      setIsSpeaking(false);
      setIsBufferingAudio(false);
      return;
    }

    synth.cancel();
    const utterance = platformService.createSpeechSynthesisUtterance(textToSpeak);
    if (!utterance) return;
    activeUtteranceRef.current = utterance;
    utterance.rate = speechSettings.playbackRate;

    // Pick chosen device voice or best natural voice
    const rawVoices = synth.getVoices();
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
      setVoiceState("speaking");
    };

    utterance.onend = () => {
      activeUtteranceRef.current = null;
      setIsSpeaking(false);
      if (isVoiceModeActiveRef.current) {
        // Acoustic echo safety: delay 350ms before opening mic
        platformService.setTimeout(() => {
          if (isVoiceModeActiveRef.current) {
            speechBaseTextRef.current = "";
            clearTranscript();
            setInputText("");
            startListening(undefined, true);
            setVoiceState("listening");
          }
        }, 350);
      } else {
        setVoiceState("idle");
      }
    };

    utterance.onerror = () => {
      activeUtteranceRef.current = null;
      setIsSpeaking(false);
      setIsBufferingAudio(false);
      if (isVoiceModeActiveRef.current) {
        platformService.setTimeout(() => {
          if (isVoiceModeActiveRef.current) {
            speechBaseTextRef.current = "";
            clearTranscript();
            setInputText("");
            startListening(undefined, true);
            setVoiceState("listening");
          }
        }, 350);
      } else {
        setVoiceState("idle");
      }
    };

    synth.speak(utterance);
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
        const data = await speechVoicesService.fetchTTSAudioUrl(contentToSpeak, speechSettings.geminiVoice);

        if (!data.audioUrl) {
          throw new Error("No audio payload returned from Gemini TTS");
        }

        const audio = platformService.createAudio(data.audioUrl) as HTMLAudioElement;
        audio.playbackRate = speechSettings.playbackRate;
        activeAudioRef.current = audio;

        audio.onplay = () => {
          setIsBufferingAudio(false);
          setIsSpeaking(true);
          setVoiceState("speaking");
        };

        audio.onended = () => {
          setIsSpeaking(false);
          activeAudioRef.current = null;
          if (isVoiceModeActiveRef.current) {
            platformService.setTimeout(() => {
              if (isVoiceModeActiveRef.current) {
                speechBaseTextRef.current = "";
                clearTranscript();
                setInputText("");
                startListening(undefined, true);
                setVoiceState("listening");
              }
            }, 350);
          } else {
            setVoiceState("idle");
          }
        };

        audio.onerror = () => {
          logger.warn("Audio element error, falling back to on-device natural voice");
          fallbackToDeviceSpeech(contentToSpeak);
        };

        await audio.play();
      } catch (err: unknown) {
        logger.warn("Gemini Studio TTS failed, falling back to on-device voice:", err);
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
      const composed = promptTemplateService.composePrompt(selectedTemplateIds, inputText.trim());
      textToSend = composed.combinedText;
      appliedTemplateIds = composed.templateIds;
      userRawText = composed.userText;
    }

    onSendMessage(textToSend, attachments, appliedTemplateIds, userRawText);
    speechBaseTextRef.current = "";
    clearTranscript();
    setInputText("");
    setAttachments([]);
    handleClearAllTemplates();
    setIsInputHeightExpanded(false);
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
        imageFiles.map((file) => imageCompressor.compressImageForGemini(file))
      );
      setAttachments((prev) => [...prev, ...compressedList]);
    } catch (err: unknown) {
      logger.error("Failed to compress image attachment:", err);
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

  const handleCopy = async (id: string, text: string) => {
    await clipboardService.writeText(text);
    setCopiedId(id);
    platformService.setTimeout(() => setCopiedId(null), 2000);
  };

  const handleStartNewChat = () => {
    stopAllPlayback();
    setIsHistoryOpen(false);
    if (onNewChat) {
      onNewChat();
    } else {
      onClearMessages();
    }
    platformService.setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  };

  const handleSelectSession = (session: ChatSession) => {
    stopAllPlayback();
    setIsHistoryOpen(false);
    if (onSelectSession) {
      onSelectSession(session);
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    if (isJulesMode) {
      const all = julesStorageService.julesSessionsManager.getItems().filter((s) => s.id !== sessionId);
      julesStorageService.julesSessionsManager.collection.save(all);
      if (sessionId === currentSessionId) {
        if (onNewChat) {
          onNewChat();
        } else {
          onClearMessages();
        }
      }
    } else {
      chatHistoryService.deleteChatSession(sessionId, activeProjectId);
      if (sessionId === currentSessionId) {
        if (onNewChat) {
          onNewChat();
        } else {
          onClearMessages();
        }
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
      {/* Floating Action Controls on Right Side of Screen (Stacked vertically, borderless & transparent) */}
      <div className="absolute top-3 end-3 z-30 flex flex-col items-center gap-1.5 pointer-events-auto">
        {/* Jules Task / Session Switcher (Jules mode only) */}
        {isJulesMode && onOpenJulesSessions && (
          <button
            type="button"
            id="jules-switch-task-btn"
            onClick={onOpenJulesSessions}
            className="w-9 h-9 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl bg-transparent border-0 text-purple-400 hover:text-purple-300 hover:bg-muted/40 transition-colors cursor-pointer active:scale-95 focus:outline-none touch-manipulation"
            title="Manage Jules Tasks & Sessions"
            aria-label="Manage Jules Tasks & Sessions"
          >
            <Bot className="w-4 h-4" />
          </button>
        )}

        {/* Start New Chat & History Trigger (Stacked above Prompt Templates) */}
        <div className="relative group/newchat flex items-center justify-center">
          <button
            ref={historyButtonRef}
            type="button"
            id="chat-top-right-new-chat-btn"
            aria-label={isJulesMode ? "Start new task or select history" : "New chat or select history"}
            title={isJulesMode ? "Start new task or select history" : "New chat or select history"}
            aria-haspopup="dialog"
            aria-expanded={isHistoryOpen}
            aria-controls="chat-window-history-popover"
            onClick={() => setIsHistoryOpen((prev) => !prev)}
            className={`w-9 h-9 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl transition-colors cursor-pointer active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary touch-manipulation ${
              isHistoryOpen
                ? "bg-muted text-foreground ring-1 ring-border shadow-sm"
                : "bg-transparent border-0 hover:bg-muted/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Plus
              className={`w-4 h-4 transition-colors-transform duration-200 ${
                isHistoryOpen ? "rotate-45 text-foreground" : ""
              }`}
            />
          </button>

          {/* Micro Tooltip on hover when popover is closed */}
          {!isHistoryOpen && (
            <div
              role="tooltip"
              className="absolute end-full me-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-popover/95 backdrop-blur-sm text-foreground text-[11px] font-medium rounded-lg whitespace-nowrap shadow-md pointer-events-none opacity-0 group-hover/newchat:opacity-100 transition-colors-opacity duration-150 z-20"
            >
              {isJulesMode ? "New task or history" : "New chat or history"}
            </div>
          )}

          {/* Anchored History & New Chat Popover Menu */}
          {isHistoryOpen && (
            <ChatHistoryPopover
              isJulesMode={!!isJulesMode}
              historySessions={historySessions}
              validHistorySessions={validHistorySessions}
              selectedHistoryIds={selectedHistoryIds}
              toggleHistorySelection={toggleHistorySelection}
              toggleSelectAllHistory={toggleSelectAllHistory}
              handleStartNewChat={handleStartNewChat}
              handleSelectSession={handleSelectSession}
              handleDeleteSession={handleDeleteSession}
              currentSessionId={currentSessionId || null}
              popoverRef={historyPopoverRef}
              getHistorySelectionState={getHistorySelectionState}
              timeProvider={useServices().timeProvider}


            />
          )}

        {/* Floating Batch Action Bar for History */}
        <BatchDeleteOverlay
          isVisible={selectedHistoryIds.size > 0 && isHistoryOpen}
          selectedCount={selectedHistoryIds.size}
          itemType="chat"
          onClearSelection={clearHistorySelection}
          onDelete={handleBulkDeleteHistory}
        />

        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto overscroll-contain p-3 pt-14 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] space-y-4 touch-pan-y"
        onTouchStart={() => {
          touchIsDraggingRef.current = true;
        }}
        onTouchMove={() => {
          // On mobile, dragging through message history hides the soft keyboard
          if (isInputFocused || platformService.getDocument()!.activeElement === textareaRef.current) {
            hideKeyboard();
          }
        }}
        onTouchEnd={() => {
          touchIsDraggingRef.current = false;
        }}
        onScroll={() => {
          if (isInputFocused && touchIsDraggingRef.current) {
            hideKeyboard();
          }
        }}
      >
        {messages.length === 0 ? (
          isJulesMode ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4 max-w-md mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-muted/40 flex items-center justify-center mb-3">
                <Bot className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                Google Jules Autonomous Agent
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Autonomous task execution on GitHub repositories. Jules explores the codebase, builds a plan, implements code changes, and creates a pull request.
              </p>

              {activeJulesSession ? (
                <div className="w-full mb-3.5 p-3 rounded-xl bg-muted/40 text-start flex items-center justify-between">
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-primary">
                      Active Repository
                    </span>
                    <div className="text-xs font-semibold text-foreground font-mono truncate">
                      {activeJulesSession?.repository}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Base branch: <span className="font-mono text-foreground">{activeJulesSession?.branch}</span>
                    </div>
                  </div>
                  {onOpenJulesSessions && (
                    <button
                      type="button"
                      onClick={onOpenJulesSessions}
                      className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-xs font-medium transition-colors shrink-0 cursor-pointer"
                    >
                      Change
                    </button>
                  )}
                </div>
              ) : (
                <div className="w-full mb-3.5 p-3.5 rounded-2xl bg-card text-start shadow-sm">
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
                      <ArrowRight className="rtl:rotate-180 w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 gap-2 w-full text-start">
                {julesStarterChips.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSendMessage(chip)}
                    className="p-2.5 rounded-xl bg-card hover:bg-muted text-xs text-muted-foreground hover:text-foreground transition-colors text-start flex items-center justify-between group cursor-pointer"
                  >
                    <span className="truncate">{chip}</span>
                    <span className="text-primary opacity-0 group-hover:opacity-100 transition-colors-opacity ms-2 shrink-0">
                      →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-4 max-w-md mx-auto">
              <h3 className="text-base font-semibold text-foreground mb-1">
                Google AI Studio Playground
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Engineered with Gemini 3.8 Flash for fast mobile prototyping, testing, and Android app integration.
              </p>

              {/* Authentication prompt card if not authenticated */}
              {!hasApiKey ? (
                <div className="w-full mb-3.5 p-3.5 rounded-2xl bg-card text-start shadow-sm">
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
                      <ArrowRight className="rtl:rotate-180 w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ) : googleUser && (googleUser as { email: string }).email ? (
                <div className="w-full mb-3 p-2.5 rounded-xl bg-card flex items-center justify-between gap-2 text-start">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
                      Live
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate">
                      Synced: <span className="font-semibold text-foreground">{(googleUser as { email: string }).email}</span>
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

              <div className="grid grid-cols-1 gap-2 w-full text-start">
                {starterChips.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSendMessage(chip)}
                    className="p-2.5 rounded-xl bg-card hover:bg-muted text-xs text-muted-foreground hover:text-foreground transition-colors text-start flex items-center justify-between group cursor-pointer"
                  >
                    <span className="truncate">{chip}</span>
                    <span className="text-primary opacity-0 group-hover:opacity-100 transition-colors-opacity ms-2 shrink-0">
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
                        • {activeJulesSession?.repository}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
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
                  <div className="prose dark:prose-invert prose-xs sm:prose-sm max-w-none break-words [&>pre]:bg-muted [&>pre]:p-3 [&>pre]:rounded-xl [&>pre]:border [&>pre]:border-border [&>pre]:overflow-x-auto [&>code]:text-primary [&>code]:bg-muted [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded [&>ul]:list-disc [&>ul]:ps-4 [&>ol]:list-decimal [&>ol]:ps-4">
                    <Markdown>{msg.text || (msg.isStreaming ? "Thinking..." : "")}</Markdown>
                    {msg.isStreaming && (
                      <span className="inline-block w-1.5 h-3.5 bg-primary ms-1 animate-pulse align-middle" />
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
                              const tpl = promptTemplateService.getTemplateById(tplId);
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
                  <div className="mt-2 p-2 rounded-lg bg-muted/40 border border-destructive/30 text-destructive text-xs">
                    {msg.error}
                  </div>
                )}
              </div>

              {/* Action buttons on model responses */}
              {msg.role === "model" && !msg.isStreaming && (
                <div className="flex items-center gap-1 mt-1 px-1">
                  <button
                    onClick={() => handleCopy(msg.id, msg.text)}
                    className="min-w-[44px] min-h-[44px] p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer flex items-center justify-center touch-manipulation"
                    title="Copy response"
                    aria-label="Copy response"
                  >
                    {copiedId === msg.id ? (
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
                        stopAllPlayback();
                      } else {
                        handleToggleSpeech(msg.text);
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
              className="relative flex items-center gap-2 bg-muted rounded-lg p-1.5 shrink-0"
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
                className="p-0.5 rounded-full hover:bg-muted/40 text-muted-foreground hover:text-destructive cursor-pointer"
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
          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground me-1 shrink-0">
            <Layers className="w-3 h-3 text-primary" />
            <span className="hidden xs:inline">Directives:</span>
          </div>

          {selectedTemplateObjects.map((template, idx) => (
            <div
              key={template.id}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/10 border border-primary/20 text-foreground text-xs shrink-0 animate-in fade-in zoom-in-95"
            >
              <span className="text-xs text-muted-foreground/70 font-medium ml-1.5">
                #{idx + 1}
              </span>
              <span className="font-medium truncate max-w-[120px] sm:max-w-[160px]">
                {template.title}
              </span>
              <button
                type="button"
                onClick={() => handleRemoveTemplate(template.id)}
                className="w-7 h-7 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-full hover:bg-muted/40 text-muted-foreground hover:text-destructive cursor-pointer shrink-0 transition-colors touch-manipulation relative after:absolute after:-inset-2"
                title={`Dismiss #${idx + 1} ${template.title} (Dismiss to reorder)`}
                aria-label={`Remove template ${template.title}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          <button
            type="button"
            id="tray-add-template-btn"
            onClick={handleOpenTemplateDrawer}
            className="h-8 min-h-[32px] px-2.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-xs font-medium flex items-center gap-1 shrink-0 transition-colors cursor-pointer touch-manipulation relative after:absolute after:-inset-1.5"
            title="Add or configure templates"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>

          {selectedTemplateIds.length > 1 && (
            <button
              type="button"
              id="tray-clear-all-btn"
              onClick={handleClearAllTemplates}
              className="text-xs text-muted-foreground hover:text-destructive px-2 py-1 shrink-0 transition-colors cursor-pointer touch-manipulation relative after:absolute after:-inset-1.5"
              title="Clear all selected templates"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Optional Floating Action Button (FAB) placement when configured in settings */}
      {speechSettings.voiceButtonPlacement === "fab" && (
        <div className="absolute bottom-24 end-4 z-30 pointer-events-auto">
          <AnimatePresence mode="wait" initial={false}>
            {!isVoiceModeActive ? (
              <motion.div
                key="fab-button"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.945, ease: [0.4, 0, 0.2, 1] }}
              >
                <button
                  type="button"
                  id="chat-handsfree-fab-btn"
                  onClick={handleToggleVoiceMode}
                  className="h-12 px-4 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl flex items-center gap-2.5 text-xs font-semibold transition-colors duration-[945ms] active:scale-95 cursor-pointer touch-manipulation group"
                  title="Start hands-free continuous two-way voice conversation"
                  aria-label="Start hands-free continuous two-way voice conversation"
                >
                  <div className="w-6 h-6 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                    <Mic className="w-3.5 h-3.5" />
                  </div>
                  <span>Hands-Free Voice</span>
                  <span className="text-[10px] font-medium opacity-80 uppercase tracking-widest">(Active)</span>
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="fab-active"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.945, ease: [0.4, 0, 0.2, 1] }}
                className="flex items-center gap-2 bg-card border border-primary/50 shadow-xl rounded-full p-1.5 ps-3 text-xs animate-in fade-in duration-[945ms]"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-primary uppercase tracking-widest animate-pulse">●</span>
                  <span className="font-semibold text-foreground">
                    {voiceState === "listening"
                      ? isAudioDetected
                        ? "Listening (Speaking)..."
                        : "Listening..."
                      : voiceState === "processing"
                      ? "Thinking..."
                      : voiceState === "speaking"
                      ? "Speaking..."
                      : "Standby"}
                  </span>
                </div>
                {voiceState === "speaking" && (
                  <button
                    type="button"
                    id="chat-voice-fab-interrupt-btn"
                    onClick={handleInterrupt}
                    className="px-2.5 py-1 rounded-full bg-muted/40 text-muted-foreground hover:bg-warning/25 hover:text-warning text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                    title="Interrupt assistant speech"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span>Interrupt</span>
                  </button>
                )}
                <button
                  type="button"
                  id="chat-voice-fab-end-btn"
                  onClick={handleToggleVoiceMode}
                  className="w-7 h-7 rounded-full bg-muted/40 text-muted-foreground hover:bg-destructive/25 hover:text-destructive flex items-center justify-center cursor-pointer"
                  title="End hands-free voice mode"
                  aria-label="End hands-free voice mode"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Adaptive Split-Dock (50/50 Resting Split ↔ 100% Expansions, Zero Outer Padding) */}
      <div className="p-0 pb-[max(0rem,env(safe-area-inset-bottom))] bg-card border-t border-border overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {/* Case A: Voice Mode Active (100% Full-Width Conversational Voice Hub - Entire Section Tappable to Exit) */}
          {isVoiceModeActive ? (
            <motion.div
              key="voice-mode-hud"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.945, ease: [0.4, 0, 0.2, 1] }}
              className="w-full"
            >
              <div
                id="conversational-voice-hud"
                role="button"
                tabIndex={0}
                onClick={handleToggleVoiceMode}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleToggleVoiceMode();
                  }
                }}
                className="w-full h-20 min-h-[80px] px-4 py-2.5 bg-gradient-to-r from-primary/15 via-background to-primary/10 hover:from-primary/25 hover:via-background/90 hover:to-primary/20 active:scale-[0.995] border-t border-border shadow-sm flex items-center justify-between gap-3 animate-in fade-in duration-[945ms] ease-in-out cursor-pointer select-none touch-manipulation group"
                title="Tap anywhere to exit hands-free voice mode"
                aria-label="Exit hands-free voice mode (tap anywhere)"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Dynamic Voice Visualizer */}
                  <div className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-colors-transform">
                    {voiceState === "listening" && (
                      <div className="flex items-center gap-1 h-5">
                        <span className="w-1 bg-primary rounded-full animate-bounce [animation-delay:-0.3s] h-3" />
                        <span className="w-1 bg-primary rounded-full animate-bounce [animation-delay:-0.15s] h-5" />
                        <span className="w-1 bg-primary rounded-full animate-bounce h-2.5" />
                      </div>
                    )}
                    {voiceState === "processing" && (
                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    )}
                    {voiceState === "speaking" && (
                      <div className="flex items-center gap-1 h-5">
                        <span className="w-1 bg-primary rounded-full animate-pulse h-5" />
                        <span className="w-1 bg-primary rounded-full animate-pulse [animation-delay:0.2s] h-3.5" />
                        <span className="w-1 bg-primary rounded-full animate-pulse [animation-delay:0.4s] h-5" />
                      </div>
                    )}
                    {voiceState === "idle" && (
                      <Mic className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-semibold text-foreground truncate">
                        {voiceState === "listening"
                          ? isAudioDetected
                            ? "Listening... (Speaking)"
                            : "Listening... (Speak naturally)"
                          : voiceState === "processing"
                          ? "Gemini is thinking..."
                          : voiceState === "speaking"
                          ? "Assistant speaking..."
                          : "Hands-free active"}
                      </span>
                      <span className="text-[10px] font-medium text-primary uppercase tracking-widest animate-pulse shrink-0">●</span>
                      {silenceCountdownMs !== null && silenceCountdownMs > 0 && voiceState === "listening" && inputText.trim() && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-muted-foreground/70 animate-pulse">
                          Auto-send in {(silenceCountdownMs / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>
                    {speechError ? (
                      <p className="text-[11px] text-muted-foreground hover:text-destructive font-medium truncate toast-element">
                        {speechError}
                      </p>
                    ) : inputText.trim() ? (
                      <p className="text-xs text-foreground/90 font-medium truncate italic max-w-[280px] sm:max-w-md md:max-w-xl">
                        &ldquo;{inputText}&rdquo;
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground truncate">
                        {voiceState === "listening"
                          ? "Speak now · Tap anywhere to exit & edit text"
                          : voiceState === "speaking"
                          ? "Tap Interrupt to cut in · Tap anywhere to exit"
                          : "Tap anywhere to exit hands-free mode"}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {voiceState === "speaking" && (
                    <button
                      type="button"
                      id="chat-voice-interrupt-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInterrupt();
                      }}
                      className="h-11 min-h-[44px] px-3.5 rounded-xl bg-muted/40 text-muted-foreground hover:bg-warning/25 hover:text-warning text-xs font-semibold flex items-center gap-1.5 cursor-pointer touch-manipulation transition-colors"
                      title="Interrupt assistant speech"
                      aria-label="Interrupt assistant speech"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Interrupt</span>
                    </button>
                  )}

                  <div className="flex items-center gap-1.5 text-muted-foreground group-hover:text-destructive transition-colors text-xs font-medium px-2 py-1">
                    <span className="hidden sm:inline text-[11px]">
                      {inputText.trim() ? "Exit & edit text" : "Tap to exit"}
                    </span>
                    <X className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            /* Case B & C: Text Input Mode (Expanded Dock or Resting 50/50 Split) */
            <motion.div
              key="text-mode-dock"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.945, ease: [0.4, 0, 0.2, 1] }}
              className="w-full"
            >
              {isInputExpanded ? (
                /* Case B: Expanded 100% Full-Width Text Input Dock */
                <div
                  className={`w-full bg-background border-t border-border transition-colors duration-[945ms] ease-in-out flex ${
                    isInputHeightExpanded ? "flex-col justify-between" : "items-end"
                  } gap-2 px-3 py-2 ${
                    isInputHeightExpanded ? "h-[200px] min-h-[200px]" : "h-20 min-h-[80px]"
                  }`}
                >
                  {/* Standard height: Attachment button on the left */}
                  {!isInputHeightExpanded && (
                    <button
                      type="button"
                      id="chat-attach-btn"
                      disabled={isOptimizingImage}
                      onClick={() => fileInputRef.current?.click()}
                      className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 disabled:opacity-50 cursor-pointer touch-manipulation"
                      title={isOptimizingImage ? "Compressing image..." : "Attach image or screenshot"}
                      aria-label="Attach media"
                    >
                      {isOptimizingImage ? (
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      ) : (
                        <ImageIcon className="w-4 h-4" />
                      )}
                    </button>
                  )}
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
                    autoFocus
                    onChange={(e) => setInputText(e.target.value)}
                    onFocus={() => {
                      setIsInputFocused(true);
                      platformService.setTimeout(() => {
                        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
                      }, 120);
                    }}
                    onBlur={() => {
                      platformService.setTimeout(() => {
                        if (platformService.getDocument()!.activeElement !== textareaRef.current) {
                          setIsInputFocused(false);
                        }
                      }, 150);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      isJulesMode
                        ? activeJulesSession
                          ? `Describe a task or fix for Jules on ${activeJulesSession?.repository}...`
                          : "Select a repository to dispatch a Jules task..."
                        : "Type prompt or test instructions..."
                    }
                    rows={isInputHeightExpanded ? 5 : 1}
                    className={`bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none py-2 px-1 overflow-y-auto leading-relaxed ${
                      isInputHeightExpanded
                        ? "w-full flex-1 min-h-[110px] max-h-[135px]"
                        : "flex-1 min-h-[44px] max-h-[58px]"
                    }`}
                  />

                  {/* When expanded to 250% height: bottom row containing attach on left, expand + send on right */}
                  {isInputHeightExpanded ? (
                    <div className="flex items-center justify-between w-full pt-1.5 border-t border-border/40 shrink-0">
                      {/* Media Attach button on the left */}
                      <button
                        type="button"
                        id="chat-attach-btn"
                        disabled={isOptimizingImage}
                        onClick={() => fileInputRef.current?.click()}
                        className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 disabled:opacity-50 cursor-pointer touch-manipulation"
                        title={isOptimizingImage ? "Compressing image..." : "Attach image or screenshot"}
                        aria-label="Attach media"
                      >
                        {isOptimizingImage ? (
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        ) : (
                          <ImageIcon className="w-4 h-4" />
                        )}
                      </button>

                      {/* Right controls: borderless transparent expand button + send button */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          id="chat-expand-height-btn"
                          onClick={() => setIsInputHeightExpanded(false)}
                          className="w-10 h-10 min-w-[40px] min-h-[40px] border-0 bg-transparent hover:bg-transparent text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors touch-manipulation"
                          title="Restore standard height"
                          aria-label="Restore standard height"
                        >
                          <Minimize2 className="w-4 h-4" />
                        </button>

                        {isGenerating ? (
                          <button
                            type="button"
                            id="chat-stop-btn"
                            onClick={onStopGeneration}
                            className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-muted/40 hover:bg-destructive/90 text-muted-foreground hover:text-destructive-foreground transition-colors shrink-0 shadow-sm cursor-pointer touch-manipulation"
                            title="Stop generation"
                            aria-label="Stop generation"
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
                            className={`w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-colors shrink-0 font-semibold touch-manipulation ${
                              inputText.trim() || attachments.length > 0 || selectedTemplateIds.length > 0
                                ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm active:scale-95 cursor-pointer"
                                : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                            }`}
                            title={isJulesMode ? "Dispatch Jules task" : "Run prompt"}
                            aria-label={isJulesMode ? "Dispatch Jules task" : "Run prompt"}
                          >
                            {isJulesMode ? <Bot className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* When standard height: right controls inline with textarea */
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Borderless transparent Expand button (increases height by around 250%) */}
                      <button
                        type="button"
                        id="chat-expand-height-btn"
                        onClick={() => setIsInputHeightExpanded(true)}
                        className="w-10 h-10 min-w-[40px] min-h-[40px] border-0 bg-transparent hover:bg-transparent text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors touch-manipulation"
                        title="Expand input height (250%)"
                        aria-label="Expand input height"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>

                      {/* Send / Stop button on the right */}
                      {isGenerating ? (
                        <button
                          type="button"
                          id="chat-stop-btn"
                          onClick={onStopGeneration}
                          className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-muted/40 hover:bg-destructive/90 text-muted-foreground hover:text-destructive-foreground transition-colors shrink-0 shadow-sm cursor-pointer touch-manipulation"
                          title="Stop generation"
                          aria-label="Stop generation"
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
                          className={`w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-colors shrink-0 font-semibold touch-manipulation ${
                            inputText.trim() || attachments.length > 0 || selectedTemplateIds.length > 0
                              ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm active:scale-95 cursor-pointer"
                              : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                          }`}
                          title={isJulesMode ? "Dispatch Jules task" : "Run prompt"}
                          aria-label={isJulesMode ? "Dispatch Jules task" : "Run prompt"}
                        >
                          {isJulesMode ? <Bot className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Case C: Resting State 50/50 Adaptive Split-Dock (0 Outer Padding) */
                <div className="flex items-stretch gap-0 w-full h-20 min-h-[80px]">
                  {/* Left Card: Expands full width in FAB mode, or 50% split in Footer mode */}
                  <div
                    id="chat-resting-text-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setIsInputFocused(true);
                      platformService.setTimeout(() => {
                        textareaRef.current?.focus();
                      }, 50);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        setIsInputFocused(true);
                        platformService.setTimeout(() => {
                          textareaRef.current?.focus();
                        }, 50);
                      }
                    }}
                    className={`flex-1 ${
                      speechSettings.voiceButtonPlacement === "fab" ? "w-full" : "w-1/2 border-e border-border"
                    } h-20 min-h-[80px] bg-background hover:bg-muted/30 focus-visible:border-primary px-4 py-3 flex flex-col justify-center cursor-pointer transition-colors duration-[945ms] ease-in-out select-none group touch-manipulation`}
                    title="Tap to type message (expands full width)"
                    aria-label="Tap to open chat text input"
                  >
                    <div className="flex items-center gap-2 text-muted-foreground group-hover:text-foreground transition-colors min-w-0">
                      <MessageSquare className="w-4 h-4 shrink-0 text-muted-foreground/70 group-hover:text-primary transition-colors" />
                      <span className="text-xs sm:text-sm truncate">
                        {inputText ? (
                          <span className="text-foreground font-medium">{inputText}</span>
                        ) : isJulesMode ? (
                          "Dispatch task..."
                        ) : (
                          "Type message..."
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Right 50%: Hands-Free Voice Button (Only shown in Footer mode to avoid duplicate with FAB) */}
                  {speechSettings.voiceButtonPlacement !== "fab" && (
                    <button
                      type="button"
                      id="chat-handsfree-primary-btn"
                      onClick={handleToggleVoiceMode}
                      className="flex-1 w-1/2 h-20 min-h-[80px] bg-gradient-to-br from-primary/15 via-primary/10 to-primary/20 hover:from-primary/25 hover:via-primary/15 hover:to-primary/25 active:scale-[0.99] text-primary flex items-center justify-center transition-colors duration-[945ms] ease-in-out cursor-pointer touch-manipulation group"
                      title="Start hands-free voice mode"
                      aria-label="Start hands-free voice mode"
                    >
                      <Mic className="w-6 h-6 text-primary group-hover:scale-110 active:scale-95 transition-colors-transform" />
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Full-Screen Mobile Drawer for Prompt Templates (Selection, Filtering, Authoring, Preview, Prompt Tools) */}
      <PromptTemplateDrawer
        isOpen={isTemplateDrawerOpen}
        onClose={handleCloseTemplateDrawer}
        selectedTemplateIds={selectedTemplateIds}
        onToggleTemplate={handleToggleTemplate}
        onRemoveTemplate={handleRemoveTemplate}
        onClearAllTemplates={handleClearAllTemplates}
        draftUserText={inputText}
        onInsertText={(text) => {
          setInputText((prev) => (prev.trim() ? `${prev}\n\n${text}` : text));
          handleCloseTemplateDrawer();
        }}
      />
    </div>
  );
};

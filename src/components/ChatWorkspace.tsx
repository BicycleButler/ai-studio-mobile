import React, { useState, useRef, useEffect } from "react";
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
} from "lucide-react";
import Markdown from "react-markdown";
import { ChatMessage, MessageAttachment, PromptConfig, GoogleUser } from "../types";
import { compressImageForGemini } from "../utils/imageCompressor";
import { extractSpokenText } from "../utils/speechExtractor";
import {
  SpeechSettings,
  loadSpeechSettings,
  saveSpeechSettings,
} from "../services/speechVoices";
import { VoiceSettingsModal } from "./VoiceSettingsModal";
import { getAuthHeaders } from "../services/auth";
import { SettingsTab } from "./UnifiedSettingsModal";
import { useSpeechToText } from "../hooks/useSpeechToText";

interface ChatWorkspaceProps {
  messages: ChatMessage[];
  onSendMessage: (text: string, attachments?: MessageAttachment[]) => void;
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
  onSaveSpeechSettings,
  onOpenSettings: _onOpenSettings,
}) => {
  const [inputText, setInputText] = useState("");
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [isOptimizingImage, setIsOptimizingImage] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isBufferingAudio, setIsBufferingAudio] = useState(false);
  const [localSpeechSettings, setLocalSpeechSettings] = useState<SpeechSettings>(() =>
    loadSpeechSettings()
  );
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

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

  const handleToggleSpeech = async () => {
    if (isSpeaking || isBufferingAudio) {
      stopAllPlayback();
      return;
    }

    if (!lastModelMessage) return;

    // Extract spoken text strictly omitting code blocks and formatting
    const spokenText = extractSpokenText(lastModelMessage.text);
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
    if ((!inputText.trim() && attachments.length === 0) || isGenerating || isOptimizingImage) return;
    stopAllPlayback();
    if (!hasApiKey && onOpenAuth) {
      onOpenAuth();
      return;
    }
    onSendMessage(inputText.trim(), attachments);
    setInputText("");
    setAttachments([]);
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

  const starterChips = [
    "Write an Android Jetpack Compose animation",
    "Explain how Gemini 3.8 Flash handles multimodal tokens",
    "Design a JSON schema for a food delivery order",
    "Refactor this function to be more memory-efficient",
  ];

  return (
    <div className="flex flex-col h-full flex-1 overflow-hidden bg-[#131314] relative">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600/20 via-purple-600/20 to-rose-600/20 border border-[#2b2c31] flex items-center justify-center mb-3">
              <Sparkles className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">
              Google AI Studio Playground
            </h3>
            <p className="text-xs text-[#9aa0a6] mb-4">
              Engineered with Gemini 3.8 Flash for fast mobile prototyping, testing, and Android app integration.
            </p>

            {/* Authentication prompt card if not authenticated */}
            {!hasApiKey ? (
              <div className="w-full mb-3.5 p-3.5 rounded-2xl bg-gradient-to-br from-blue-950/40 via-[#1a1c24] to-[#15161b] border border-blue-500/30 text-left shadow-lg">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center p-0.5 shrink-0">
                    <svg className="w-full h-full" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                  </div>
                  <span className="font-semibold text-xs text-white">
                    Sign in with Google AI Studio
                  </span>
                </div>
                <p className="text-[11px] text-[#c4c7c5] leading-relaxed mb-3">
                  Connect your Google account to sync live models, prompts, and run code directly from your AI Studio environment.
                </p>
                {onOpenAuth && (
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md active:scale-95 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>Connect Google Account</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : googleUser ? (
              <div className="w-full mb-3 p-2.5 rounded-xl bg-blue-950/20 border border-blue-500/30 flex items-center justify-between gap-2 text-left">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded shrink-0">
                    Live
                  </span>
                  <span className="text-[11px] text-zinc-300 truncate">
                    Synced: <span className="font-semibold text-white">{googleUser.email}</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium shrink-0 underline"
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
                  className="p-2.5 rounded-xl bg-[#1b1c20] hover:bg-[#24262b] border border-[#2b2c31] text-xs text-[#c4c7c5] hover:text-white transition-colors text-left flex items-center justify-between group"
                >
                  <span className="truncate">{chip}</span>
                  <span className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                    →
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === "user" ? "items-end" : "items-start"
              }`}
            >
              {/* Sender label */}
              <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-[#9aa0a6]">
                {msg.role === "user" ? (
                  <span className="font-medium text-zinc-300">User</span>
                ) : (
                  <div className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-blue-400" />
                    <span className="font-medium text-blue-300">Gemini</span>
                    {msg.tokenCount && (
                      <span className="text-[10px] text-[#71767b]">
                        • {msg.tokenCount} tokens
                      </span>
                    )}
                    {msg.durationMs && (
                      <span className="text-[10px] text-[#71767b]">
                        • {(msg.durationMs / 1000).toFixed(2)}s
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Message bubble */}
              <div
                className={`max-w-[92%] sm:max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[#1a73e8] text-white rounded-tr-none shadow-sm"
                    : "bg-[#1e1f23] text-[#e3e3e3] border border-[#2d2f36] rounded-tl-none shadow-md"
                }`}
              >
                {/* Images preview if present */}
                {msg.images && msg.images.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {msg.images.map((img) => (
                      <div
                        key={img.id}
                        className="relative rounded-lg overflow-hidden border border-white/20 max-w-[160px] max-h-[160px]"
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

                {/* Content */}
                {msg.role === "model" ? (
                  <div className="prose prose-invert prose-xs sm:prose-sm max-w-none break-words [&>pre]:bg-[#121214] [&>pre]:p-3 [&>pre]:rounded-xl [&>pre]:border [&>pre]:border-[#2c2d33] [&>pre]:overflow-x-auto [&>code]:text-blue-300 [&>code]:bg-[#121214]/60 [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4">
                    <Markdown>{msg.text || (msg.isStreaming ? "Thinking..." : "")}</Markdown>
                    {msg.isStreaming && (
                      <span className="inline-block w-1.5 h-3.5 bg-blue-400 ml-1 animate-pulse align-middle" />
                    )}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                )}

                {msg.error && (
                  <div className="mt-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                    {msg.error}
                  </div>
                )}
              </div>

              {/* Action buttons on model responses */}
              {msg.role === "model" && !msg.isStreaming && (
                <div className="flex items-center gap-1 mt-1 px-1">
                  <button
                    onClick={() => handleCopy(msg.id, msg.text)}
                    className="p-1 rounded text-[#9aa0a6] hover:text-white hover:bg-[#25262b] transition-colors"
                    title="Copy response"
                  >
                    {copiedId === msg.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    onClick={onRegenerate}
                    className="p-1 rounded text-[#9aa0a6] hover:text-white hover:bg-[#25262b] transition-colors"
                    title="Regenerate"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
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
        <div className="px-3 py-1.5 bg-[#17181c] border-t border-[#24262b] flex items-center gap-2 overflow-x-auto">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="relative flex items-center gap-2 bg-[#222429] border border-[#31343a] rounded-lg p-1.5 shrink-0"
            >
              <img
                src={att.previewUrl}
                alt={att.name}
                className="w-8 h-8 rounded object-cover"
              />
              <div className="text-[10px] text-zinc-300 truncate max-w-[90px]">
                {att.name}
              </div>
              <button
                onClick={() => removeAttachment(att.id)}
                className="p-0.5 rounded-full hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Dock (Android Mobile Floating Keyboard Clearance) */}
      <div className="p-2.5 bg-[#16171a] border-t border-[#26282e]">
        <div className="flex items-end gap-1.5 bg-[#1f2025] rounded-2xl border border-[#30333b] p-1.5 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/50 transition-colors">
          {/* Media Attach button */}
          <button
            type="button"
            id="chat-attach-btn"
            disabled={isOptimizingImage}
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-xl text-[#9aa0a6] hover:text-white hover:bg-[#2a2c33] transition-colors shrink-0 disabled:opacity-50"
            title={isOptimizingImage ? "Compressing image..." : "Attach image or screenshot"}
          >
            {isOptimizingImage ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
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
            placeholder="Type prompt or test instructions..."
            rows={1}
            className="flex-1 bg-transparent text-xs sm:text-sm text-white placeholder-[#71767b] focus:outline-none resize-none py-1.5 px-1 max-h-28"
          />

          {/* Prompt Microphone button inside dock */}
          <button
            type="button"
            id="chat-mic-btn"
            onClick={handleActivatePromptSpeech}
            className={`p-2 rounded-xl transition-colors shrink-0 ${
              isListening
                ? "bg-rose-600 text-white animate-pulse"
                : "text-[#9aa0a6] hover:text-blue-400 hover:bg-[#2a2c33]"
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
              className="p-2 rounded-xl text-[#71767b] hover:text-rose-400 hover:bg-[#2a2c33] transition-colors shrink-0"
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
              className="p-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-colors shrink-0 shadow-sm"
              title="Stop generation"
            >
              <Square className="w-4 h-4 fill-white" />
            </button>
          ) : (
            <button
              type="button"
              id="chat-send-btn"
              onClick={handleSend}
              disabled={!inputText.trim() && attachments.length === 0}
              className={`p-2.5 rounded-xl transition-colors shrink-0 flex items-center gap-1 font-semibold ${
                inputText.trim() || attachments.length > 0
                  ? "bg-blue-600 hover:bg-blue-500 text-white shadow-md active:scale-95"
                  : "bg-[#292b31] text-[#71767b] cursor-not-allowed"
              }`}
              title="Run prompt"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Sticky Footer: Keyboard Microphone Speech-to-Text Button */}
      <div className="sticky bottom-0 z-20 px-3 py-2 bg-[#121316]/95 backdrop-blur-md border-t border-[#25272e] flex items-center justify-between gap-2 shadow-xl">
        <button
          type="button"
          id="sticky-footer-mic-btn"
          onClick={handleActivatePromptSpeech}
          className={`w-full py-2.5 px-4 rounded-xl font-medium text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-colors shadow-md active:scale-[0.99] ${
            isListening
              ? "bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-rose-400/50 shadow-rose-600/30"
              : "bg-gradient-to-r from-blue-600/90 to-indigo-600/90 hover:from-blue-600 hover:to-indigo-600 text-white border border-blue-500/40 shadow-blue-500/20"
          }`}
          title="Activate keyboard microphone for speech-to-text in prompt instructions area"
          aria-label="Activate keyboard microphone for speech to text in prompt instructions area"
        >
          {isListening ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
              </span>
              <Mic className="w-4 h-4 animate-pulse text-white" />
              <span className="font-semibold text-white">Listening... Tap to stop (or use keyboard mic)</span>
              <span className="flex items-center gap-0.5 ml-1" aria-hidden="true">
                <span className="w-1 h-3 bg-white rounded-full animate-pulse" />
                <span className="w-1 h-4 bg-white rounded-full animate-bounce" />
                <span className="w-1 h-2 bg-white rounded-full animate-pulse" />
              </span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4 text-white" />
              <span className="font-semibold text-white">Speech-to-Text / Keyboard Mic</span>
              <span className="text-[11px] text-blue-100/85 hidden xs:inline font-normal">
                (Dictate into prompt instructions)
              </span>
            </>
          )}
        </button>
      </div>

      {/* Floating Action Button (FAB) to Read Aloud the Recent Response */}
      {lastModelMessage && !isGenerating && (
        <div
          className={`absolute right-3.5 z-30 pointer-events-auto transition-[bottom] duration-200 animate-in fade-in slide-in-from-bottom-2 ${
            attachments.length > 0 ? "bottom-44" : "bottom-32"
          }`}
        >
          <button
            type="button"
            id="chat-read-aloud-fab"
            onClick={handleToggleSpeech}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-full shadow-2xl backdrop-blur-md border transition-colors duration-200 active:scale-95 text-xs font-semibold ${
              isSpeaking
                ? "bg-blue-600 text-white border-blue-400/80 shadow-blue-500/30 ring-2 ring-blue-500/30"
                : isBufferingAudio
                ? "bg-blue-900/80 text-blue-200 border-blue-700/50"
                : "bg-[#1e2029]/95 hover:bg-[#282c38] text-zinc-100 border-[#383d4a] hover:border-blue-500/40 hover:text-white"
            }`}
            title={
              isSpeaking
                ? "Stop reading response"
                : isBufferingAudio
                ? "Generating HD voice audio..."
                : `Read out loud (${
                    speechSettings.engine === "gemini"
                      ? speechSettings.geminiVoice
                      : "Device"
                  }). Change voice in Settings.`
            }
            aria-label={
              isSpeaking
                ? "Stop reading response"
                : isBufferingAudio
                ? "Generating audio..."
                : "Read out loud response"
            }
          >
            {isBufferingAudio ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                <span>Generating...</span>
              </>
            ) : isSpeaking ? (
              <>
                <Square className="w-3.5 h-3.5 fill-white text-white" />
                <span>Stop</span>
                <span className="flex items-center gap-0.5 ml-0.5" aria-hidden="true">
                  <span className="w-1 h-3 bg-white rounded-full animate-pulse" />
                  <span className="w-1 h-4 bg-white rounded-full animate-bounce" />
                  <span className="w-1 h-2 bg-white rounded-full animate-pulse" />
                </span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Read Aloud</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Audio & Voice Settings Modal Fallback if triggered directly */}
      <VoiceSettingsModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        settings={speechSettings}
        onSaveSettings={(newSettings) => {
          if (onSaveSpeechSettings) {
            onSaveSpeechSettings(newSettings);
          } else {
            setLocalSpeechSettings(newSettings);
            saveSpeechSettings(newSettings);
          }
        }}
      />
    </div>
  );
};

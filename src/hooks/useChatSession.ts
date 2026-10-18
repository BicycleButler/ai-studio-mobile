import { useState, useCallback } from "react";
import { ChatMessage, StructuredExample, SavedPrompt, PromptType, PromptConfig, ProjectInfo } from "../types";
import { generateUniqueId } from "../utils/idGenerator";
import { loadSavedPrompts, persistSavedPrompts } from "../utils/storage";
import { bulkDeleteCustomTemplates } from "../services/promptTemplateService";

export function useChatSession(initialDraft: { messages?: ChatMessage[]; freeformText?: string; structuredExamples?: StructuredExample[] }, promptType: PromptType, config: PromptConfig, activeProject: ProjectInfo | null) {
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => `sess_${Date.now()}`);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (initialDraft.messages && initialDraft.messages.length > 0) {
      return initialDraft.messages;
    }
    return [];
  });

  const [freeformText] = useState(initialDraft.freeformText);
  const [structuredExamples] = useState<StructuredExample[]>(initialDraft.structuredExamples || []);

  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>(() => loadSavedPrompts());

  const handleStartNewChat = useCallback((onStopStream?: () => void) => {
    if (onStopStream) {
      onStopStream();
    }
    const newSessionId = generateUniqueId("sess");
    setCurrentSessionId(newSessionId);
    setMessages([]);
  }, []);

  const handleSaveCurrentPrompt = useCallback((title: string) => {
    const newSaved: SavedPrompt = {
      id: generateUniqueId("saved"),
      title,
      type: promptType,
      config: { ...config },
      messages: [...messages],
      updatedAt: Date.now(),
      projectId: activeProject?.id,
    };

    const updated = [newSaved, ...savedPrompts];
    setSavedPrompts(updated);
    persistSavedPrompts(updated);
  }, [promptType, config, messages, activeProject?.id, savedPrompts]);

  const handleDeleteSavedPrompt = useCallback((id: string) => {
    const updated = savedPrompts.filter((p) => p.id !== id);
    setSavedPrompts(updated);
    persistSavedPrompts(updated);
  }, [savedPrompts]);

  const handleBulkDeleteSavedPrompts = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    const updated = savedPrompts.filter((p) => !idSet.has(p.id));
    setSavedPrompts(updated);
    persistSavedPrompts(updated);
    bulkDeleteCustomTemplates(ids);
  }, [savedPrompts]);

  return {
    currentSessionId,
    setCurrentSessionId,
    messages,
    setMessages,
    freeformText,
    structuredExamples,
    savedPrompts,
    setSavedPrompts,
    handleStartNewChat,
    handleSaveCurrentPrompt,
    handleDeleteSavedPrompt,
    handleBulkDeleteSavedPrompts,
  };
}

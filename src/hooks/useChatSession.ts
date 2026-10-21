import { useState, useCallback } from "react";
import { ChatMessage, StructuredExample, SavedPrompt, PromptType, PromptConfig, ProjectInfo } from "../types";
import { generateUniqueId } from "../utils/idGenerator";
import { savedPromptsManager } from "../utils/storage";
import { IPromptTemplateService } from "../services/promptTemplateService";
import { useStore } from "./useStore";

export function useChatSession(initialDraft: { messages?: ChatMessage[]; freeformText?: string; structuredExamples?: StructuredExample[] }, promptType: PromptType, config: PromptConfig, activeProject: ProjectInfo | null, promptTemplateService: IPromptTemplateService) {
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => `sess_${Date.now()}`);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (initialDraft.messages && initialDraft.messages.length > 0) {
      return initialDraft.messages;
    }
    return [];
  });

  const [freeformText] = useState(initialDraft.freeformText);
  const [structuredExamples] = useState<StructuredExample[]>(initialDraft.structuredExamples || []);

  const savedPromptsStore = useStore(savedPromptsManager);
  const savedPrompts = savedPromptsStore.items;

  // Backwards compatibility for setSavedPrompts (should ideally only be modified via the manager)
  const setSavedPrompts = useCallback((promptsOrUpdater: React.SetStateAction<SavedPrompt[]>) => {
      const nextPrompts = typeof promptsOrUpdater === 'function' ? promptsOrUpdater(savedPrompts) : promptsOrUpdater;
      savedPromptsManager.collection.save(nextPrompts);
  }, [savedPrompts]);

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
    savedPromptsManager.collection.upsert(newSaved, true);
  }, [promptType, config, messages, activeProject?.id]);

  const handleDeleteSavedPrompt = useCallback((id: string) => {
    savedPromptsManager.collection.delete(id);
  }, []);

  const handleBulkDeleteSavedPrompts = useCallback((ids: string[]) => {
    savedPromptsManager.collection.bulkDelete(ids);
    promptTemplateService.bulkDeleteCustomTemplates(ids);
  }, [promptTemplateService]);

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

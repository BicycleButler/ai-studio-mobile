import { useServices } from "../services/ServiceContext";
import { useState, useCallback } from "react";
import { ChatMessage, StructuredExample, SavedPrompt, PromptType, PromptConfig, ProjectInfo } from "../types";
import { IPromptTemplateService } from "../services/promptTemplateService";
import { useStore } from "./useStore";

export function useChatSession(initialDraft: { messages?: ChatMessage[]; freeformText?: string; structuredExamples?: StructuredExample[] }, promptType: PromptType, config: PromptConfig, activeProject: ProjectInfo | null, promptTemplateService: IPromptTemplateService) {
  const { savedPromptsService, firestoreSyncService, idGenerator, timeProvider, logger } = useServices();
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => idGenerator.generate("sess"));
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (initialDraft.messages && initialDraft.messages.length > 0) {
      return initialDraft.messages;
    }
    return [];
  });

  const [freeformText] = useState(initialDraft.freeformText);
  const [structuredExamples] = useState<StructuredExample[]>(initialDraft.structuredExamples || []);

  const savedPromptsStore = useStore(savedPromptsService.savedPromptsManager);
  const savedPrompts = savedPromptsStore.items;

  // Backwards compatibility for setSavedPrompts (must ideally only be modified through the manager)
  const setSavedPrompts = useCallback((promptsOrUpdater: React.SetStateAction<SavedPrompt[]>) => {
      const nextPrompts = typeof promptsOrUpdater === 'function' ? promptsOrUpdater(savedPrompts) : promptsOrUpdater;
      savedPromptsService.savedPromptsManager.collection.save(nextPrompts);
  }, [savedPrompts, savedPromptsService]);

  const handleStartNewChat = useCallback((onStopStream?: () => void) => {
    if (onStopStream) {
      onStopStream();
    }
    const newSessionId = idGenerator.generate("sess");
    setCurrentSessionId(newSessionId);
    setMessages([]);
  }, [idGenerator]);

  const handleSaveCurrentPrompt = useCallback((title: string) => {
    const newSaved: SavedPrompt = {
      id: idGenerator.generate("saved"),
      title,
      type: promptType,
      config: { ...config },
      messages: [...messages],
      updatedAt: timeProvider.now(),
      projectId: activeProject?.id,
    };
    savedPromptsService.savedPromptsManager.collection.upsert(newSaved, true);
    void firestoreSyncService?.syncSavedPrompt(newSaved)?.catch((err) => {
      logger.warn("Background saved prompt sync failed:", err);
    });
  }, [promptType, config, messages, activeProject?.id, savedPromptsService, firestoreSyncService, idGenerator, timeProvider, logger]);

  const handleDeleteSavedPrompt = useCallback((id: string) => {
    savedPromptsService.savedPromptsManager.collection.delete(id);
    void firestoreSyncService?.deleteSavedPrompt(id)?.catch((err) => {
      logger.warn("Background saved prompt delete sync failed:", err);
    });
  }, [savedPromptsService, firestoreSyncService, logger]);

  const handleBulkDeleteSavedPrompts = useCallback((ids: string[]) => {
    savedPromptsService.savedPromptsManager.collection.bulkDelete(ids);
    promptTemplateService.bulkDeleteCustomTemplates(ids);
    ids.forEach((id) => {
      void firestoreSyncService?.deleteSavedPrompt(id)?.catch((err) => {
        logger.warn("Background bulk prompt delete sync failed:", err);
      });
    });
  }, [promptTemplateService, savedPromptsService, firestoreSyncService, logger]);

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

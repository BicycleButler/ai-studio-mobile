import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Search,
  Plus,
  Edit3,
  Trash2,
  Check,
  Code,
  Brain,
  MessageSquare,
  FileCode,
  ShieldCheck,
  Layers,
  ArrowRight,
  ArrowLeft,
  Eye,
  SlidersHorizontal,
  Columns2,
  Variable,
} from "lucide-react";
import { PromptTemplate, PromptTemplateCategory } from "../types";
import {
  getAllTemplates,
  saveCustomTemplate,
  deleteCustomTemplate,
  composePrompt,
} from "../services/promptTemplateService";
import { FewShotBuilderTool } from "./prompt-tools/FewShotBuilderTool";
import { VariablePromptTool } from "./prompt-tools/VariablePromptTool";
import { useBackNavigation } from "../hooks/useBackNavigation";
import { safeAddEventListener } from "../utils/platform";

interface PromptTemplateDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTemplateIds: string[];
  onToggleTemplate: (templateId: string) => void;
  onRemoveTemplate: (templateId: string) => void;
  onClearAllTemplates: () => void;
  draftUserText?: string;
  onInsertText?: (text: string) => void;
}

const CATEGORY_META: Record<
  PromptTemplateCategory,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  tone: {
    label: "Tone",
    icon: MessageSquare,
    color: "text-primary bg-primary/10 border-primary/20",
  },
  coding: {
    label: "Coding",
    icon: Code,
    color: "text-primary bg-primary/10 border-primary/20",
  },
  reasoning: {
    label: "Reasoning",
    icon: Brain,
    color: "text-primary bg-primary/10 border-primary/20",
  },
  formatting: {
    label: "Formatting",
    icon: FileCode,
    color: "text-primary bg-primary/10 border-primary/20",
  },
  analysis: {
    label: "Analysis",
    icon: ShieldCheck,
    color: "text-primary bg-primary/10 border-primary/20",
  },
  custom: {
    label: "Custom",
    icon: Edit3,
    color: "text-primary bg-primary/10 border-primary/20",
  },
};

const CATEGORIES: Array<{ id: "all" | PromptTemplateCategory; label: string }> = [
  { id: "all", label: "All" },
  { id: "tone", label: "Tone" },
  { id: "coding", label: "Coding" },
  { id: "reasoning", label: "Reasoning" },
  { id: "formatting", label: "Formatting" },
  { id: "analysis", label: "Analysis" },
  { id: "custom", label: "Custom" },
];

export const PromptTemplateDrawer: React.FC<PromptTemplateDrawerProps> = ({
  isOpen,
  onClose,
  selectedTemplateIds,
  onToggleTemplate,
  onRemoveTemplate,
  onClearAllTemplates,
  draftUserText = "",
  onInsertText,
}) => {
  // Enable device/browser back navigation to dismiss drawer smoothly
  useBackNavigation(isOpen, onClose, "prompt-templates-drawer");

  // Keyboard Escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    const removeKey = safeAddEventListener("keydown", handleKeyDown);
    return () => removeKey();
  }, [isOpen, onClose]);

  const [activeToolTab, setActiveToolTab] = useState<"directives" | "few-shot" | "variables">("directives");
  const [activeCategory, setActiveCategory] = useState<"all" | PromptTemplateCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"browse" | "author" | "preview">("browse");
  const [templatesVersion, setTemplatesVersion] = useState(0);

  // Authoring Form State
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState<PromptTemplateCategory>("custom");
  const [formDescription, setFormDescription] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Confirmation state for deletion
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const allTemplates = useMemo(() => {
    // templatesVersion trigger re-fetch when custom templates are added/deleted/edited
    void templatesVersion;
    return getAllTemplates();
  }, [templatesVersion]);

  const filteredTemplates = useMemo(() => {
    return allTemplates.filter((t) => {
      const matchesCategory =
        activeCategory === "all" ||
        (activeCategory === "custom" ? !t.isBuiltin : t.category === activeCategory);

      if (!matchesCategory) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        t.content.toLowerCase().includes(q)
      );
    });
  }, [allTemplates, activeCategory, searchQuery]);

  const selectedTemplates = useMemo(() => {
    const map = new Map<string, PromptTemplate>();
    allTemplates.forEach((t) => map.set(t.id, t));
    return selectedTemplateIds
      .map((id) => map.get(id))
      .filter((t): t is PromptTemplate => Boolean(t));
  }, [allTemplates, selectedTemplateIds]);

  const previewComposition = useMemo(() => {
    return composePrompt(selectedTemplateIds, draftUserText || "Your handwritten query will appear here...");
  }, [selectedTemplateIds, draftUserText]);

  if (!isOpen) return null;

  const handleStartCreate = () => {
    setEditingTemplateId(null);
    setFormTitle("");
    setFormCategory("custom");
    setFormDescription("");
    setFormContent("");
    setFormError(null);
    setViewMode("author");
  };

  const handleStartEdit = (template: PromptTemplate) => {
    setEditingTemplateId(template.id);
    setFormTitle(template.title);
    setFormCategory(template.category);
    setFormDescription(template.description || "");
    setFormContent(template.content);
    setFormError(null);
    setViewMode("author");
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formTitle.trim()) {
      setFormError("Please enter a template title.");
      return;
    }
    if (!formContent.trim()) {
      setFormError("Please enter the template prompt directive content.");
      return;
    }

    try {
      saveCustomTemplate({
        id: editingTemplateId || undefined,
        title: formTitle,
        category: formCategory,
        description: formDescription,
        content: formContent,
      });

      setTemplatesVersion((v) => v + 1);
      setViewMode("browse");
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to save template");
    }
  };

  const handleDelete = (id: string) => {
    deleteCustomTemplate(id);
    onRemoveTemplate(id);
    setConfirmDeleteId(null);
    setTemplatesVersion((v) => v + 1);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="prompt-templates-backdrop"
          id="prompt-templates-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.26, ease: "easeOut" }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onClose();
            }
          }}
        >
          <motion.div
            key="prompt-templates-drawer-dialog"
            id="prompt-templates-drawer-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Prompt Templates drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 1.26, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-0 z-50 w-full h-full h-[100dvh] bg-background border-none shadow-2xl flex flex-col overflow-hidden text-foreground"
          >
      {/* Mobile Drawer Header */}
      <div className="h-14 px-4 bg-card border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <button
            type="button"
            id="template-drawer-back-btn"
            onClick={onClose}
            className="p-2 -ml-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer flex items-center gap-1.5 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-w-11 min-h-11"
            title="Close drawer"
            aria-label="Back / Close drawer"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-xs font-semibold sm:inline hidden">Back</span>
          </button>
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            {activeToolTab === "few-shot" ? (
              <Columns2 className="w-4 h-4" />
            ) : activeToolTab === "variables" ? (
              <Variable className="w-4 h-4" />
            ) : (
              <Layers className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span>
                {activeToolTab === "few-shot"
                  ? "Few-Shot Builder"
                  : activeToolTab === "variables"
                  ? "Variable Templates"
                  : "Prompt Templates"}
              </span>
            </h2>
            <p className="text-[11px] text-muted-foreground truncate">
              {activeToolTab === "few-shot"
                ? "Define input-output demonstration pairs for in-context learning"
                : activeToolTab === "variables"
                ? "Fill {{placeholders}} into prompt skeletons and insert into chat"
                : viewMode === "author"
                ? editingTemplateId
                  ? "Edit custom template"
                  : "Create new modular prompt directive"
                : viewMode === "preview"
                ? "Preview composite prompt output"
                : "Select modular prompt directives (FIFO order)"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {activeToolTab === "directives" && (
            <>
              {viewMode === "browse" ? (
                <>
                  <button
                    type="button"
                    id="template-drawer-create-btn"
                    onClick={handleStartCreate}
                    className="min-h-11 px-3 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer touch-manipulation"
                    title="Create custom template"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">New</span>
                  </button>
                  {selectedTemplateIds.length > 0 && (
                    <button
                      type="button"
                      id="template-drawer-preview-toggle-btn"
                      onClick={() => setViewMode("preview")}
                      className="min-h-11 px-3 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer touch-manipulation"
                      title="Preview composite message"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Preview</span>
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setViewMode("browse")}
                  className="min-h-11 px-3 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-medium transition-colors cursor-pointer touch-manipulation"
                >
                  Back to list
                </button>
              )}
            </>
          )}

          <button
            type="button"
            id="template-drawer-close-btn"
            onClick={onClose}
            className="w-11 h-11 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title="Close drawer"
            aria-label="Close templates drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Sub-tool Segmented Tabs (Directives, Few-Shot Builder, Variables) */}
      <div className="px-4 py-2 bg-card/60 border-b border-border flex items-center justify-center shrink-0">
        <div className="inline-flex items-center bg-muted/60 p-1 rounded-xl text-xs font-medium border border-border/40 max-w-sm w-full">
          <button
            type="button"
            id="tab-prompt-directives"
            onClick={() => setActiveToolTab("directives")}
            className={`flex-1 py-1 px-2.5 rounded-lg transition-colors text-center flex items-center justify-center gap-1.5 cursor-pointer ${
              activeToolTab === "directives"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Directives</span>
          </button>
          <button
            type="button"
            id="tab-prompt-few-shot"
            onClick={() => setActiveToolTab("few-shot")}
            className={`flex-1 py-1 px-2.5 rounded-lg transition-colors text-center flex items-center justify-center gap-1.5 cursor-pointer ${
              activeToolTab === "few-shot"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span>Few-Shot</span>
          </button>
          <button
            type="button"
            id="tab-prompt-variables"
            onClick={() => setActiveToolTab("variables")}
            className={`flex-1 py-1 px-2.5 rounded-lg transition-colors text-center flex items-center justify-center gap-1.5 cursor-pointer ${
              activeToolTab === "variables"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Variable className="w-3.5 h-3.5" />
            <span>Variables</span>
          </button>
        </div>
      </div>

      {/* Main Drawer Body */}
      {activeToolTab === "few-shot" ? (
        <FewShotBuilderTool
          onInsertText={(text) => {
            onInsertText?.(text);
            onClose();
          }}
        />
      ) : activeToolTab === "variables" ? (
        <VariablePromptTool
          onInsertText={(text) => {
            onInsertText?.(text);
            onClose();
          }}
        />
      ) : (
      <div className="flex-1 overflow-hidden flex flex-col">
        {viewMode === "author" ? (
          /* Custom Template Authoring Form */
          <div className="flex-1 overflow-y-auto p-4 max-w-xl mx-auto w-full">
            <form onSubmit={handleSaveForm} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-muted/40 border border-destructive/30 text-destructive text-xs">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Template Title <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  id="template-form-title-input"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g., Senior Security Auditor, Kotlin Compose Expert..."
                  className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Category
                  </label>
                  <select
                    id="template-form-category-select"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as PromptTemplateCategory)}
                    className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs sm:text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  >
                    <option value="coding">Coding</option>
                    <option value="reasoning">Reasoning</option>
                    <option value="tone">Tone</option>
                    <option value="formatting">Formatting</option>
                    <option value="analysis">Analysis</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Description <span className="text-muted-foreground font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    id="template-form-desc-input"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Brief description of what this template instructs"
                    className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Prompt Directive Content <span className="text-destructive">*</span>
                </label>
                <textarea
                  id="template-form-content-input"
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Enter the prompt instruction that will be prepended to the user's message..."
                  rows={6}
                  className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-y"
                  required
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  This directive is prepended to the user&apos;s message with double-newline separation.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  id="template-form-cancel-btn"
                  onClick={() => setViewMode("browse")}
                  className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="template-form-save-btn"
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs active:scale-95 transition-colors cursor-pointer"
                >
                  {editingTemplateId ? "Save Changes" : "Create Template"}
                </button>
              </div>
            </form>
          </div>
        ) : viewMode === "preview" ? (
          /* Live Composition Preview */
          <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full space-y-4">
            <div className="p-3 rounded-2xl bg-card border border-border">
              <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center justify-between">
                <span>Selected Sequence (Strict FIFO)</span>
                <span className="text-[11px] text-muted-foreground font-normal">
                  Dismiss to reorder
                </span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {selectedTemplates.map((t, idx) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-primary/10 border border-primary/20 text-foreground text-xs"
                  >
                    <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-mono font-bold flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <span className="font-medium">{t.title}</span>
                    <button
                      type="button"
                      onClick={() => onRemoveTemplate(t.id)}
                      className="text-muted-foreground hover:text-destructive p-0.5 rounded cursor-pointer"
                      title="Dismiss from sequence"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-card border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-primary" />
                  <span>Full Composed Prompt Sent to Gemini</span>
                </span>
                <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">
                  Double-Newline Format
                </span>
              </div>
              <div className="p-3 rounded-xl bg-muted/60 border border-border font-mono text-xs text-foreground whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                {previewComposition.combinedText}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={onClearAllTemplates}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
              >
                Clear all selected templates
              </button>
              <button
                type="button"
                id="template-preview-done-btn"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs active:scale-95 transition-colors cursor-pointer"
              >
                Done & Return to Chat
              </button>
            </div>
          </div>
        ) : (
          /* Browse Templates Mode */
          <>
            {/* Search & Category Filter Bar */}
            <div className="p-3 bg-card border-b border-border space-y-2 shrink-0">
              {/* Search input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  id="template-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search templates by title or keywords..."
                  className="w-full pl-8 pr-8 py-1.5 rounded-xl bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Category Segmented Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar touch-pan-x overscroll-x-contain">
                {CATEGORIES.map((cat) => {
                  const isActive = activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveCategory(cat.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Template Cards List */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 max-w-3xl mx-auto w-full">
              {filteredTemplates.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <SlidersHorizontal className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs font-medium text-foreground">No templates found</p>
                  <p className="text-[11px] mt-1">
                    Try adjusting your search query or create a new custom template.
                  </p>
                  <button
                    type="button"
                    onClick={handleStartCreate}
                    className="mt-3 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Custom Template</span>
                  </button>
                </div>
              ) : (
                filteredTemplates.map((template) => {
                  const selectedIndex = selectedTemplateIds.indexOf(template.id);
                  const isSelected = selectedIndex !== -1;
                  const meta = CATEGORY_META[template.category] || CATEGORY_META.custom;
                  const Icon = meta.icon;

                  return (
                    <div
                      key={template.id}
                      id={`template-card-${template.id}`}
                      className={`p-3.5 rounded-2xl border transition-colors ${
                        isSelected
                          ? "bg-primary/5 border-primary/40 shadow-xs"
                          : "bg-card border-border hover:border-border/80"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          {/* Numbered Indicator for FIFO Order (Decision Question 2) */}
                          {isSelected ? (
                            <span
                              className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-mono font-bold flex items-center gap-1"
                              title={`Applied in position #${selectedIndex + 1}`}
                            >
                              #{selectedIndex + 1}
                            </span>
                          ) : null}

                          <h4 className="text-xs sm:text-sm font-semibold text-foreground truncate">
                            {template.title}
                          </h4>

                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium border flex items-center gap-1 ${meta.color}`}
                          >
                            <Icon className="w-2.5 h-2.5" />
                            <span>{meta.label}</span>
                          </span>

                          {template.isBuiltin && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-mono">
                              Built-in
                            </span>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          {!template.isBuiltin && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleStartEdit(template)}
                                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                title="Edit custom template"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(template.id)}
                                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted/40 transition-colors cursor-pointer"
                                title="Delete custom template"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {/* Toggle selection button */}
                          <button
                            type="button"
                            id={`toggle-template-${template.id}`}
                            onClick={() => onToggleTemplate(template.id)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                              isSelected
                                ? "bg-primary text-primary-foreground shadow-xs active:scale-95"
                                : "bg-muted hover:bg-muted/80 text-foreground border border-border active:scale-95"
                            }`}
                          >
                            {isSelected ? (
                              <>
                                <Check className="w-3 h-3 stroke-[2.5]" />
                                <span>Applied</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3 h-3" />
                                <span>Apply</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Description if present */}
                      {template.description && (
                        <p className="text-[11px] text-muted-foreground mb-2">
                          {template.description}
                        </p>
                      )}

                      {/* Content snippet */}
                      <div className="p-2 rounded-xl bg-muted/40 border border-border/60 text-[11px] font-mono text-muted-foreground line-clamp-3 select-all">
                        {template.content}
                      </div>

                      {/* Delete confirmation banner */}
                      {confirmDeleteId === template.id && (
                        <div className="mt-2 p-2 rounded-xl bg-muted/40 border border-destructive/20 flex items-center justify-between gap-2 animate-in fade-in">
                          <span className="text-[11px] text-destructive font-medium">
                            Delete &ldquo;{template.title}&rdquo;?
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-0.5 rounded text-[11px] bg-muted text-foreground cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(template.id)}
                              className="px-2 py-0.5 rounded text-[11px] bg-destructive text-destructive-foreground font-semibold cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
      )}

      {/* Mobile Drawer Bottom Dock */}
      {activeToolTab === "directives" && viewMode === "browse" && (
        <div className="p-3 bg-card border-t border-border flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {selectedTemplateIds.length > 0 ? (
              <div className="text-xs text-foreground truncate">
                <span className="font-semibold text-primary">{selectedTemplateIds.length}</span>{" "}
                directive{selectedTemplateIds.length > 1 ? "s" : ""} applied in FIFO order
              </div>
            ) : (
              <div className="text-xs text-muted-foreground truncate">
                No templates applied to draft
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {selectedTemplateIds.length > 0 && (
              <button
                type="button"
                id="template-clear-selection-btn"
                onClick={onClearAllTemplates}
                className="px-2.5 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground text-xs font-medium transition-colors cursor-pointer"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              id="template-done-btn"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs flex items-center gap-1 transition-colors cursor-pointer active:scale-95"
            >
              <span>Done</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

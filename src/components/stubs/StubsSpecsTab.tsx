import React, { useMemo, useState } from "react";
import {
  Copy,
  Check,
  Save,
  Hammer,
  RefreshCw,
  FileText,
  Code2,
  Eye,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { StubsSidecarSpec, StubsSpecCategory } from "../../types/stubs";

export interface StubsSpecsTabProps {
  specs: StubsSidecarSpec[];
  selectedSpecId: string | null;
  specContent: string;
  isLoadingSpecDetail: boolean;
  isSavingSpec: boolean;
  isMaterializingSpec: boolean;
  isSandingSpec: boolean;
  onSelectSpec: (id: string) => void;
  onChangeSpecContent: (content: string) => void;
  onSaveSpec: () => void;
  onMaterializeSpec: () => void;
  onSandSpec: () => void;
  copiedSpecId: string | null;
  onCopySpec: (id: string, text: string) => void;
}

const CATEGORY_TABS: Array<{ id: "all" | StubsSpecCategory; label: string }> = [
  { id: "all", label: "All" },
  { id: "sidecar", label: "Sidecars" },
  { id: "planning", label: "Planning" },
  { id: "context-map", label: "Context Maps" },
];

export const StubsSpecsTab: React.FC<StubsSpecsTabProps> = ({
  specs,
  selectedSpecId,
  specContent,
  isLoadingSpecDetail,
  isSavingSpec,
  isMaterializingSpec,
  isSandingSpec,
  onSelectSpec,
  onChangeSpecContent,
  onSaveSpec,
  onMaterializeSpec,
  onSandSpec,
  copiedSpecId,
  onCopySpec,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<"all" | StubsSpecCategory>("all");
  const [viewMode, setViewMode] = useState<"preview" | "edit">("preview");

  const filteredSpecs = useMemo(() => {
    if (categoryFilter === "all") return specs;
    return specs.filter((s) => s.category === categoryFilter);
  }, [specs, categoryFilter]);

  if (!specs || specs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground animate-in fade-in duration-150">
        <FileText className="w-9 h-9 mb-3 opacity-30" />
        <p className="text-sm">No sidecar specs, planning initiatives, or context maps found.</p>
      </div>
    );
  }

  const activeSpec = specs.find((s) => s.path === selectedSpecId) || filteredSpecs[0] || specs[0];
  const isSidecar = activeSpec?.category === "sidecar";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 max-w-7xl mx-auto h-full min-h-[580px] animate-in fade-in duration-150">
      {/* Left Specs & Planning Master List (4 cols) */}
      <div className="lg:col-span-4 rounded-xl bg-card border border-border flex flex-col overflow-hidden max-h-[640px]">
        <div className="p-3 border-b border-border bg-muted/30 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              Specs, Plans & Context Maps
            </span>
            <span className="text-xs font-mono tabular-nums text-muted-foreground">
              {filteredSpecs.length} / {specs.length}
            </span>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategoryFilter(tab.id)}
                className={`px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  categoryFilter === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-2 space-y-1">
          {filteredSpecs.map((spec) => {
            const isActive = activeSpec?.path === spec.path;
            return (
              <button
                key={spec.path}
                type="button"
                onClick={() => onSelectSpec(spec.path)}
                className={`w-full text-start px-3 py-2.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  isActive
                    ? "bg-primary/10 text-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-semibold text-foreground truncate">{spec.title}</span>
                  {spec.checklistProgress && (
                    <span className="text-[11px] font-mono tabular-nums text-muted-foreground shrink-0">
                      {spec.checklistProgress.completed}/{spec.checklistProgress.total}
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-mono text-muted-foreground truncate">
                  {spec.targetCodeFile || spec.path}
                </div>
                <div className="text-[11px] text-muted-foreground/80 mt-0.5 truncate">
                  {spec.category}
                  {spec.phase ? ` · phase:${spec.phase}` : ""}
                  {spec.driftStatus ? ` · ${spec.driftStatus}` : ""}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Detail Viewer / Editor (8 cols) */}
      <div className="lg:col-span-8 rounded-xl bg-card border border-border flex flex-col overflow-hidden min-h-[460px] max-h-[640px]">
        {activeSpec ? (
          <>
            <div className="p-3 border-b border-border bg-muted/30 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-semibold text-foreground truncate">
                  {activeSpec.title}
                </span>
                <span className="text-[11px] font-mono text-muted-foreground truncate">
                  {activeSpec.path}
                  {activeSpec.targetCodeFile ? ` → ${activeSpec.targetCodeFile}` : ""}
                  {activeSpec.driftStatus ? ` · ${activeSpec.driftStatus}` : ""}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                {/* View / Edit Switch */}
                <div className="flex bg-background p-0.5 rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => setViewMode("preview")}
                    className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                      viewMode === "preview"
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Eye className="w-3 h-3" />
                    <span>Preview</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("edit")}
                    className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                      viewMode === "edit"
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Code2 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                </div>

                {viewMode === "edit" && (
                  <button
                    type="button"
                    onClick={onSaveSpec}
                    disabled={isSavingSpec}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="w-3 h-3" />
                    <span>{isSavingSpec ? "Saving..." : "Save"}</span>
                  </button>
                )}

                {isSidecar && (
                  <>
                    <button
                      type="button"
                      onClick={onSandSpec}
                      disabled={isSandingSpec || !activeSpec.targetExists}
                      title="Reconcile sidecar AST hash and frontmatter with target code (stubs sand)"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-background border border-border hover:bg-muted text-[11px] font-medium text-foreground transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSandingSpec ? "animate-spin" : ""}`} />
                      <span>{isSandingSpec ? "Sanding..." : "Sand"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={onMaterializeSpec}
                      disabled={isMaterializingSpec}
                      title="Materialize embedded TypeScript code block into target file"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-background border border-border hover:bg-muted text-[11px] font-medium text-foreground transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <Hammer className="w-3 h-3" />
                      <span>{isMaterializingSpec ? "Writing..." : "Materialize"}</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => onCopySpec(activeSpec.path, specContent)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-background border border-border hover:bg-muted text-[11px] font-medium text-foreground transition-colors cursor-pointer"
                  title="Copy Specification Markdown"
                >
                  {copiedSpecId === activeSpec.path ? (
                    <>
                      <Check className="w-3 h-3 text-primary" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-background">
              {isLoadingSpecDetail ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Loading specification content...
                </div>
              ) : viewMode === "edit" ? (
                <textarea
                  value={specContent}
                  onChange={(e) => onChangeSpecContent(e.target.value)}
                  spellCheck={false}
                  className="w-full h-full min-h-[420px] p-4 bg-background text-foreground font-mono text-xs leading-relaxed focus:outline-none resize-none"
                />
              ) : (
                <div className="p-4 md:p-6 text-xs sm:text-sm text-foreground space-y-3 leading-relaxed [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:mt-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-4 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:bg-card [&_pre]:border [&_pre]:border-border [&_pre]:overflow-x-auto [&_pre]:text-xs [&_code]:font-mono [&_ul]:list-disc [&_ul]:ps-5 [&_ol]:list-decimal [&_ol]:ps-5 [&_table]:w-full [&_table]:border-collapse [&_th]:text-start [&_th]:p-2 [&_th]:border-b [&_th]:border-border [&_td]:p-2 [&_td]:border-b [&_td]:border-border/50">
                  <ReactMarkdown>{specContent || "No content available."}</ReactMarkdown>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Select a document to view or edit.
          </div>
        )}
      </div>
    </div>
  );
};

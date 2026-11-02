import React, { useState } from "react";
import { Plus, Trash2, Sparkles, RotateCcw } from "lucide-react";
import { PromptToolActionDock } from "./PromptToolActionDock";
import { StructuredExample } from "../../types";

interface FewShotBuilderToolProps {
  onInsertText?: (text: string) => void;
}

const PRESETS: Array<{
  name: string;
  description: string;
  examples: StructuredExample[];
}> = [
  {
    name: "Sentiment & Topic JSON",
    description: "Extract structured telemetry from user reviews",
    examples: [
      {
        id: "p1-1",
        input: "The battery lasts only 2 hours and gets hot during fast charge.",
        output: '{"sentiment": "negative", "topic": "battery", "urgency": "high"}',
      },
      {
        id: "p1-2",
        input: "Fast shipping and the screen quality is fantastic!",
        output: '{"sentiment": "positive", "topic": "screen", "urgency": "low"}',
      },
    ],
  },
  {
    name: "Customer Intent Classifier",
    description: "Classify incoming tickets into routing departments",
    examples: [
      {
        id: "p2-1",
        input: "I was double charged on my March invoice.",
        output: "DEPARTMENT: Billing | ACTION: RefundReview | PRIORITY: P1",
      },
      {
        id: "p2-2",
        input: "Can I invite 5 teammates on the Pro plan?",
        output: "DEPARTMENT: Sales | ACTION: PlanInquiry | PRIORITY: P3",
      },
    ],
  },
  {
    name: "Natural Language to SQL",
    description: "Few-shot translation into PostgreSQL queries",
    examples: [
      {
        id: "p3-1",
        input: "Find the top 5 customers with the highest lifetime spend.",
        output: "SELECT customer_id, name, total_spend FROM customers ORDER BY total_spend DESC LIMIT 5;",
      },
      {
        id: "p3-2",
        input: "Count how many users signed up last week.",
        output: "SELECT count(*) FROM users WHERE created_at >= NOW() - INTERVAL '7 days';",
      },
    ],
  },
];

export const FewShotBuilderTool: React.FC<FewShotBuilderToolProps> = ({ onInsertText }) => {
  const { clipboardService, platformService } = useServices();
  const [examples, setExamples] = useState<StructuredExample[]>([]);
  const [testInput, setTestInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [inserted, setInserted] = useState(false);

  const handleAddExample = () => {
    setExamples((prev) => [
      ...prev,
      {
        id: idGenerator.generate("ex"),
        input: "",
        output: "",
      },
    ]);
  };

  const handleUpdateExample = (id: string, field: "input" | "output", value: string) => {
    setExamples((prev) =>
      prev.map((ex) => (ex.id === id ? { ...ex, [field]: value } : ex))
    );
  };

  const handleRemoveExample = (id: string) => {
    setExamples((prev) => prev.filter((ex) => ex.id !== id));
  };

  const handleLoadPreset = (preset: typeof PRESETS[0]) => {
    setExamples(preset.examples.map((ex) => ({ ...ex, id: idGenerator.generate("ex") })));
  };

  const formatFewShotPrompt = (): string => {
    const lines: string[] = ["Please follow these examples carefully:\n"];
    examples.forEach((ex, idx) => {
      lines.push(`Example ${idx + 1}:`);
      lines.push(`Input: ${ex.input.trim()}`);
      lines.push(`Output: ${ex.output.trim()}\n`);
    });
    if (testInput.trim()) {
      lines.push(`Input: ${testInput.trim()}`);
      lines.push("Output:");
    }
    return lines.join("\n").trim();
  };

  const handleCopy = async () => {
    const formatted = formatFewShotPrompt();
    await clipboardService.writeText(formatted);
    setCopied(true);
    platformService.setTimeout(() => setCopied(false), 1800);
  };

  const handleInsert = () => {
    const formatted = formatFewShotPrompt();
    if (onInsertText) {
      onInsertText(formatted);
      setInserted(true);
      platformService.setTimeout(() => setInserted(false), 1800);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-2xl mx-auto w-full">
      {/* Intro Banner */}
      <div className="p-3.5 rounded-xl bg-muted/40 border border-border flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-semibold text-foreground">Few-Shot Prompt Builder</h3>
          </div>
          <button
            type="button"
            onClick={() => setExamples([])}
            className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
            title="Clear all examples"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Few-shot demonstrations guide the model to match strict schemas, domain tones, or classification labels with zero hallucination.
        </p>

        {/* Quick Presets */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider self-center me-1">
            Presets:
          </span>
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => handleLoadPreset(preset)}
              className="px-2 py-1 rounded-lg bg-background hover:bg-muted text-[11px] font-medium text-foreground border border-border transition-colors cursor-pointer"
              title={preset.description}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Examples List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">
            Demonstration Pairs ({examples.length})
          </span>
          <button
            type="button"
            onClick={handleAddExample}
            className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Pair</span>
          </button>
        </div>

        {examples.length === 0 ? (
          <div className="p-6 text-center border border-dashed border-border rounded-xl text-muted-foreground text-xs">
            No examples defined. Click &ldquo;Add Pair&rdquo; or select a preset above.
          </div>
        ) : (
          examples.map((ex, idx) => (
            <div
              key={ex.id}
              className="p-3 rounded-xl bg-card border border-border space-y-2 relative group shadow-xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-medium text-primary">
                  Pair #{idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveExample(ex.id)}
                  className="w-6 h-6 rounded-md hover:bg-muted/40 text-muted-foreground hover:text-destructive flex items-center justify-center transition-colors cursor-pointer"
                  title="Remove example"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono text-muted-foreground mb-1">
                  Input
                </label>
                <textarea
                  value={ex.input}
                  onChange={(e) => handleUpdateExample(ex.id, "input", e.target.value)}
                  placeholder="Enter sample input query or text..."
                  rows={2}
                  className="w-full text-xs p-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary resize-none font-sans"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono text-muted-foreground mb-1">
                  Target Output
                </label>
                <textarea
                  value={ex.output}
                  onChange={(e) => handleUpdateExample(ex.id, "output", e.target.value)}
                  placeholder="Enter expected model response..."
                  rows={2}
                  className="w-full text-xs p-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary resize-none font-mono"
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Target Input Box */}
      <div className="p-3 rounded-xl bg-card border border-border space-y-1.5 shadow-xs">
        <label className="block text-xs font-semibold text-foreground">
          Target Query to Solve (Optional)
        </label>
        <p className="text-[11px] text-muted-foreground">
          Appended at the end of the few-shot demonstrations for the model to answer.
        </p>
        <textarea
          value={testInput}
          onChange={(e) => setTestInput(e.target.value)}
          placeholder="e.g., The camera lens arrived cracked and support has not responded."
          rows={2}
          className="w-full text-xs p-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary resize-none font-sans"
        />
      </div>

      {/* Live Formatted Preview & Action Dock */}
      <PromptToolActionDock
        onCopy={handleCopy}
        hasCopied={copied}
        onInsert={onInsertText ? handleInsert : undefined}
        hasInserted={inserted}
        previewContent={formatFewShotPrompt()}
      />
    </div>
  );
};

import React, { useState, useMemo } from "react";
import { Variable, Copy, Check, Send, PlusCircle } from "lucide-react";

interface VariablePromptToolProps {
  onInsertText?: (text: string) => void;
}

interface PresetItem {
  name: string;
  template: string;
  defaults: Record<string, string>;
}

const PRESETS: PresetItem[] = [
  {
    name: "Localization & Tone",
    template:
      "Translate the following product description into {{language}} for {{audience}} with a {{tone}} tone:\n\n{{description}}\n\nHighlight 3 key bullet points.",
    defaults: {
      language: "Spanish",
      audience: "college students",
      tone: "energetic & playful",
      description: "Ultra-compact noise canceling earbuds with 36-hour battery and wireless fast charging.",
    },
  },
  {
    name: "Code Security Audit",
    template:
      "Audit the following {{language}} code for {{security_issue}} vulnerabilities and propose a safer refactor:\n\n```{{language}}\n{{code}}\n```\n\nExplain the exploit vector clearly.",
    defaults: {
      language: "TypeScript",
      security_issue: "SQL injection & XSS",
      code: "const query = `SELECT * FROM users WHERE email = '${req.body.email}'`;",
    },
  },
  {
    name: "Executive Briefing",
    template:
      "Synthesize this {{report_type}} into a crisp briefing for {{executive_role}} in under {{bullet_limit}} bullet points:\n\n{{raw_notes}}",
    defaults: {
      report_type: "Quarterly Incident Retrospective",
      executive_role: "VP of Infrastructure",
      bullet_limit: "4",
      raw_notes: "Database primary failed at 14:02 UTC due to disk saturation. Read replica failover took 4.5 minutes. 99.85% uptime maintained. Post-incident root cause was unvacuumed dead tuples.",
    },
  },
];

export const VariablePromptTool: React.FC<VariablePromptToolProps> = ({ onInsertText }) => {
  const [template, setTemplate] = useState<string>("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [inserted, setInserted] = useState(false);

  // Extract all {{variable}} tokens
  const detectedVariables = useMemo(() => {
    const matches = template.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g);
    const set = new Set<string>();
    for (const match of matches) {
      if (match[1]) set.add(match[1]);
    }
    return Array.from(set);
  }, [template]);

  const handleValueChange = (varName: string, val: string) => {
    setValues((prev) => ({ ...prev, [varName]: val }));
  };

  const handleLoadPreset = (preset: PresetItem) => {
    setTemplate(preset.template);
    setValues(preset.defaults);
  };

  const handleInsertTag = (tag: string) => {
    setTemplate((prev) => `${prev} {{${tag}}}`);
  };

  // Interpolate values into template
  const resolvedPrompt = useMemo(() => {
    return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, varName) => {
      const val = values[varName];
      return val !== undefined && val.trim().length > 0 ? val.trim() : match;
    });
  }, [template, values]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(resolvedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleInsert = () => {
    if (onInsertText) {
      onInsertText(resolvedPrompt);
      setInserted(true);
      setTimeout(() => setInserted(false), 1800);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-2xl mx-auto w-full">
      {/* Intro Banner */}
      <div className="p-3.5 rounded-xl bg-muted/40 border border-border flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Variable className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold text-foreground">Variable Prompt Template</h3>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Create reusable prompt skeletons using <code className="text-primary font-mono font-semibold">{"{{variable}}"}</code> tags. Fill in values below for quick substitution into chat.
        </p>

        {/* Quick Presets */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider self-center mr-1">
            Presets:
          </span>
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => handleLoadPreset(preset)}
              className="px-2 py-1 rounded-lg bg-background hover:bg-muted text-[11px] font-medium text-foreground border border-border transition-colors cursor-pointer"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Template Input */}
      <div className="p-3 rounded-xl bg-card border border-border space-y-2 shadow-xs">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-foreground">
            Template Skeleton
          </label>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground font-mono">Insert:</span>
            {["topic", "language", "audience", "tone"].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleInsertTag(tag)}
                className="px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-[10px] font-mono text-foreground border border-border flex items-center gap-0.5 cursor-pointer"
              >
                <PlusCircle className="w-2.5 h-2.5" />
                <span>{tag}</span>
              </button>
            ))}
          </div>
        </div>

        <textarea
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          placeholder="Type a template with {{variable}} placeholders..."
          rows={4}
          className="w-full text-xs p-2.5 rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary font-mono resize-none leading-relaxed"
        />
      </div>

      {/* Variables Form */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">
            Detected Variables ({detectedVariables.length})
          </span>
        </div>

        {detectedVariables.length === 0 ? (
          <div className="p-4 text-center border border-dashed border-border rounded-xl text-muted-foreground text-xs">
            No variables detected. Add <code className="text-primary font-mono">{"{{variable_name}}"}</code> to the template above.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {detectedVariables.map((varName) => (
              <div
                key={varName}
                className="p-2.5 rounded-xl bg-card border border-border space-y-1 shadow-xs"
              >
                <label className="block text-[11px] font-mono font-medium text-primary">
                  {`{{${varName}}}`}
                </label>
                <input
                  type="text"
                  value={values[varName] || ""}
                  onChange={(e) => handleValueChange(varName, e.target.value)}
                  placeholder={`Value for ${varName}...`}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary font-sans"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live Populated Preview & Actions */}
      <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">Populated Prompt Preview</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopy}
              className="px-2.5 py-1 rounded-lg bg-background hover:bg-muted text-foreground border border-border text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
            {onInsertText && (
              <button
                type="button"
                onClick={handleInsert}
                className="px-3 py-1 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-xs active:scale-95"
              >
                {inserted ? <Check className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                <span>{inserted ? "Inserted" : "Insert into Chat"}</span>
              </button>
            )}
          </div>
        </div>

        <pre className="p-2.5 rounded-lg bg-background/80 border border-border/80 text-[11px] font-mono text-foreground whitespace-pre-wrap max-h-44 overflow-y-auto leading-relaxed">
          {resolvedPrompt}
        </pre>
      </div>
    </div>
  );
};

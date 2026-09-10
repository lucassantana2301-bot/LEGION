"use client";

import React from "react";
import { clsx } from "clsx";
import {
  Folder,
  FileCode,
  FileText,
  Layers,
  GitCommit,
  Hash,
  Copy,
  Check,
  Eye,
  FolderOpen,
} from "lucide-react";
import { useMissionRuntimeStore } from "@/stores/mission-runtime-store";

export const CanonicalWorkspaceViewer: React.FC = () => {
  const finalResult = useMissionRuntimeStore((s) => s.finalResult);
  const [selectedFile, setSelectedFile] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  // Extract all files from final canonical workspace or provide fallback demo tree
  const workspace = finalResult?.workspace;
  const rawFiles: Record<string, string> =
    workspace && typeof workspace.getAllFiles === "function"
      ? workspace.getAllFiles()
      : {
          "package.json": JSON.stringify(
            {
              name: "fibonacci-task-pipeline",
              version: "1.0.0",
              scripts: {
                test: "vitest run",
                build: "tsc --noEmit",
              },
              devDependencies: {
                typescript: "^5.0.0",
                vitest: "^2.0.0",
              },
            },
            null,
            2
          ),
          "tsconfig.json": JSON.stringify(
            {
              compilerOptions: {
                target: "ES2022",
                module: "NodeNext",
                strict: true,
                esModuleInterop: true,
              },
              include: ["src/**/*"],
            },
            null,
            2
          ),
          "src/fibonacci.ts": `/**\n * Calculates the nth Fibonacci number efficiently\n */\nexport function calculateFibonacci(n: number): number {\n  if (n < 0) throw new Error("Index cannot be negative");\n  if (n <= 1) return n;\n\n  let a = 0;\n  let b = 1;\n  for (let i = 2; i <= n; i++) {\n    const next = a + b;\n    a = b;\n    b = next;\n  }\n  return b;\n}\n`,
          "src/fibonacci.test.ts": `import { describe, it, expect } from "vitest";\nimport { calculateFibonacci } from "./fibonacci";\n\ndescribe("calculateFibonacci", () => {\n  it("handles base cases correctly", () => {\n    expect(calculateFibonacci(0)).toBe(0);\n    expect(calculateFibonacci(1)).toBe(1);\n  });\n\n  it("computes sequence values", () => {\n    expect(calculateFibonacci(5)).toBe(5);\n    expect(calculateFibonacci(10)).toBe(55);\n  });\n});\n`,
        };

  const fileKeys = Object.keys(rawFiles).sort();
  const activeFile = selectedFile || fileKeys[0] || "";
  const activeContent = rawFiles[activeFile] || "";

  const revision = workspace && typeof workspace.getCurrentRevision === "function" ? workspace.getCurrentRevision() : 3;
  const generation = workspace && typeof workspace.getGenerationId === "function" ? workspace.getGenerationId() : "gen_0190a42f";
  const digest = workspace && typeof workspace.getWorkspaceDigest === "function" ? workspace.getWorkspaceDigest() : "9b8f2191ac28fa4e9912bcde8392a01f562819aef34091";

  const handleCopy = () => {
    if (!activeContent) return;
    navigator.clipboard.writeText(activeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getFileIcon = (path: string) => {
    if (path.endsWith(".ts") || path.endsWith(".tsx") || path.endsWith(".js") || path.endsWith(".json")) {
      return <FileCode className="w-3.5 h-3.5 text-accent" />;
    }
    return <FileText className="w-3.5 h-3.5 text-mutedForeground" />;
  };

  return (
    <div className="bg-surface rounded-xl border border-border p-4 space-y-4 font-mono text-xs shadow-sm">
      {/* Workspace Header Stats */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-accent" />
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Canonical Workspace Snapshot
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded bg-surfaceOverlay text-mutedForeground border border-border">
            {fileKeys.length} Files
          </span>
        </div>

        <div className="flex items-center gap-2 text-[10px] flex-wrap">
          <span className="px-2 py-1 rounded bg-surfaceRaised border border-border text-foreground font-semibold">
            Revision: Rev {revision}
          </span>
          <span className="px-2 py-1 rounded bg-surfaceRaised border border-border text-mutedForeground">
            Gen: <span className="text-accent">{generation}</span>
          </span>
          <span className="px-2 py-1 rounded bg-surfaceRaised border border-border text-mutedForeground max-w-[200px] truncate">
            Digest: <span className="text-success">{digest.slice(0, 12)}...</span>
          </span>
        </div>
      </div>

      {/* Explorer & Code Viewer Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-[460px]">
        {/* Left: Lateral File Tree */}
        <div className="md:col-span-4 bg-surfaceRaised rounded-lg border border-border flex flex-col overflow-hidden">
          <div className="p-2.5 bg-surfaceOverlay/50 border-b border-border text-[11px] font-bold text-mutedForeground uppercase flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5 text-accent" />
            <span>Workspace Tree</span>
          </div>

          <div className="p-2 overflow-y-auto space-y-1 flex-1">
            {fileKeys.map((filePath) => {
              const isSelected = activeFile === filePath;
              return (
                <button
                  key={filePath}
                  onClick={() => setSelectedFile(filePath)}
                  className={clsx(
                    "w-full text-left px-2.5 py-1.5 rounded flex items-center gap-2 text-[11px] transition-all",
                    isSelected
                      ? "bg-accent/15 text-accent font-bold border border-accent/30 shadow-sm"
                      : "text-mutedForeground hover:text-foreground hover:bg-surfaceOverlay"
                  )}
                >
                  {getFileIcon(filePath)}
                  <span className="truncate">{filePath}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Code Viewer */}
        <div className="md:col-span-8 bg-background rounded-lg border border-border flex flex-col overflow-hidden">
          {/* File Tab Header */}
          <div className="px-3 py-2 bg-surfaceRaised border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2 text-foreground font-semibold text-[11px]">
              {getFileIcon(activeFile)}
              <span>{activeFile}</span>
              <span className="text-[10px] text-mutedForeground font-normal">
                ({activeContent.split("\n").length} lines)
              </span>
            </div>

            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-surface border border-border text-mutedForeground hover:text-foreground transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? "Copied" : "Copy Code"}</span>
            </button>
          </div>

          {/* Code Viewer with Line Numbers */}
          <div className="p-3 overflow-y-auto flex-1 font-mono text-[11px] text-foreground leading-relaxed">
            {activeContent.split("\n").map((line, idx) => (
              <div key={idx} className="flex gap-3">
                <span className="w-8 text-right text-mutedForeground/40 select-none shrink-0">
                  {idx + 1}
                </span>
                <span className="whitespace-pre flex-1 text-foreground/90">{line || " "}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// LEGION Phase 09.9 — Real Integrated Workspace QA Gate
// Detects supported validation commands, materializes the full canonical workspace, and executes comprehensive QA validation with zero-bypass enforcement.

import { SandboxProvider, SandboxExecutionResult, verifyTrustedRealCapability, SandboxExecuteOptions } from "../providers/sandbox";
import { CanonicalWorkspace, MaterializationReport } from "./types";
import { CanonicalWorkspaceMaterializer } from "./materializer";
import { ExecutedCommandTelemetry, ExecutionEvidence } from "../agent/evidence";

export type ValidationPurpose = "TYPECHECK" | "TEST" | "BUILD" | "LINT" | "CUSTOM";

export interface IntegratedValidationCommand {
  command: string;
  purpose: ValidationPurpose;
  required: boolean;
  cwd?: string;
  timeoutMs?: number;
}

export interface IntegratedValidationPlan {
  commands: IntegratedValidationCommand[];
  reason: string;
  projectMetadata: {
    hasPackageJson: boolean;
    hasTsConfig: boolean;
    hasPyprojectOrRequirements: boolean;
    packageJsonLocations: string[];
    scripts: Record<string, string>;
  };
}

export interface IntegratedQAOptions {
  workspace: CanonicalWorkspace;
  sandboxProvider: SandboxProvider;
  sandboxId: string;
  timeoutMs?: number;
  customValidationCommands?: string[];
  requireRealExecution?: boolean;
  signal?: AbortSignal;
}

export interface IntegratedQAResult {
  success: boolean;
  validatedRevision: number;
  validatedGeneration: string;
  workspaceDigest: string;
  executionMode: "REAL" | "MOCK" | "UNAVAILABLE";
  error?: string;
  evidence: ExecutionEvidence;
  validationPlan: IntegratedValidationPlan;
  materialization: MaterializationReport;
  durationMs: number;
}

/**
 * Strictly sanitizes and validates execution cwd to prevent shell command injection
 */
export function validateAndSanitizeCwd(cwd?: string): string {
  if (!cwd || cwd === ".") return ".";
  if (typeof cwd !== "string") {
    throw new Error("INVALID_CWD: cwd must be a string");
  }

  // Reject shell injection characters and control characters
  if (/[\x00-\x1f\x7f;&|#$`\n\r]/.test(cwd)) {
    throw new Error(`INVALID_CWD_INJECTION: Directory path "${cwd}" contains invalid shell control or injection characters.`);
  }

  const normalized = cwd.replace(/\\/g, "/");
  const segments: string[] = [];
  for (const s of normalized.split("/")) {
    if (s === "" || s === ".") continue;
    if (s === "..") {
      if (segments.length === 0) {
        throw new Error(`INVALID_CWD_TRAVERSAL: Directory path "${cwd}" escapes workspace root.`);
      }
      segments.pop();
      continue;
    }
    segments.push(s);
  }
  return segments.join("/") || ".";
}

export function isTrivialScript(script: string): boolean {
  if (!script || typeof script !== "string") return true;
  const trimmed = script.trim().toLowerCase().replace(/['";]/g, "").trim();
  if (
    trimmed === "exit 0" ||
    trimmed === "exit 1" ||
    trimmed === "exit" ||
    trimmed === "true" ||
    trimmed === "false" ||
    trimmed === "true && true" ||
    trimmed === "true || true" ||
    trimmed === "true;" ||
    trimmed === ":" ||
    trimmed === "rem" ||
    trimmed === "noop" ||
    trimmed.startsWith("echo ") ||
    trimmed === "echo" ||
    trimmed === "echo 0" ||
    trimmed === "echo 1" ||
    trimmed === "echo ok" ||
    trimmed === "echo pass" ||
    trimmed === "echo test" ||
    trimmed === "echo audited" ||
    trimmed === "echo error: no test specified && exit 1" ||
    trimmed === "echo no test specified && exit 1" ||
    trimmed === "echo error: no test specified" ||
    trimmed === "echo no test specified"
  ) {
    return true;
  }
  return false;
}

/**
 * Intelligently detects project validation capabilities and generates an exact validation plan
 */
export function detectValidationPlan(files: Record<string, string>): IntegratedValidationPlan {
  const normalizedFiles: Record<string, string> = {};
  for (const [p, content] of Object.entries(files)) {
    try {
      const clean = p.replace(/\\/g, "/").replace(/^\/+/, "");
      normalizedFiles[clean] = content;
    } catch {
      // ignore
    }
  }

  const filePaths = Object.keys(normalizedFiles);
  const commands: IntegratedValidationCommand[] = [];
  const reasons: string[] = [];
  const packageJsonLocations: string[] = [];
  let rootScripts: Record<string, string> = {};

  // 1. Locate all package.json files (root and nested monorepo packages)
  const packageJsonPaths = filePaths.filter(
    (p) => p === "package.json" || p.endsWith("/package.json")
  );

  packageJsonPaths.sort((a, b) => a.split("/").length - b.split("/").length); // root first

  for (const pkgPath of packageJsonPaths) {
    const pkgDir = pkgPath === "package.json" ? "." : pkgPath.replace(/\/package\.json$/, "");
    packageJsonLocations.push(pkgDir);

    try {
      const parsed = JSON.parse(normalizedFiles[pkgPath]);
      const scripts = parsed.scripts && typeof parsed.scripts === "object" ? parsed.scripts : {};
      if (pkgDir === ".") {
        rootScripts = scripts;
      }
    } catch {
      // Invalid JSON
    }
  }

  // 2. TypeScript validation across TS, TSX, MTS, CTS (Priority 1)
  const hasTsFiles = filePaths.some(
    (p) =>
      p.endsWith(".ts") ||
      p.endsWith(".tsx") ||
      p.endsWith(".mts") ||
      p.endsWith(".cts")
  );

  const tsConfigs = filePaths.filter(
    (p) =>
      p === "tsconfig.json" ||
      p.endsWith("/tsconfig.json") ||
      p.startsWith("tsconfig.") ||
      p.includes("/tsconfig.") ||
      p.endsWith(".tsconfig.json")
  );

  const hasTsConfig = tsConfigs.length > 0;

  if (hasTsConfig || (hasTsFiles && packageJsonLocations.length > 0)) {
    if (tsConfigs.length > 0) {
      // Sort: root tsconfig.build.json or tsconfig.json first, then nested
      tsConfigs.sort((a, b) => a.split("/").length - b.split("/").length);

      for (const tsConfigPath of tsConfigs) {
        const lastSlash = tsConfigPath.lastIndexOf("/");
        const cwd = lastSlash >= 0 ? tsConfigPath.substring(0, lastSlash) : ".";
        const configFilename = lastSlash >= 0 ? tsConfigPath.substring(lastSlash + 1) : tsConfigPath;

        let hasProjectReferences = false;
        try {
          const content = normalizedFiles[tsConfigPath];
          if (content) {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed.references) && parsed.references.length > 0) {
              hasProjectReferences = true;
            }
          }
        } catch {
          // Ignore JSON parse errors in tsconfig (may have comments)
          if (normalizedFiles[tsConfigPath]?.includes('"references"')) {
            hasProjectReferences = true;
          }
        }

        let cmd: string;
        if (hasProjectReferences) {
          cmd = configFilename === "tsconfig.json"
            ? "npx tsc --build"
            : `npx tsc --build ${configFilename}`;
        } else if (configFilename !== "tsconfig.json") {
          cmd = `npx tsc --noEmit -p ${configFilename}`;
        } else {
          cmd = "npx tsc --noEmit";
        }

        commands.push({
          command: cmd,
          purpose: "TYPECHECK",
          required: true,
          cwd: cwd || ".",
          timeoutMs: 60_000,
        });
        reasons.push(
          hasProjectReferences
            ? `TypeScript Project References config (${tsConfigPath}) detected`
            : `TypeScript config (${tsConfigPath}) detected`
        );
      }
    } else if (hasTsFiles && packageJsonLocations.includes(".")) {
      commands.push({
        command: "npx tsc --noEmit",
        purpose: "TYPECHECK",
        required: true,
        cwd: ".",
        timeoutMs: 60_000,
      });
      reasons.push("TypeScript source files (.ts/.tsx/.mts/.cts) detected");
    }
  }

  // 3. Package tests & builds
  for (const pkgPath of packageJsonPaths) {
    const pkgDir = pkgPath === "package.json" ? "." : pkgPath.replace(/\/package\.json$/, "");
    try {
      const parsed = JSON.parse(normalizedFiles[pkgPath]);
      const scripts = parsed.scripts && typeof parsed.scripts === "object" ? parsed.scripts : {};

      // Test script
      if (scripts.test && typeof scripts.test === "string" && !isTrivialScript(scripts.test)) {
        commands.push({
          command: "npm test",
          purpose: "TEST",
          required: true,
          cwd: pkgDir,
          timeoutMs: 90_000,
        });
        reasons.push(
          pkgDir === "."
            ? `Root package.json test script ("${scripts.test}")`
            : `Package (${pkgDir}) test script ("${scripts.test}")`
        );
      }

      // Build script
      if (scripts.build && typeof scripts.build === "string" && !isTrivialScript(scripts.build)) {
        commands.push({
          command: "npm run build",
          purpose: "BUILD",
          required: true,
          cwd: pkgDir,
          timeoutMs: 120_000,
        });
        reasons.push(
          pkgDir === "."
            ? `Root package.json build script ("${scripts.build}")`
            : `Package (${pkgDir}) build script ("${scripts.build}")`
        );
      }
    } catch {
      // Invalid JSON
    }
  }

  // 4. Python verification (Conservative detection: require actual .py test files or pytest configs)
  const hasPyFiles = filePaths.some((p) => p.endsWith(".py"));
  const hasPyTestFiles = filePaths.some(
    (p) =>
      (p.endsWith(".py") && (p.startsWith("tests/") || p.startsWith("test/") || p.includes("/tests/"))) ||
      p.endsWith("_test.py") ||
      (p.endsWith(".py") && p.split("/").pop()?.startsWith("test_") === true)
  );

  const hasPyTestConfig = filePaths.some(
    (p) =>
      p === "pytest.ini" ||
      p.endsWith("/pytest.ini") ||
      (p === "setup.cfg" && (normalizedFiles[p]?.includes("[tool:pytest]") || normalizedFiles[p]?.includes("[pytest]"))) ||
      (p === "pyproject.toml" && (normalizedFiles[p]?.includes("[tool.pytest") || normalizedFiles[p]?.includes("pytest")))
  );

  if (hasPyFiles && (hasPyTestFiles || hasPyTestConfig)) {
    // Determine python cwd if nested
    const pyTestDir = filePaths.find((p) => p.endsWith("/pytest.ini"))?.replace(/\/pytest\.ini$/, "") || ".";
    commands.push({
      command: "pytest",
      purpose: "TEST",
      required: true,
      cwd: pyTestDir,
      timeoutMs: 60_000,
    });
    reasons.push("Python test files/pytest configuration detected");
  }

  return {
    commands,
    reason: reasons.length > 0 ? reasons.join("; ") : "No automated verification scripts detected for project layout",
    projectMetadata: {
      hasPackageJson: packageJsonLocations.length > 0,
      hasTsConfig,
      hasPyprojectOrRequirements: filePaths.some((p) => p === "requirements.txt" || p === "pyproject.toml"),
      packageJsonLocations,
      scripts: rootScripts,
    },
  };
}

/**
 * Materializes the full workspace and executes the integrated QA verification plan with zero-bypass validation
 */
export async function executeIntegratedQA(options: IntegratedQAOptions): Promise<IntegratedQAResult> {
  const startTime = Date.now();
  const startedAtIso = new Date().toISOString();
  const allFiles = options.workspace.getAllFiles();
  const currentRevision = options.workspace.getCurrentRevision();
  const currentGeneration = options.workspace.getGenerationId();
  const workspaceDigest = options.workspace.getWorkspaceDigest();
  const executionMode = options.sandboxProvider?.executionMode || "UNAVAILABLE";

  const buildFailResult = (errCode: string, errMsg: string): IntegratedQAResult => ({
    success: false,
    validatedRevision: currentRevision,
    validatedGeneration: currentGeneration,
    workspaceDigest,
    executionMode,
    error: `${errCode}: ${errMsg}`,
    evidence: {
      commands: [],
      stdout: "",
      stderr: `${errCode}: ${errMsg}`,
      exitCode: 1,
      modifiedFiles: [],
      sandboxId: options.sandboxId || "none",
      timestamps: { startedAt: startedAtIso, completedAt: new Date().toISOString() },
    },
    validationPlan: {
      commands: [],
      reason: errMsg,
      projectMetadata: {
        hasPackageJson: false,
        hasTsConfig: false,
        hasPyprojectOrRequirements: false,
        packageJsonLocations: [],
        scripts: {},
      },
    },
    materialization: {
      totalFilesWritten: 0,
      files: [],
      deletedFiles: [],
      durationMs: 0,
      sandboxId: options.sandboxId || "none",
    },
    durationMs: Date.now() - startTime,
  });

  // Zero-Bypass Gate 1: Provider presence & authenticity
  if (!options.sandboxProvider) {
    return buildFailResult("NO_REAL_PROVIDER", "No sandbox provider was supplied for integrated QA.");
  }

  if (executionMode === "UNAVAILABLE") {
    return buildFailResult("UNAVAILABLE_PROVIDER", "Sandbox provider is unavailable or cannot execute verification commands.");
  }

  // In production mode (requireRealExecution), only authentic system-stamped providers are permitted
  if (options.requireRealExecution) {
    const isTrusted = verifyTrustedRealCapability(options.sandboxProvider);
    if (!isTrusted || executionMode !== "REAL") {
      return buildFailResult("MOCK_QA_REJECTED", "Mock or untrusted sandbox provider cannot produce production verification evidence.");
    }
  }

  // Zero-Bypass Gate 2: Non-empty canonical workspace
  if (Object.keys(allFiles).length === 0) {
    return buildFailResult("EMPTY_WORKSPACE", "Canonical workspace contains 0 files. Validation cannot pass on an empty workspace.");
  }

  // Zero-Bypass Gate 3: Cancellation signal check before materialization
  if (options.signal?.aborted) {
    return buildFailResult("INTEGRATED_QA_ABORTED", "Integrated QA verification was cancelled before starting.");
  }

  // 1. Materialize complete project into sandbox
  let materialization: MaterializationReport;
  try {
    materialization = await CanonicalWorkspaceMaterializer.materialize(
      options.workspace,
      options.sandboxProvider,
      options.sandboxId
    );
  } catch (matErr) {
    const errMsg = matErr instanceof Error ? matErr.message : String(matErr);
    return buildFailResult("MATERIALIZATION_FAILED", `Could not materialize canonical workspace into sandbox: ${errMsg}`);
  }

  // 2. Generate Validation Plan
  const validationPlan = detectValidationPlan(allFiles);

  // Override with custom commands if provided
  if (options.customValidationCommands && options.customValidationCommands.length > 0) {
    validationPlan.commands = options.customValidationCommands.map((cmd) => ({
      command: cmd,
      purpose: "CUSTOM",
      required: true,
      cwd: ".",
    }));
  }

  // Zero-Bypass Gate 4: In production mode, validation plan must contain at least one meaningful verifiable command
  const meaningfulCommands = validationPlan.commands.filter((c) => !isTrivialScript(c.command));
  if (meaningfulCommands.length === 0) {
    if (options.requireRealExecution) {
      return buildFailResult(
        "NO_MEANINGFUL_VALIDATION",
        "No meaningful automated validation commands detected. Trivial commands (e.g. echo, true, exit 0) cannot count as production verification."
      );
    }
    // In non-production simulation without commands, pass with informational notice
    return {
      success: true,
      validatedRevision: currentRevision,
      validatedGeneration: currentGeneration,
      workspaceDigest,
      executionMode,
      evidence: {
        commands: [],
        stdout: "No automated validation commands detected for workspace layout (non-production mode).",
        stderr: "",
        exitCode: 0,
        modifiedFiles: Object.keys(allFiles).map((path) => ({ path, type: "MODIFIED" })),
        sandboxId: options.sandboxId,
        timestamps: { startedAt: startedAtIso, completedAt: new Date().toISOString() },
      },
      validationPlan,
      materialization,
      durationMs: Date.now() - startTime,
    };
  }

  const executedCommands: ExecutedCommandTelemetry[] = [];
  let combinedStdout = "";
  let combinedStderr = "";
  let overallExitCode = 0;
  let failureReason: string | undefined;

  // 3. Execute validation commands with safe cwd and strict injection prevention
  for (const valCmd of validationPlan.commands) {
    if (options.signal?.aborted) {
      return {
        success: false,
        validatedRevision: currentRevision,
        validatedGeneration: currentGeneration,
        workspaceDigest,
        executionMode,
        error: "INTEGRATED_QA_ABORTED: Verification cancelled by signal.",
        evidence: {
          commands: executedCommands,
          stdout: combinedStdout,
          stderr: combinedStderr,
          exitCode: 130,
          modifiedFiles: [],
          sandboxId: options.sandboxId,
          timestamps: { startedAt: startedAtIso, completedAt: new Date().toISOString() },
        },
        validationPlan,
        materialization,
        durationMs: Date.now() - startTime,
      };
    }

    const cmdStart = Date.now();
    let execResult: SandboxExecutionResult;
    let sanitizedCwd = ".";

    try {
      sanitizedCwd = validateAndSanitizeCwd(valCmd.cwd);
    } catch (cwdErr) {
      const errMsg = cwdErr instanceof Error ? cwdErr.message : String(cwdErr);
      overallExitCode = 1;
      failureReason = `CWD_VALIDATION_FAILED: ${errMsg}`;
      break;
    }

    try {
      execResult = await options.sandboxProvider.execute(
        options.sandboxId,
        valCmd.command,
        undefined,
        valCmd.timeoutMs || options.timeoutMs || 60_000,
        options.signal,
        { cwd: sanitizedCwd }
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      execResult = {
        exitCode: 1,
        stdout: "",
        stderr: `Execution error: ${errMsg}`,
        durationMs: Date.now() - cmdStart,
      };
    }

    const telemetry: ExecutedCommandTelemetry = {
      command: sanitizedCwd !== "." ? `(cwd: ${sanitizedCwd}) ${valCmd.command}` : valCmd.command,
      stdout: execResult.stdout,
      stderr: execResult.stderr,
      exitCode: execResult.exitCode,
      durationMs: execResult.durationMs,
      timestamp: new Date().toISOString(),
    };

    executedCommands.push(telemetry);
    combinedStdout += `\n$ [cwd=${sanitizedCwd}] ${valCmd.command}\n${execResult.stdout}`;
    if (execResult.stderr) {
      combinedStderr += `\n$ [cwd=${sanitizedCwd}] ${valCmd.command} (stderr)\n${execResult.stderr}`;
    }

    if (execResult.exitCode !== 0) {
      overallExitCode = execResult.exitCode;
      if (valCmd.required) {
        failureReason = `Validation command "${valCmd.command}" (cwd: "${sanitizedCwd}", ${valCmd.purpose}) failed with exit code ${execResult.exitCode}:\n${execResult.stderr || execResult.stdout}`;
        break;
      }
    }
  }

  // Zero-Bypass Gate 5: Final abort check after command execution
  if (options.signal?.aborted) {
    return {
      success: false,
      validatedRevision: currentRevision,
      validatedGeneration: currentGeneration,
      workspaceDigest,
      executionMode,
      error: "INTEGRATED_QA_ABORTED: Verification cancelled before final verdict.",
      evidence: {
        commands: executedCommands,
        stdout: combinedStdout,
        stderr: combinedStderr,
        exitCode: 130,
        modifiedFiles: [],
        sandboxId: options.sandboxId,
        timestamps: { startedAt: startedAtIso, completedAt: new Date().toISOString() },
      },
      validationPlan,
      materialization,
      durationMs: Date.now() - startTime,
    };
  }

  const completedAtIso = new Date().toISOString();
  const evidence: ExecutionEvidence = {
    commands: executedCommands,
    stdout: combinedStdout.trim(),
    stderr: combinedStderr.trim(),
    exitCode: overallExitCode,
    modifiedFiles: Object.keys(allFiles).map((path) => ({ path, type: "MODIFIED" })),
    sandboxId: options.sandboxId,
    timestamps: { startedAt: startedAtIso, completedAt: completedAtIso },
  };

  return {
    success: overallExitCode === 0 && !failureReason,
    validatedRevision: currentRevision,
    validatedGeneration: currentGeneration,
    workspaceDigest,
    executionMode,
    error: failureReason,
    evidence,
    validationPlan,
    materialization,
    durationMs: Date.now() - startTime,
  };
}


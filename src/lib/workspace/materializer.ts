import crypto from "crypto";
import { SandboxProvider, SandboxFileEntry } from "../providers/sandbox";
import { CanonicalWorkspace, MaterializationReport } from "./types";

export class CanonicalWorkspaceMaterializer {
  /**
   * Materializes the full project tree into the destination sandbox container with exact remote reconciliation
   */
  public static async materialize(
    workspace: CanonicalWorkspace,
    sandboxProvider: SandboxProvider,
    sandboxId: string
  ): Promise<MaterializationReport> {
    const startTime = Date.now();
    const allFiles = workspace.getAllFiles();
    const writtenFiles: string[] = [];
    const deletedFiles: string[] = [];

    // 1. Inventory remote files and delete extraneous files not in canonical workspace
    try {
      const remoteEntries: SandboxFileEntry[] = await sandboxProvider.listFiles(sandboxId, ".");
      for (const entry of remoteEntries) {
        if (entry.isDirectory) continue;
        const cleanPath = entry.path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/^(workspace|home\/user)\//, "");
        if (
          !Object.prototype.hasOwnProperty.call(allFiles, cleanPath) &&
          !Object.prototype.hasOwnProperty.call(allFiles, entry.path)
        ) {
          try {
            await sandboxProvider.deleteFile(sandboxId, entry.path);
            deletedFiles.push(entry.path);
          } catch {
            // ignore cleanup failure on non-critical residual
          }
        }
      }
    } catch {
      // listFiles on fresh/empty directory may fail or be unsupported; proceed safely
    }

    // 2. Materialize all active canonical files (including empty files with zero bytes)
    for (const [filePath, content] of Object.entries(allFiles)) {
      const normalizedPath = filePath.replace(/\\/g, "/").replace(/^\/+/, "");
      await sandboxProvider.writeFile(sandboxId, normalizedPath, typeof content === "string" ? content : "");
      writtenFiles.push(normalizedPath);
    }

    // 3. Identify and execute real deletion of deleted files from patch history
    const patchHistory = workspace.getPatchHistory();
    const uniqueDeleted = new Set<string>();

    for (const patch of patchHistory) {
      for (const fileChange of patch.files) {
        if (fileChange.type === "DELETED") {
          const normalizedDeleted = fileChange.path.replace(/\\/g, "/").replace(/^\/+/, "");
          if (
            !Object.prototype.hasOwnProperty.call(allFiles, fileChange.path) &&
            !Object.prototype.hasOwnProperty.call(allFiles, normalizedDeleted)
          ) {
            uniqueDeleted.add(normalizedDeleted);
          }
        }
      }
    }

    for (const delPath of uniqueDeleted) {
      try {
        await sandboxProvider.deleteFile(sandboxId, delPath);
        if (!deletedFiles.includes(delPath)) {
          deletedFiles.push(delPath);
        }
      } catch (delErr: unknown) {
        const errMsg = delErr instanceof Error ? delErr.message : String(delErr);
        if (!errMsg.toLowerCase().includes("not found") && !errMsg.toLowerCase().includes("no such file")) {
          throw new Error(`MATERIALIZATION_DELETE_FAILED: Failed to delete removed file "${delPath}" from sandbox: ${errMsg}`);
        }
      }
    }

    // 4. Exact remote readback reconciliation & remote workspace digest verification
    const sortedPaths = Object.keys(allFiles).sort();
    const remoteHash = crypto.createHash("sha256");

    for (const p of sortedPaths) {
      const norm = p.replace(/\\/g, "/").replace(/^\/+/, "");
      let readContent = "";
      try {
        readContent = await sandboxProvider.readFile(sandboxId, norm);
      } catch (rErr: unknown) {
        throw new Error(`MATERIALIZATION_RECONCILIATION_FAILED: Failed to read back file "${norm}" from sandbox: ${rErr instanceof Error ? rErr.message : String(rErr)}`);
      }
      remoteHash.update(`${p}:${crypto.createHash("sha256").update(readContent).digest("hex")}\n`);
    }

    const remoteWorkspaceDigest = remoteHash.digest("hex");
    const canonicalWorkspaceDigest = workspace.getWorkspaceDigest();

    if (remoteWorkspaceDigest !== canonicalWorkspaceDigest) {
      throw new Error(
        `MATERIALIZATION_DIGEST_MISMATCH: Remote sandbox digest (${remoteWorkspaceDigest}) does not match canonical workspace digest (${canonicalWorkspaceDigest}).`
      );
    }

    return {
      totalFilesWritten: writtenFiles.length,
      files: writtenFiles,
      deletedFiles,
      durationMs: Date.now() - startTime,
      sandboxId,
      remoteWorkspaceDigest,
      canonicalWorkspaceDigest,
    };
  }
}


// Git Provider Abstraction Interface

export interface GitCommitResult {
  commitHash: string;
  branch: string;
  filesChanged: number;
  message: string;
}

export interface GitDiffFile {
  filePath: string;
  status: "added" | "modified" | "deleted";
  additions: number;
  deletions: number;
}

export interface GitStatusResult {
  branch: string;
  isDirty: boolean;
  ahead: number;
  behind: number;
}

export interface GitProvider {
  name: string;
  clone(repoUrl: string, targetDir: string): Promise<boolean>;
  branch(name: string, fromBranch?: string): Promise<void>;
  status(): Promise<GitStatusResult>;
  diff(): Promise<GitDiffFile[]>;
  commit(message: string, author?: string): Promise<GitCommitResult>;
  push(remote?: string, branch?: string): Promise<boolean>;
}

export class MockGitProvider implements GitProvider {
  name = "mock-git-provider";

  async clone(repoUrl: string): Promise<boolean> {
    return true;
  }

  async branch(_name: string): Promise<void> {}

  async status(): Promise<GitStatusResult> {
    return {
      branch: "legion/mission-001",
      isDirty: true,
      ahead: 0,
      behind: 0,
    };
  }

  async diff(): Promise<GitDiffFile[]> {
    return [
      { filePath: "src/lib/auth.ts", status: "modified", additions: 42, deletions: 12 },
      { filePath: "src/app/api/auth/route.ts", status: "added", additions: 84, deletions: 0 },
    ];
  }

  async commit(message: string): Promise<GitCommitResult> {
    return {
      commitHash: Math.random().toString(16).substring(2, 9),
      branch: "legion/mission-001",
      filesChanged: 2,
      message,
    };
  }

  async push(): Promise<boolean> {
    return true;
  }
}

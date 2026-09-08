// Deployment Provider Abstraction Interface

export interface DeploymentResult {
  deploymentId: string;
  url: string;
  environment: "preview" | "staging" | "production";
  status: "BUILDING" | "READY" | "ERROR" | "CANCELLED";
  createdAt: string;
}

export interface DeploymentProvider {
  name: string;
  deploy(directory: string, environment?: "preview" | "staging" | "production"): Promise<DeploymentResult>;
  status(deploymentId: string): Promise<DeploymentResult>;
  logs(deploymentId: string): Promise<string[]>;
}

export class MockDeploymentProvider implements DeploymentProvider {
  name = "mock-deployment-provider";

  async deploy(
    _directory: string,
    environment: "preview" | "staging" | "production" = "preview"
  ): Promise<DeploymentResult> {
    return {
      deploymentId: `dpl_${Date.now()}`,
      url: `https://legion-mission-preview.internal.app`,
      environment,
      status: "READY",
      createdAt: new Date().toISOString(),
    };
  }

  async status(deploymentId: string): Promise<DeploymentResult> {
    return {
      deploymentId,
      url: `https://legion-mission-preview.internal.app`,
      environment: "preview",
      status: "READY",
      createdAt: new Date().toISOString(),
    };
  }

  async logs(_deploymentId: string): Promise<string[]> {
    return [
      "Building static pages (12/12)...",
      "Optimizing images...",
      "Deployment complete at https://legion-mission-preview.internal.app",
    ];
  }
}

import { InstallPipeline, InstallPipelineStep } from 'main/install/InstallPipeline';
import { FragmenterInstallPipelineStep } from 'main/install/FragmenterInstallPipelineStep';

export class InstallPipelineFactory {
  public static createPipeline(url: string): InstallPipeline {
    const steps: InstallPipelineStep[] = [];

    steps.push(new FragmenterInstallPipelineStep(url));

    return {
      steps,
    };
  }
}

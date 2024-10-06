import { FragmenterContext } from '@flybywiresim/fragmenter';

import {
  InstallPipeline,
  InstallPipelineExecutionContext,
  InstallPipelineStep,
  InstallPipelineStepProgress,
  InstallStepResultKind,
  UINotificationContext,
} from './InstallPipeline';
export class InstallPipelineExecutor {
  public async execute(
    abortSignal: AbortSignal,
    directories: {
      installDir: string;
      tempDir: string;
    },
    pipeline: InstallPipeline,
    notificationContext: UINotificationContext,
  ): Promise<boolean> {
    const ctx: InstallPipelineExecutionContext = {
      fragmenterContext: new FragmenterContext({ useConsoleLog: true }, abortSignal),
      installDir: directories.installDir,
      tempDir: directories.tempDir,
      ...notificationContext,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      reportProgress(step: InstallPipelineStep, progress: InstallPipelineStepProgress) {
        throw new Error('Not yet implemented');
      },
    };

    for (const step of pipeline.steps) {
      const result = await step.run(ctx);

      if (result.kind === InstallStepResultKind.Failure) {
        return false;
      }
    }

    return true;
  }
}

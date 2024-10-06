import { FragmenterContextEvents, FragmenterInstaller, FragmenterInstallerEvents } from '@flybywiresim/fragmenter';

import {
  InstallPipelineExecutionContext,
  InstallPipelineStep,
  InstallPipelineStepKind,
  InstallStepResult,
  InstallStepResultKind,
  UINotificationKind,
} from './InstallPipeline';

export class FragmenterInstallPipelineStep implements InstallPipelineStep {
  public kind = InstallPipelineStepKind.Install;

  constructor(private readonly url: string) {}

  async run(ctx: InstallPipelineExecutionContext): Promise<InstallStepResult> {
    const fragmenterInstaller = new FragmenterInstaller(ctx.fragmenterContext, this.url, ctx.installDir, {
      temporaryDirectory: ctx.tempDir,
    });

    let lastProgressSent = 0;

    const forwardFragmenterInstallerEvent = (event: keyof FragmenterInstallerEvents) => {
      fragmenterInstaller.on(event, (...args: unknown[]) => {
        if (event === 'downloadProgress' || event === 'unzipProgress' || event === 'copyProgress') {
          const currentTime = performance.now();
          const timeSinceLastProgress = currentTime - lastProgressSent;

          if (timeSinceLastProgress > 25) {
            ctx.reportEvent({
              kind: UINotificationKind.FragmenterEvent,
              event,
              args: args as Parameters<FragmenterInstallerEvents[typeof event]>,
            });

            lastProgressSent = currentTime;
          }
        } else {
          ctx.reportEvent({
            kind: UINotificationKind.FragmenterEvent,
            event,
            args: args as Parameters<FragmenterInstallerEvents[typeof event]>,
          });
        }
      });
    };

    const fragmenterContextEventHandlers: [event: keyof FragmenterContextEvents, () => void][] = [];

    const forwardFragmenterContextEvent = (event: keyof FragmenterContextEvents) => {
      const handler = (...args: unknown[]) => {
        ctx.reportEvent({
          kind: UINotificationKind.FragmenterEvent,
          event,
          args: args as Parameters<FragmenterContextEvents[typeof event]>,
        });
      };

      ctx.fragmenterContext.on(event, handler);
      fragmenterContextEventHandlers.push([event, handler]);
    };

    forwardFragmenterInstallerEvent('error');
    forwardFragmenterInstallerEvent('downloadStarted');
    forwardFragmenterInstallerEvent('downloadProgress');
    forwardFragmenterInstallerEvent('downloadInterrupted');
    forwardFragmenterInstallerEvent('downloadFinished');
    forwardFragmenterInstallerEvent('unzipStarted');
    forwardFragmenterInstallerEvent('unzipProgress');
    forwardFragmenterInstallerEvent('unzipFinished');
    forwardFragmenterInstallerEvent('copyStarted');
    forwardFragmenterInstallerEvent('copyProgress');
    forwardFragmenterInstallerEvent('copyFinished');
    forwardFragmenterInstallerEvent('retryScheduled');
    forwardFragmenterInstallerEvent('retryStarted');
    forwardFragmenterInstallerEvent('fullDownload');
    forwardFragmenterInstallerEvent('cancelled');
    forwardFragmenterInstallerEvent('logInfo');
    forwardFragmenterInstallerEvent('logWarn');
    forwardFragmenterInstallerEvent('logError');
    forwardFragmenterContextEvent('phaseChange');

    try {
      await fragmenterInstaller.install();

      return { kind: InstallStepResultKind.Success };
    } catch (e) {
      return { kind: InstallStepResultKind.Failure };
    } finally {
      for (const [event, handler] of fragmenterContextEventHandlers) {
        ctx.fragmenterContext.off(event, handler);
      }
    }
  }
}

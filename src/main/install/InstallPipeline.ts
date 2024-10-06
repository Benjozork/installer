import { FragmenterContext, FragmenterContextEvents, FragmenterInstallerEvents } from '@flybywiresim/fragmenter';
import { Addon, AddonTrack } from 'renderer/utils/InstallerConfiguration';

export enum InstallPipelineStepKind {
  PreInstall,
  Install,
  PostInstall,
}

export interface InstallPipelineStepProgress {
  available: boolean;
  percentage: boolean;
}

export enum UINotificationKind {
  FragmenterEvent,
  Progress,
}

export interface BaseUINotification {
  kind: unknown;
}

export interface FragmenterEventUINotification<T extends keyof (FragmenterInstallerEvents & FragmenterContextEvents)>
  extends BaseUINotification {
  kind: UINotificationKind.FragmenterEvent;
  event: T;
  args: Parameters<(FragmenterInstallerEvents & FragmenterContextEvents)[T]>;
}

export type UINotification = FragmenterEventUINotification<keyof (FragmenterInstallerEvents & FragmenterContextEvents)>;

export interface UINotificationContext {
  reportEvent(event: UINotification): void;
}

export interface InstallPipelineExecutionContext extends UINotificationContext {
  fragmenterContext: FragmenterContext;

  installDir: string;

  tempDir: string;

  reportProgress(step: InstallPipelineStep, progress: InstallPipelineStepProgress): void;
}
export enum InstallStepResultKind {
  Success,
  Failure,
}

interface BaseInstallStepResult {
  kind: unknown;
}

export interface SuccessfulInstallStepResult extends BaseInstallStepResult {
  kind: InstallStepResultKind.Success;
}

export interface FailedInstallStepResult extends BaseInstallStepResult {
  kind: InstallStepResultKind.Failure;
}

export type InstallStepResult = SuccessfulInstallStepResult | FailedInstallStepResult;

export interface InstallPipelineStep {
  kind: InstallPipelineStepKind;
  run(ctx: InstallPipelineExecutionContext): Promise<InstallStepResult>;
}

export interface InstallPipeline {
  steps: InstallPipelineStep[];
}

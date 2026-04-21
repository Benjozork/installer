import path from 'path';
import { Addon } from 'renderer/utils/InstallerConfiguration';
import settings from 'renderer/rendererSettings';
import { appPaths } from 'renderer/utils/AppPaths';
import { Simulators, TypeOfSimulator } from './SimManager';
import channels from 'common/channels';

const TEMP_DIRECTORY_PREFIX = 'flybywire-current-install';

export class Directories {
  private static sanitize(suffix: string): string {
    return path.normalize(suffix).replace(/^(\.\.(\/|\\|$))+/, '');
  }

  static appData(): string {
    return appPaths['appData'];
  }

  static localAppData(): string {
    return path.join(appPaths['appData'], '..', 'Local');
  }

  static home(): string {
    return appPaths['home'];
  }

  static osTemp(): string {
    return appPaths['temp'];
  }

  static simulatorBasePath(sim: TypeOfSimulator): string | null {
    return settings.get(`mainSettings.simulator.${sim}.basePath`);
  }

  static communityLocation(sim: TypeOfSimulator): string | null {
    return settings.get(`mainSettings.simulator.${sim}.communityPath`);
  }

  static inCommunityLocation(sim: TypeOfSimulator, targetDir: string): string | null {
    const communityPath = Directories.communityLocation(sim);
    if (!communityPath) return null;
    return path.join(communityPath, this.sanitize(targetDir));
  }

  static inCommunityPackage(addon: Addon, targetDir: string): string | null {
    const baseDir = this.inCommunityLocation(addon.simulator, this.sanitize(addon.targetDirectory));
    return path.join(baseDir, this.sanitize(targetDir));
  }

  static installLocation(sim: TypeOfSimulator): string | null {
    return settings.get(`mainSettings.simulator.${sim}.installPath`);
  }

  static inInstallLocation(sim: TypeOfSimulator, targetDir: string): string | null {
    const installPath = this.installLocation(sim);
    if (!installPath) return null;
    return path.join(installPath, this.sanitize(targetDir));
  }

  static inInstallPackage(addon: Addon, targetDir: string): string | null {
    const baseDir = this.inInstallLocation(addon.simulator, this.sanitize(addon.targetDirectory));
    if (!baseDir) return null;
    return path.join(baseDir, this.sanitize(targetDir));
  }

  static tempLocation(sim: TypeOfSimulator): string {
    return settings.get('mainSettings.separateTempLocation')
      ? settings.get('mainSettings.tempLocation')
      : this.installLocation(sim);
  }

  static inTempLocation(sim: TypeOfSimulator, targetDir: string): string {
    return path.join(Directories.tempLocation(sim), this.sanitize(targetDir));
  }

  static inPackages(sim: TypeOfSimulator, targetDir: string): string {
    return path
      .join(this.simulatorBasePath(sim), 'packages', this.sanitize(targetDir))
      .replace('LocalCache', 'LocalState');
  }

  static inPackageCache(addon: Addon, targetDir: string): string {
    const baseDir = this.inPackages(addon.simulator, this.sanitize(addon.targetDirectory));
    return path.join(baseDir, this.sanitize(targetDir));
  }

  static temp(sim: TypeOfSimulator): string {
    return path.join(
      Directories.tempLocation(sim),
      `${TEMP_DIRECTORY_PREFIX}-${(Math.random() * 1000).toFixed(0)}`,
    );
  }

  static removeAllTemp(): Promise<void> {
    return window.electronAPI.ipc.invoke(channels.directories.removeAllTemp) as Promise<void>;
  }

  static removeAlternativesForAddon(addon: Addon): Promise<void> {
    return window.electronAPI.ipc.invoke(channels.directories.removeAlternativesForAddon, {
      simulator: addon.simulator,
      alternativeNames: addon.alternativeNames,
    }) as Promise<void>;
  }

  static isFragmenterInstall(target: string | Addon): Promise<boolean> {
    const targetDir =
      typeof target === 'string' ? target : Directories.inInstallLocation(target.simulator, target.targetDirectory);
    return window.electronAPI.ipc.invoke(channels.directories.isFragmenterInstall, targetDir) as Promise<boolean>;
  }

  static isGitInstall(target: string | Addon): Promise<boolean> {
    const targetDir =
      typeof target === 'string' ? target : Directories.inInstallLocation(target.simulator, target.targetDirectory);
    return window.electronAPI.ipc.invoke(channels.directories.isGitInstall, targetDir) as Promise<boolean>;
  }

  static inDocumentsFolder(targetDir: string): string {
    return path.join(appPaths['documents'], this.sanitize(targetDir));
  }
}

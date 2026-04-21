import { Addon, ExternalApplicationDefinition, Publisher } from 'renderer/utils/InstallerConfiguration';
import { Resolver } from 'renderer/utils/Resolver';
import { store } from 'renderer/redux/store';
import { ApplicationStatus } from 'renderer/components/AddonSection/Enums';
import { ExternalApps } from 'renderer/utils/ExternalApps';
import path from 'path';
import { Directories } from 'renderer/utils/Directories';
import channels from 'common/channels';

export const STARTUP_FOLDER_PATH = 'Microsoft\\Windows\\Start Menu\\Programs\\Startup\\';

export class BackgroundServices {
  private static validateExecutablePath(execPath: string): boolean {
    return /^[a-zA-Z\d_-]+$/.test(execPath);
  }

  public static getExternalAppFromBackgroundService(addon: Addon, publisher: Publisher): ExternalApplicationDefinition {
    if (!addon.backgroundService) {
      throw new Error('Addon has no background service');
    }

    const appRef = addon.backgroundService.runCheckExternalAppRef;
    const app = Resolver.findDefinition(appRef, publisher);

    if (!app || app.kind !== 'externalApp') {
      throw new Error(
        `Attempted to find external app for background service, but runCheckExternalAppRef=${appRef} does not refer to a valid external app`,
      );
    }

    return app;
  }

  static isRunning(addon: Addon, publisher: Publisher): boolean {
    const app = this.getExternalAppFromBackgroundService(addon, publisher);
    const state = store.getState().applicationStatus[app.key];
    return state === ApplicationStatus.Open;
  }

  static async isAutoStartEnabled(addon: Addon): Promise<boolean> {
    const backgroundService = addon.backgroundService;

    if (!backgroundService) {
      throw new Error('Addon has no background service');
    }

    const startupDir = path.join(Directories.appData(), STARTUP_FOLDER_PATH);

    type DirEntry = { name: string; isFile: boolean; isDirectory: boolean };
    let folderEntries: DirEntry[] | undefined;

    try {
      folderEntries = (await window.electronAPI.ipc.invoke(channels.fs.readdir, startupDir)) as DirEntry[];
    } catch (e) {
      console.error('[BackgroundServices](isAutoStartEnabled) Could not read contents of startup folder:', e);
    }

    if (!folderEntries) {
      return false;
    }

    const shortcuts = folderEntries.filter((it) => it.isFile && path.extname(it.name) === '.lnk');
    const matchingShortcut = shortcuts.find((it) => path.parse(it.name).name === backgroundService.executableFileBasename);

    return matchingShortcut !== undefined;
  }

  static async setAutoStartEnabled(addon: Addon, publisher: Publisher, enabled: boolean): Promise<void> {
    const backgroundService = addon.backgroundService;

    if (!backgroundService) {
      throw new Error('Addon has no background service');
    }

    if (!this.validateExecutablePath(backgroundService.executableFileBasename)) {
      throw new Error('Executable path must match /^[a-zA-Z\\d_-]+$/.');
    }

    const exePath = path.join(
      Directories.inInstallLocation(addon.simulator, addon.targetDirectory),
      backgroundService.executableFileBasename,
    );
    const commandLineArgs = backgroundService.commandLineArgs ? ` ${backgroundService.commandLineArgs.join(' ')}` : '';

    const shortcutDir = path.join(Directories.appData(), STARTUP_FOLDER_PATH);
    const shortcutPath = path.join(shortcutDir, `${backgroundService.executableFileBasename}.lnk`);

    if (enabled) {
      const created = (await window.electronAPI.ipc.invoke(channels.shell.writeShortcutLink, shortcutPath, 'create', {
        target: exePath,
        args: commandLineArgs,
        cwd: path.dirname(exePath),
      })) as boolean;

      if (!created) {
        console.error('[BackgroundServices](setAutoStartEnabled) Could not create shortcut');
      } else {
        console.log('[BackgroundServices](setAutoStartEnabled) Shortcut created');
      }
    } else {
      window.electronAPI.ipc.send(channels.shell.removeShortcut, shortcutPath);
    }
  }

  static async start(addon: Addon): Promise<void> {
    const backgroundService = addon.backgroundService;

    if (!backgroundService) {
      throw new Error('Addon has no background service');
    }

    if (!this.validateExecutablePath(backgroundService.executableFileBasename)) {
      throw new Error('Executable path must match /^[a-zA-Z\\d_-]+$/.');
    }

    const exePath = path.normalize(
      path.join(
        Directories.inInstallLocation(addon.simulator, addon.targetDirectory),
        `${backgroundService.executableFileBasename}.exe`,
      ),
    );

    window.electronAPI.ipc.send(channels.openPath, exePath);
  }

  static async kill(addon: Addon, publisher: Publisher): Promise<void> {
    const app = this.getExternalAppFromBackgroundService(addon, publisher);
    return ExternalApps.kill(app);
  }
}

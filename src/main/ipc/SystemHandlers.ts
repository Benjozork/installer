import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import fs from 'fs';
import net from 'net';
import path from 'path';
import os from 'os';
import type Store from 'electron-store';
import channels from 'common/channels';
import { msfsBasePath, defaultCommunityDir } from 'main/appSettings';

type TypeOfSimulator = 'msfs2020' | 'msfs2024';

const TEMP_DIRECTORY_PREFIX = 'flybywire-current-install';
const TEMP_DIRECTORY_PREFIXES_FOR_CLEANUP = ['flybywire_current_install', TEMP_DIRECTORY_PREFIX];
const SIMULATORS: TypeOfSimulator[] = ['msfs2020', 'msfs2024'];

export class SystemHandlers {
  static setupIpcListeners(store: Store, getWindow: () => BrowserWindow): void {
    // ------------------------------------------------------------------
    // App paths
    // ------------------------------------------------------------------

    ipcMain.handle(channels.app.getPath, (_, name: string) => {
      const { app } = require('electron');
      return app.getPath(name as Parameters<Electron.App['getPath']>[0]);
    });

    // ------------------------------------------------------------------
    // Shell
    // ------------------------------------------------------------------

    ipcMain.on(channels.shell.openExternal, (_, url: string) => {
      void shell.openExternal(url);
    });

    ipcMain.handle(channels.shell.writeShortcutLink, (_, shortcutPath: string, operation: 'create' | 'update' | 'replace', options: Electron.ShortcutDetails) => {
      return shell.writeShortcutLink(shortcutPath, operation, options);
    });

    ipcMain.on(channels.shell.removeShortcut, (_, shortcutPath: string) => {
      fs.promises.rm(shortcutPath).catch((e) => {
        console.error('[SystemHandlers] Could not remove shortcut:', e);
      });
    });

    // ------------------------------------------------------------------
    // Dialog (needs the window reference for modal attachment)
    // ------------------------------------------------------------------

    ipcMain.handle(channels.dialog.showOpenDialog, (event, options: Electron.OpenDialogOptions) => {
      const win = BrowserWindow.fromWebContents(event.sender) ?? getWindow();
      return dialog.showOpenDialog(win, options);
    });

    ipcMain.handle(channels.dialog.showMessageBox, (event, options: Electron.MessageBoxOptions) => {
      const win = BrowserWindow.fromWebContents(event.sender) ?? getWindow();
      return dialog.showMessageBox(win, options);
    });

    // ------------------------------------------------------------------
    // Network — TCP port probe
    // ------------------------------------------------------------------

    ipcMain.handle(channels.net.checkTcpPort, (_, port: number) => {
      return new Promise<boolean>((resolve) => {
        const socket = net.connect(port);
        socket.on('connect', () => { resolve(true); socket.destroy(); });
        socket.on('error', () => { resolve(false); socket.destroy(); });
      });
    });

    // ------------------------------------------------------------------
    // File system
    // ------------------------------------------------------------------

    ipcMain.handle(channels.fs.existsSync, (_, filePath: string) => fs.existsSync(filePath));

    ipcMain.handle(channels.fs.mkdirSync, (_, dirPath: string) => {
      fs.mkdirSync(dirPath, { recursive: true });
    });

    ipcMain.handle(channels.fs.rmSync, (_, filePath: string, opts?: { recursive?: boolean }) => {
      fs.rmSync(filePath, opts);
    });

    ipcMain.handle(channels.fs.readFile, (_, filePath: string, encoding: BufferEncoding = 'utf8') => {
      return fs.promises.readFile(filePath, encoding);
    });

    ipcMain.handle(channels.fs.writeFile, (_, filePath: string, content: string) => {
      return fs.promises.writeFile(filePath, content);
    });

    ipcMain.handle(channels.fs.readdir, async (_, dirPath: string) => {
      const dirents = await fs.promises.readdir(dirPath, { withFileTypes: true });
      return dirents.map((d) => ({ name: d.name, isFile: d.isFile(), isDirectory: d.isDirectory() }));
    });

    ipcMain.handle(channels.fs.readlink, (_, filePath: string) => fs.promises.readlink(filePath));

    // ------------------------------------------------------------------
    // Directories — fs-touching helpers (moved from renderer)
    // ------------------------------------------------------------------

    ipcMain.handle(channels.directories.removeAllTemp, () => {
      console.log('[CLEANUP] Removing all temp directories');

      for (const sim of SIMULATORS) {
        const tempLocation = SystemHandlers.getTempLocation(store, sim);

        if (!fs.existsSync(tempLocation)) {
          console.warn('[CLEANUP] Location of temporary folders does not exist. Aborting');
          return;
        }

        try {
          const dirents = fs
            .readdirSync(tempLocation, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .filter((d) => TEMP_DIRECTORY_PREFIXES_FOR_CLEANUP.some((prefix) => d.name.startsWith(prefix)));

          for (const dir of dirents) {
            const fullPath = path.join(tempLocation, dir.name);
            console.log('[CLEANUP] Removing', fullPath);
            try {
              fs.rmSync(fullPath, { recursive: true });
              console.log('[CLEANUP] Removed', fullPath);
            } catch (e) {
              console.error('[CLEANUP] Could not remove', fullPath, e);
            }
          }

          console.log('[CLEANUP] Finished removing all temp directories');
        } catch (e) {
          console.error('[CLEANUP] Could not scan folder', tempLocation, e);
        }
      }
    });

    ipcMain.handle(channels.directories.removeAlternativesForAddon, (_, addon: { simulator: TypeOfSimulator; alternativeNames?: string[] }) => {
      const installLocation = store.get(`mainSettings.simulator.${addon.simulator}.installPath`) as string | null;
      if (!installLocation) return;

      addon.alternativeNames?.forEach((altName) => {
        const altDir = path.join(installLocation, altName);
        if (fs.existsSync(altDir)) {
          console.log('Removing alternative', altDir);
          fs.rmSync(altDir, { recursive: true });
        }
      });
    });

    ipcMain.handle(channels.directories.isGitInstall, (_, targetDir: string) => {
      try {
        const symlinkPath = fs.readlinkSync(targetDir);
        if (symlinkPath && fs.existsSync(path.join(symlinkPath, '/../../../.git'))) {
          console.log('Is git repo', targetDir);
          return true;
        }
        return false;
      } catch {
        console.log('Is not git repo', targetDir);
        return false;
      }
    });

    ipcMain.handle(channels.directories.isFragmenterInstall, (_, targetDir: string) => {
      return fs.existsSync(path.join(targetDir, 'install.json'));
    });

    // ------------------------------------------------------------------
    // Settings
    // ------------------------------------------------------------------

    ipcMain.handle(channels.settings.getAll, () => store.store);

    ipcMain.handle(channels.settings.get, (_, key: string, defaultValue?: unknown) => store.get(key as never, defaultValue as never));

    ipcMain.handle(channels.settings.set, (event, key: string, value: unknown) => {
      store.set(key as never, value as never);
      event.sender.send(channels.settings.changed, key, value);
    });

    ipcMain.handle(channels.settings.delete, (event, key: string) => {
      store.delete(key as never);
      event.sender.send(channels.settings.changed, key, undefined);
    });

    // ------------------------------------------------------------------
    // MSFS path detection
    // ------------------------------------------------------------------

    ipcMain.handle(channels.msfs.detectBasePath, (_, sim: TypeOfSimulator) => msfsBasePath(sim));

    ipcMain.handle(channels.msfs.detectCommunityDir, (_, msfsBase: string | null, sim: TypeOfSimulator) =>
      defaultCommunityDir(msfsBase, sim),
    );
  }

  private static getTempLocation(store: Store, sim: TypeOfSimulator): string {
    const useSeparate = store.get('mainSettings.separateTempLocation') as boolean;
    if (useSeparate) {
      return store.get('mainSettings.tempLocation') as string;
    }
    return store.get(`mainSettings.simulator.${sim}.installPath`) as string;
  }
}

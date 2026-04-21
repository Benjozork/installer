import { contextBridge, ipcRenderer } from 'electron';
import channels from 'common/channels';

// Channels the renderer is allowed to fire-and-forget to main
const ALLOWED_SEND_CHANNELS: string[] = [
  channels.window.minimize,
  channels.window.maximize,
  channels.window.close,
  channels.window.reload,
  channels.window.isMaximized,
  channels.openPath,
  channels.checkForInstallerUpdate,
  channels.installManager.cancelInstall,
  channels.shell.openExternal,
  channels.shell.removeShortcut,
  'request-startup-at-login-changed',
  'set-window-progress-bar',
  'restartAndUpdate',
];

// Channels the renderer is allowed to invoke (request/response)
const ALLOWED_INVOKE_CHANNELS: string[] = [
  channels.installManager.installFromUrl,
  channels.installManager.uninstall,
  channels.sentry.requestSessionID,
  channels.app.getPath,
  channels.shell.writeShortcutLink,
  channels.dialog.showOpenDialog,
  channels.dialog.showMessageBox,
  channels.net.checkTcpPort,
  channels.fs.existsSync,
  channels.fs.mkdirSync,
  channels.fs.rmSync,
  channels.fs.readFile,
  channels.fs.writeFile,
  channels.fs.readdir,
  channels.fs.readlink,
  channels.directories.removeAllTemp,
  channels.directories.removeAlternativesForAddon,
  channels.directories.isGitInstall,
  channels.directories.isFragmenterInstall,
  channels.settings.getAll,
  channels.settings.get,
  channels.settings.set,
  channels.settings.delete,
  channels.msfs.detectBasePath,
  channels.msfs.detectCommunityDir,
];

// Channels main is allowed to push to the renderer
const ALLOWED_RECEIVE_CHANNELS: string[] = [
  channels.window.isMaximized,
  channels.update.error,
  channels.update.available,
  channels.update.downloaded,
  channels.installManager.fragmenterEvent,
  channels.settings.changed,
];

const ipcBridge = {
  send(channel: string, ...args: unknown[]): void {
    if (ALLOWED_SEND_CHANNELS.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    } else {
      console.warn(`[preload] Blocked send on unlisted channel: ${channel}`);
    }
  },

  invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    if (ALLOWED_INVOKE_CHANNELS.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    console.warn(`[preload] Blocked invoke on unlisted channel: ${channel}`);
    return Promise.reject(new Error(`Channel not allowed: ${channel}`));
  },

  on(channel: string, callback: (...args: unknown[]) => void): void {
    if (ALLOWED_RECEIVE_CHANNELS.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    } else {
      console.warn(`[preload] Blocked on() for unlisted channel: ${channel}`);
    }
  },

  off(channel: string, callback: (...args: unknown[]) => void): void {
    ipcRenderer.removeAllListeners(channel);
    void callback; // signature kept for call-site compatibility
  },

  removeListener(channel: string, callback: (...args: unknown[]) => void): void {
    ipcRenderer.removeListener(channel, callback as Parameters<typeof ipcRenderer.removeListener>[1]);
  },
};

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  resourcesPath: process.resourcesPath,
  ipc: ipcBridge,
});

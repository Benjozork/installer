export {};

interface IpcBridge {
  send(channel: string, ...args: unknown[]): void;
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  on(channel: string, callback: (...args: unknown[]) => void): void;
  off(channel: string, callback: (...args: unknown[]) => void): void;
  removeListener(channel: string, callback: (...args: unknown[]) => void): void;
}

declare global {
  interface Window {
    electronAPI: {
      /** Current OS platform, e.g. 'win32' | 'linux' | 'darwin' */
      platform: NodeJS.Platform;
      /** Path to the app's resources directory (e.g. for bundled icons) */
      resourcesPath: string;
      /** Channel-allowlisted IPC bridge exposed by the preload script */
      ipc: IpcBridge;
    };
  }
}

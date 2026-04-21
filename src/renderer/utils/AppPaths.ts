import channels from 'common/channels';

// Cached app paths loaded from the main process at startup.
export const appPaths: Record<string, string> = {};

export async function initAppPaths(): Promise<void> {
  const names = ['appData', 'home', 'temp', 'documents'] as const;
  await Promise.all(
    names.map(async (name) => {
      appPaths[name] = (await window.electronAPI.ipc.invoke(channels.app.getPath, name)) as string;
    }),
  );
}

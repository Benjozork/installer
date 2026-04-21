import channels from 'common/channels';

// Flat dot-notation key → value mirror of the main-process electron-store.
// Populated once at startup, kept current via `settings/changed` push events.
let cache: Record<string, unknown> = {};

function getNestedValue(obj: Record<string, unknown>, dotKey: string): unknown {
  const parts = dotKey.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function setNestedValue(obj: Record<string, unknown>, dotKey: string, value: unknown): void {
  const parts = dotKey.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] == null || typeof current[parts[i]] !== 'object') {
      current[parts[i]] = {};
    }
    current = current[parts[i]] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

function deleteNestedValue(obj: Record<string, unknown>, dotKey: string): void {
  const parts = dotKey.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] == null || typeof current[parts[i]] !== 'object') return;
    current = current[parts[i]] as Record<string, unknown>;
  }
  delete current[parts[parts.length - 1]];
}

export async function initSettingsCache(): Promise<void> {
  cache = (await window.electronAPI.ipc.invoke(channels.settings.getAll)) as Record<string, unknown>;

  // Keep cache in sync with changes pushed from main (including our own writes reflected back)
  window.electronAPI.ipc.on(channels.settings.changed, (key: unknown, value: unknown) => {
    if (typeof key === 'string') {
      if (value === undefined) {
        deleteNestedValue(cache, key);
      } else {
        setNestedValue(cache, key, value);
      }
    }
  });
}

export const settingsCache = {
  get<T>(key: string, defaultValue?: T): T {
    const val = getNestedValue(cache, key);
    return (val !== undefined ? val : defaultValue) as T;
  },

  set(key: string, value: unknown): void {
    setNestedValue(cache, key, value); // optimistic update
    void window.electronAPI.ipc.invoke(channels.settings.set, key, value);
  },

  delete(key: string): void {
    deleteNestedValue(cache, key); // optimistic update
    void window.electronAPI.ipc.invoke(channels.settings.delete, key);
  },

  onDidChange(key: string, callback: (newValue: unknown, oldValue: unknown) => void): () => void {
    const handler = (changedKey: unknown, newValue: unknown) => {
      if (changedKey === key) {
        const oldValue = getNestedValue(cache, key);
        callback(newValue, oldValue);
      }
    };
    window.electronAPI.ipc.on(channels.settings.changed, handler);
    return () => window.electronAPI.ipc.removeListener(channels.settings.changed, handler as never);
  },
};

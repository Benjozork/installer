import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { settingsCache } from 'renderer/utils/SettingsCache';

export const useSetting = <T>(key: string, defaultValue?: T): [T, Dispatch<SetStateAction<T>>] => {
  const [storedValue, setStoredValue] = useState<T>(settingsCache.get<T>(key, defaultValue));

  useEffect(() => {
    // Sync with latest value in case cache was updated before this component mounted
    setStoredValue(settingsCache.get<T>(key, defaultValue));

    const cancel = settingsCache.onDidChange(key, (val) => {
      setStoredValue(val as T);
    });

    return cancel;
  }, [defaultValue, key]);

  const setValue: Dispatch<SetStateAction<T>> = (newVal) => {
    const resolved = typeof newVal === 'function' ? (newVal as (prev: T) => T)(settingsCache.get<T>(key, defaultValue)) : newVal;
    settingsCache.set(key, resolved);
    setStoredValue(resolved);
  };

  return [storedValue, setValue];
};

export const useIsDarkTheme = (): boolean => {
  return true;
};

// Thin proxy so existing call-sites (settings.get / settings.set / settings.delete) keep working
const settings = {
  get<T = unknown>(key: string, defaultValue?: T): T {
    return settingsCache.get<T>(key, defaultValue);
  },
  set(key: string, value: unknown): void {
    settingsCache.set(key, value);
  },
  delete(key: string): void {
    settingsCache.delete(key);
  },
  onDidChange(key: string, callback: (newValue: unknown, oldValue: unknown) => void): () => void {
    return settingsCache.onDidChange(key, callback);
  },
};

export default settings;

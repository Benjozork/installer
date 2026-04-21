import Store, { Schema } from 'electron-store';
import * as packageInfo from '../../package.json';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { app } from 'electron';

// ---------------------------------------------------------------------------
// MSFS path detection (was in renderer/actions/install-path.utils.tsx)
// ---------------------------------------------------------------------------

type TypeOfSimulator = 'msfs2020' | 'msfs2024';

const possibleBasePaths: Record<TypeOfSimulator, { store: string; steam: string; linuxSteam: string }> = {
  msfs2020: {
    store: path.join(app.getPath('appData'), '..', 'Local', '\\Packages\\Microsoft.FlightSimulator_8wekyb3d8bbwe\\LocalCache\\'),
    steam: path.join(app.getPath('appData'), '\\Microsoft Flight Simulator\\'),
    linuxSteam: path.join(
      app.getPath('home'),
      '.local/share/Steam/steamapps/compatdata/1250410/pfx/drive_c/users/steamuser/AppData/Roaming/Microsoft Flight Simulator',
    ),
  },
  msfs2024: {
    store: path.join(app.getPath('appData'), '..', 'Local', '\\Packages\\Microsoft.Limitless_8wekyb3d8bbwe\\LocalCache\\'),
    steam: path.join(app.getPath('appData'), '\\Microsoft Flight Simulator 2024\\'),
    linuxSteam: path.join(
      app.getPath('home'),
      '.local/share/Steam/steamapps/compatdata/2537590/pfx/drive_c/users/steamuser/AppData/Roaming/Microsoft Flight Simulator 2024',
    ),
  },
};

const basePathCache: Record<string, string | null> = {};

export const msfsBasePath = (sim: TypeOfSimulator): string | null => {
  if (basePathCache[sim] !== undefined) {
    return basePathCache[sim];
  }

  if (os.platform().toString() === 'linux') {
    if (fs.existsSync(possibleBasePaths[sim].linuxSteam)) {
      return (basePathCache[sim] = possibleBasePaths[sim].linuxSteam);
    } else {
      return (basePathCache[sim] = null);
    }
  }

  let msfsConfigPath = null;

  const steamPath = path.join(possibleBasePaths[sim].steam, 'UserCfg.opt');
  const storePath = path.join(possibleBasePaths[sim].store, 'UserCfg.opt');
  if (fs.existsSync(steamPath) && fs.existsSync(storePath)) return (basePathCache[sim] = null);
  if (fs.existsSync(steamPath)) {
    msfsConfigPath = steamPath;
  } else if (fs.existsSync(storePath)) {
    msfsConfigPath = storePath;
  }

  if (!msfsConfigPath) {
    return (basePathCache[sim] = null);
  }

  return (basePathCache[sim] = path.dirname(msfsConfigPath));
};

const communityDirCache: Record<string, string | null> = {};

export const defaultCommunityDir = (msfsBase: string | null, sim: TypeOfSimulator): string | null => {
  if (!msfsBase) {
    return null;
  }

  if (communityDirCache[msfsBase] !== undefined) {
    return communityDirCache[msfsBase];
  }

  const msfsConfigPath = path.join(msfsBase, 'UserCfg.opt');
  if (!fs.existsSync(msfsConfigPath)) {
    return (communityDirCache[msfsBase] = null);
  }

  try {
    const msfsConfig = fs.readFileSync(msfsConfigPath).toString();
    const msfsConfigLines = msfsConfig.split(/\r?\n/);
    // Intentional space after InstalledPackagesPath to avoid matching InstalledPackagesPathNextBoot (MSFS2024 SU2)
    const packagesPathLine = msfsConfigLines.find((line) => line.includes('InstalledPackagesPath '));
    let communityDir = path.join(packagesPathLine.split(' ').slice(1).join(' ').replaceAll('"', ''), '\\Community');

    if (os.platform().toString() === 'linux') {
      if (msfsBase === possibleBasePaths.msfs2020.linuxSteam) {
        communityDir = communityDir
          .replaceAll('\\', '/')
          .replace(
            'C:/',
            path.join(app.getPath('home'), '.local/share/Steam/steamapps/compatdata/1250410/pfx/drive_c/'),
          );
      } else if (msfsBase === possibleBasePaths.msfs2024.linuxSteam) {
        communityDir = communityDir
          .replaceAll('\\', '/')
          .replace(
            'C:/',
            path.join(app.getPath('home'), '.local/share/Steam/steamapps/compatdata/2537590/pfx/drive_c/'),
          );
      } else {
        return (communityDirCache[msfsBase] = null);
      }
    }

    return (communityDirCache[msfsBase] = fs.existsSync(communityDir) ? communityDir : null);
  } catch (e) {
    console.warn('Could not parse community dir from file', msfsConfigPath);
    console.error(e);
    return (communityDirCache[msfsBase] = null);
  }
};

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

interface AppSettings {
  mainSettings: {
    autoStartApp: boolean;
    disableExperimentalWarning: boolean;
    disableDependencyPrompt: { [k: string]: { [k: string]: boolean } };
    disableBackgroundServiceAutoStartPrompt: { [k: string]: { [k: string]: boolean } };
    disableAddonDiskSpaceModal: { [k: string]: { [k: string]: boolean } };
    useCdnCache: boolean;
    dateLayout: string;
    useLongDateFormat: boolean;
    useDarkTheme: boolean;
    allowSeasonalEffects: boolean;
    simulator: {
      msfs2020: {
        enabled: boolean;
        basePath: string | null;
        communityPath: string | null;
        installPath: string | null;
      };
      msfs2024: {
        enabled: boolean;
        basePath: string | null;
        communityPath: string | null;
        installPath: string | null;
      };
    };
    separateTempLocation: boolean;
    tempLocation: string;
    configDownloadUrl: string;
    configForceUseLocal: boolean;
    qaConfigUrls: Record<number, string>;
  };
  cache: {
    main: {
      managedSim: string;
      lastShownSection: string;
      lastShownAddonKey: string;
      lastWindowX: number;
      lastWindowY: number;
      maximized: boolean;
    };
  };
  metaInfo: {
    lastVersion: string;
    lastLaunch: number;
  };
}

const msfs2020Base = msfsBasePath('msfs2020');
const msfs2024Base = msfsBasePath('msfs2024');

const schema: Schema<AppSettings> = {
  mainSettings: {
    type: 'object',
    default: {},
    properties: {
      autoStartApp: { type: 'boolean', default: false },
      disableExperimentalWarning: { type: 'boolean', default: false },
      disableDependencyPrompt: {
        type: 'object',
        default: {},
        additionalProperties: {
          type: 'object',
          default: {},
          additionalProperties: { type: 'object', default: {}, additionalProperties: { type: 'boolean', default: false } },
        },
      },
      disableBackgroundServiceAutoStartPrompt: {
        type: 'object',
        default: {},
        additionalProperties: { type: 'object', default: {}, additionalProperties: { type: 'boolean', default: false } },
      },
      disableAddonDiskSpaceModal: {
        type: 'object',
        default: {},
        additionalProperties: { type: 'object', default: {}, additionalProperties: { type: 'boolean', default: false } },
      },
      useCdnCache: { type: 'boolean', default: true },
      dateLayout: { type: 'string', default: 'yyyy/mm/dd' },
      useLongDateFormat: { type: 'boolean', default: false },
      useDarkTheme: { type: 'boolean', default: false },
      allowSeasonalEffects: { type: 'boolean', default: true },
      simulator: {
        type: 'object',
        default: {},
        properties: {
          msfs2020: {
            type: 'object',
            default: {},
            properties: {
              enabled: { type: 'boolean', default: msfs2020Base !== null },
              basePath: { type: ['string', 'null'], default: msfs2020Base },
              communityPath: { type: ['string', 'null'], default: defaultCommunityDir(msfs2020Base, 'msfs2020') },
              installPath: { type: ['string', 'null'], default: defaultCommunityDir(msfs2020Base, 'msfs2020') },
            },
          },
          msfs2024: {
            type: 'object',
            default: {},
            properties: {
              enabled: { type: 'boolean', default: msfs2024Base !== null },
              basePath: { type: ['string', 'null'], default: msfs2024Base },
              communityPath: { type: ['string', 'null'], default: defaultCommunityDir(msfs2024Base, 'msfs2024') },
              installPath: { type: ['string', 'null'], default: defaultCommunityDir(msfs2024Base, 'msfs2024') },
            },
          },
        },
      },
      separateTempLocation: { type: 'boolean', default: false },
      tempLocation: { type: 'string', default: app.getPath('temp') },
      configDownloadUrl: { type: 'string', default: packageInfo.configUrls.production },
      configForceUseLocal: { type: 'boolean', default: false },
      qaConfigUrls: { type: 'object', default: {}, additionalProperties: { type: 'string' } },
    },
  },
  cache: {
    type: 'object',
    default: {},
    properties: {
      main: {
        type: 'object',
        default: {},
        properties: {
          managedSim: { type: 'string', default: '' },
          lastShownSection: { type: 'string', default: '' },
          lastShownAddonKey: { type: 'string', default: '' },
          lastWindowX: { type: 'integer' },
          lastWindowY: { type: 'integer' },
          maximized: { type: 'boolean', default: false },
        },
      },
    },
  },
  metaInfo: {
    type: 'object',
    default: {},
    properties: {
      lastVersion: { type: 'string', default: '' },
      lastLaunch: { type: 'integer', default: 0 },
    },
  },
};

const store = new Store<AppSettings>({ schema, clearInvalidConfig: true });

// Flush lastLaunch default
store.set('metaInfo.lastLaunch', Date.now());

// Migrate legacy flat keys from old renderer store
if (store.get('mainSettings.msfsBasePath' as keyof AppSettings)) {
  store.set('mainSettings.simulator.msfs2020.basePath', store.get('mainSettings.msfsBasePath' as keyof AppSettings));
  store.delete('mainSettings.msfsBasePath' as keyof AppSettings);
}
if (store.get('mainSettings.msfsCommunityPath' as keyof AppSettings)) {
  store.set('mainSettings.simulator.msfs2020.communityPath', store.get('mainSettings.msfsCommunityPath' as keyof AppSettings));
  store.delete('mainSettings.msfsCommunityPath' as keyof AppSettings);
}
if (store.get('mainSettings.installPath' as keyof AppSettings)) {
  store.set('mainSettings.simulator.msfs2020.installPath', store.get('mainSettings.installPath' as keyof AppSettings));
  store.delete('mainSettings.installPath' as keyof AppSettings);
}

export const persistWindowSettings = (window: Electron.BrowserWindow): void => {
  store.set('cache.main.maximized', window.isMaximized());
  const winSize = window.getSize();
  store.set('cache.main.lastWindowX', winSize[0]);
  store.set('cache.main.lastWindowY', winSize[1]);
};

export default store;

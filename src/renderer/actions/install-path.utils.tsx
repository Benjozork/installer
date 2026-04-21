import settings from 'renderer/rendererSettings';
import { Directories } from 'renderer/utils/Directories';
import { managedSim, TypeOfSimulator } from 'renderer/utils/SimManager';
import channels from 'common/channels';

const basePathCache: Record<string, string | null> = {};
const communityDirCache: Record<string, string | null> = {};

export const msfsBasePath = async (sim: TypeOfSimulator): Promise<string | null> => {
  if (basePathCache[sim] !== undefined) {
    return basePathCache[sim];
  }
  const result = (await window.electronAPI.ipc.invoke(channels.msfs.detectBasePath, sim)) as string | null;
  return (basePathCache[sim] = result);
};

export const defaultCommunityDir = async (msfsBase: string | null, sim: TypeOfSimulator): Promise<string | null> => {
  if (!msfsBase) return null;
  const cacheKey = `${sim}:${msfsBase}`;
  if (communityDirCache[cacheKey] !== undefined) {
    return communityDirCache[cacheKey];
  }
  const result = (await window.electronAPI.ipc.invoke(channels.msfs.detectCommunityDir, msfsBase, sim)) as string | null;
  return (communityDirCache[cacheKey] = result);
};

const selectPath = async (currentPath: string, dialogTitle: string, setting: string): Promise<string> => {
  const result = (await window.electronAPI.ipc.invoke(channels.dialog.showOpenDialog, {
    title: dialogTitle,
    defaultPath: typeof currentPath === 'string' ? currentPath : '',
    properties: ['openDirectory'],
  })) as Electron.OpenDialogReturnValue;

  if (result.filePaths[0]) {
    settings.set(setting, result.filePaths[0]);
    return result.filePaths[0];
  }
  return '';
};

export const setupSimulatorBasePath = async (sim: TypeOfSimulator): Promise<string> => {
  const currentPath = Directories.simulatorBasePath(sim);

  const [storeExists, steamExists] = await Promise.all([
    window.electronAPI.ipc.invoke(channels.fs.existsSync, await getPossibleStorePath(sim)) as Promise<boolean>,
    window.electronAPI.ipc.invoke(channels.fs.existsSync, await getPossibleSteamPath(sim)) as Promise<boolean>,
  ]);

  const availablePaths: string[] = [];
  if (storeExists) availablePaths.push('Microsoft Store Edition');
  if (steamExists) availablePaths.push('Steam Edition');

  if (availablePaths.length > 0) {
    availablePaths.push('Custom Directory');

    const { response } = (await window.electronAPI.ipc.invoke(channels.dialog.showMessageBox, {
      title: 'FlyByWire Installer',
      message: `We found a possible MSFS ${sim.slice(-4)} installation.`,
      type: 'warning',
      buttons: availablePaths,
    })) as Electron.MessageBoxReturnValue;

    const selection = availablePaths[response];
    if (selection === 'Microsoft Store Edition') {
      const p = await getPossibleStorePath(sim);
      settings.set(`mainSettings.simulator.${sim}.basePath`, p);
      return p;
    } else if (selection === 'Steam Edition') {
      const p = await getPossibleSteamPath(sim);
      settings.set(`mainSettings.simulator.${sim}.basePath`, p);
      return p;
    }
    // else fall through to custom directory picker
  }

  return selectPath(currentPath, `Select your MSFS ${sim.slice(-4)} base directory`, `mainSettings.simulator.${sim}.basePath`);
};

export const setupMsfsCommunityPath = async (sim: TypeOfSimulator): Promise<string> => {
  const currentPath = Directories.installLocation(sim);
  return selectPath(currentPath, `Select your MSFS ${sim.slice(-4)} community directory`, `mainSettings.simulator.${sim}.communityPath`);
};

export const setupInstallPath = async (sim: TypeOfSimulator): Promise<string> => {
  const currentPath = Directories.installLocation(sim);
  return selectPath(currentPath, `Select your MSFS ${sim.slice(-4)} install directory`, `mainSettings.simulator.${sim}.installPath`);
};

export const setupTempLocation = async (): Promise<string> => {
  const currentPath = Directories.tempLocation(managedSim());
  return selectPath(currentPath, 'Select a location for temporary folders', 'mainSettings.tempLocation');
};

// ---------------------------------------------------------------------------
// Helpers that derive the OS-specific candidate paths via main-provided app paths
// ---------------------------------------------------------------------------

async function getPossibleStorePath(sim: TypeOfSimulator): Promise<string> {
  const base = await (window.electronAPI.ipc.invoke(channels.app.getPath, 'appData') as Promise<string>);
  if (sim === 'msfs2020') {
    return `${base}\\..\\Local\\Packages\\Microsoft.FlightSimulator_8wekyb3d8bbwe\\LocalCache\\`;
  }
  return `${base}\\..\\Local\\Packages\\Microsoft.Limitless_8wekyb3d8bbwe\\LocalCache\\`;
}

async function getPossibleSteamPath(sim: TypeOfSimulator): Promise<string> {
  const appData = await (window.electronAPI.ipc.invoke(channels.app.getPath, 'appData') as Promise<string>);
  if (sim === 'msfs2020') {
    return `${appData}\\Microsoft Flight Simulator\\`;
  }
  return `${appData}\\Microsoft Flight Simulator 2024\\`;
}

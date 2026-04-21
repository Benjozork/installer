import { Directories } from 'renderer/utils/Directories';
import checkDiskSpace from 'check-disk-space';
import { Addon } from './InstallerConfiguration';
import channels from 'common/channels';

export enum FreeDiskSpaceStatus {
  Unknown,
  NotLimited,
  LimitedByDestination,
  LimitedByTemporary,
  LimitedByBoth,
}

export interface FreeDiskSpaceInfo {
  freeSpaceInDest: number;
  freeSpaceInTemp: number;
  status: FreeDiskSpaceStatus;
}

export class FreeDiskSpace {
  static async analyse(addon: Addon, requiredSpace: number): Promise<FreeDiskSpaceInfo> {
    if (!Number.isFinite(requiredSpace)) {
      return { freeSpaceInTemp: -1, freeSpaceInDest: -1, status: FreeDiskSpaceStatus.Unknown };
    }

    let resolvedDestDir = Directories.installLocation(addon.simulator);
    let resolvedTempDir = Directories.tempLocation(addon.simulator);

    try {
      resolvedDestDir = (await window.electronAPI.ipc.invoke(channels.fs.readlink, resolvedDestDir)) as string;
    } catch {
      // not a symlink
    }

    try {
      resolvedTempDir = (await window.electronAPI.ipc.invoke(channels.fs.readlink, resolvedTempDir)) as string;
    } catch {
      // not a symlink
    }

    let freeDestDirSpace = NaN;
    try {
      freeDestDirSpace = (await checkDiskSpace(resolvedDestDir)).free;
    } catch {
      // user probably does not have `wmic` on their system
    }

    let freeTempDirSpace = NaN;
    try {
      freeTempDirSpace = (await checkDiskSpace(resolvedTempDir)).free;
    } catch {
      // user probably does not have `wmic` on their system
    }

    if (!Number.isFinite(freeDestDirSpace) || !Number.isFinite(freeTempDirSpace)) {
      return { freeSpaceInTemp: -1, freeSpaceInDest: -1, status: FreeDiskSpaceStatus.Unknown };
    }

    let status = FreeDiskSpaceStatus.NotLimited;
    if (requiredSpace >= freeDestDirSpace && requiredSpace >= freeTempDirSpace) {
      status = FreeDiskSpaceStatus.LimitedByBoth;
    } else if (requiredSpace >= freeDestDirSpace) {
      status = FreeDiskSpaceStatus.LimitedByDestination;
    } else if (requiredSpace >= freeTempDirSpace) {
      status = FreeDiskSpaceStatus.LimitedByTemporary;
    }

    return { freeSpaceInDest: freeDestDirSpace, freeSpaceInTemp: freeTempDirSpace, status };
  }
}

import channels from 'common/channels';

export class Msfs {
  static isRunning(): Promise<boolean> {
    return window.electronAPI.ipc.invoke(channels.net.checkTcpPort, 500) as Promise<boolean>;
  }
}

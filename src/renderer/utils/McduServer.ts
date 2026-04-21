import channels from 'common/channels';

export class McduServer {
  static isRunning(): Promise<boolean> {
    return window.electronAPI.ipc.invoke(channels.net.checkTcpPort, 8380) as Promise<boolean>;
  }
}

import channels from 'common/channels';
import { ipcMain, WebContents } from 'electron';
import fs from 'fs';
import { promisify } from 'util';
import path from 'path';
import { InstallPipelineFactory } from 'main/install/InstallPipelineFactory';
import { InstallPipelineExecutor } from 'main/install/InstallPipelineExecutor';
import { UINotification, UINotificationKind } from 'main/install/InstallPipeline';

export class InstallManager {
  static async install(
    sender: WebContents,
    ourInstallID: number,
    url: string,
    installDir: string,
    tempDir: string,
  ): Promise<boolean | Error> {
    const abortController = new AbortController();

    const pipeline = InstallPipelineFactory.createPipeline(url);
    const executor = new InstallPipelineExecutor();

    const handleCancelInstall = (_: unknown, installID: number) => {
      if (installID !== ourInstallID) {
        return;
      }

      abortController.abort();
    };

    // Setup cancel event listener
    ipcMain.on(channels.installManager.cancelInstall, handleCancelInstall);

    const result = await executor.execute(abortController.signal, { installDir, tempDir }, pipeline, {
      reportEvent(event: UINotification) {
        switch (event.kind) {
          case UINotificationKind.FragmenterEvent: {
            sender.send(channels.installManager.fragmenterEvent, ourInstallID, event.event, ...event.args);
          }
        }
      },
    });

    // Tear down cancel event listener
    ipcMain.removeListener(channels.installManager.cancelInstall, handleCancelInstall);

    return result;
  }

  static async uninstall(
    sender: WebContents,
    communityPackageDir: string,
    packageCacheDirs: string,
  ): Promise<boolean | Error> {
    const communityPackageDirExists = await promisify(fs.exists)(communityPackageDir);

    if (communityPackageDirExists) {
      await fs.promises.rm(communityPackageDir, { recursive: true });
    }

    for (const packageCacheDir of packageCacheDirs) {
      const packageCacheDirExists = await promisify(fs.exists)(packageCacheDir);

      if (packageCacheDirExists) {
        const dirents = await fs.promises.readdir(packageCacheDir);

        for (const dirent of dirents) {
          if (dirent !== 'work') {
            await fs.promises.unlink(path.join(packageCacheDir, dirent));
          }
        }
      }
    }

    return true;
  }

  static setupIpcListeners(): void {
    ipcMain.handle(
      channels.installManager.installFromUrl,
      async (event, installID: number, url: string, tempDir: string, destDir: string) => {
        return InstallManager.install(event.sender, installID, url, destDir, tempDir);
      },
    );

    ipcMain.handle(
      channels.installManager.uninstall,
      async (event, communityPackageDir: string, packageCacheDirs: string) => {
        return InstallManager.uninstall(event.sender, communityPackageDir, packageCacheDirs);
      },
    );
  }
}

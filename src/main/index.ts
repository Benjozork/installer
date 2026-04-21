import { app, BrowserWindow, Menu, shell, ipcMain } from 'electron';
import { NsisUpdater, autoUpdater } from 'electron-updater';
import installExtension, { REDUX_DEVTOOLS, REACT_DEVELOPER_TOOLS } from 'electron-devtools-installer';
import * as packageInfo from '../../package.json';
import appSettings, { persistWindowSettings } from './appSettings';
import channels from 'common/channels';
import { InstallManager } from 'main/InstallManager';
import { SentryClient } from 'main/SentryClient';
import { SystemHandlers } from 'main/ipc/SystemHandlers';
import path from 'path';

function initializeApp() {
  let mainWindow: BrowserWindow;

  const getMainWindow = () => mainWindow;

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 1280,
      minHeight: 800,
      frame: false,
      icon: 'src/main/icons/icon.ico',
      backgroundColor: '#1b2434',
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../preload/index.js'),
      },
    });

    const UpsertKeyValue = (
      header: Record<string, string> | Record<string, string[]>,
      keyToChange: string,
      value: string | string[],
    ) => {
      for (const key of Object.keys(header)) {
        if (key.toLowerCase() === keyToChange.toLowerCase()) {
          header[key] = value;
          return;
        }
      }
      header[keyToChange] = value;
    };

    // Prevent <a> tags from opening in Electron
    mainWindow.webContents.setWindowOpenHandler(() => {
      return { action: 'deny' };
    });

    mainWindow.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
      const { requestHeaders } = details;
      UpsertKeyValue(requestHeaders, 'Access-Control-Allow-Origin', '*');
      callback({ requestHeaders });
    });

    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      const { responseHeaders } = details;
      UpsertKeyValue(responseHeaders, 'Access-Control-Allow-Origin', ['*']);
      UpsertKeyValue(responseHeaders, 'Access-Control-Allow-Headers', ['*']);
      callback({ responseHeaders });
    });

    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });

    mainWindow.on('closed', () => {
      mainWindow.removeAllListeners();
      app.quit();
    });

    ipcMain.on(channels.window.minimize, () => {
      mainWindow.minimize();
    });

    ipcMain.on(channels.window.maximize, () => {
      mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
    });

    ipcMain.on(channels.window.close, () => {
      persistWindowSettings(mainWindow);
      mainWindow.destroy();
    });

    ipcMain.on(channels.window.reload, () => {
      mainWindow.reload();
    });

    ipcMain.on(channels.window.isMaximized, (event) => {
      event.sender.send(channels.window.isMaximized, mainWindow.isMaximized());
    });

    ipcMain.on(channels.openPath, (_, value: string) => {
      void shell.openPath(value);
    });

    ipcMain.on('request-startup-at-login-changed', (_, value: boolean) => {
      app.setLoginItemSettings({ openAtLogin: value });
    });

    ipcMain.on('set-window-progress-bar', (_, value: number) => {
      mainWindow.setProgressBar(value);
    });

    // Register all new system IPC handlers
    SystemHandlers.setupIpcListeners(appSettings, getMainWindow);

    const lastX = appSettings.get<string, number>('cache.main.lastWindowX');
    const lastY = appSettings.get<string, number>('cache.main.lastWindowY');
    const shouldMaximize = appSettings.get<string, boolean>('cache.main.maximized');

    if (shouldMaximize) {
      mainWindow.maximize();
    } else if (lastX && lastY) {
      mainWindow.setBounds({ width: lastX, height: lastY });
    }

    mainWindow.center();

    if (
      (appSettings.get('mainSettings.configDownloadUrl') as string) ===
      'https://cdn.flybywiresim.com/installer/config/production.json'
    ) {
      appSettings.set('mainSettings.configDownloadUrl', packageInfo.configUrls.production);
    }

    if (import.meta.env.DEV) {
      mainWindow.webContents.openDevTools();
    }

    if (!app.isPackaged) {
      mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL).then();
    } else {
      mainWindow.loadFile(path.join(__dirname, '../renderer/index.html')).then();
    }

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url).then();
      return { action: 'deny' };
    });

    if (import.meta.env.DEV) {
      appSettings.openInEditor();
      mainWindow.webContents.once('dom-ready', () => {
        mainWindow.webContents.openDevTools();
      });
    }

    // Auto updater
    if (process.env.NODE_ENV !== 'development') {
      let updateOptions;
      if (packageInfo.version.includes('dev')) {
        updateOptions = { provider: 'generic' as const, url: 'https://flybywirecdn.com/installer/dev' };
      } else if (packageInfo.version.includes('rc')) {
        updateOptions = { provider: 'generic' as const, url: 'https://flybywirecdn.com/installer/rc' };
      } else {
        updateOptions = { provider: 'generic' as const, url: 'https://flybywirecdn.com/installer/release' };
      }

      const winAutoUpdater = new NsisUpdater(updateOptions);
      const appImageAutoUpdater = autoUpdater;

      if (process.platform === 'win32') {
        winAutoUpdater.addListener('update-downloaded', (event, releaseNotes, releaseName) => {
          mainWindow.webContents.send(channels.update.downloaded, { event, releaseNotes, releaseName });
        });
        winAutoUpdater.addListener('update-available', () => {
          mainWindow.webContents.send(channels.update.available);
        });
        winAutoUpdater.addListener('error', (error) => {
          mainWindow.webContents.send(channels.update.error, { error });
        });
      }

      if (process.platform === 'linux' && process.env.APPIMAGE) {
        appImageAutoUpdater.addListener('update-downloaded', (event, releaseNotes, releaseName) => {
          mainWindow.webContents.send(channels.update.downloaded, { event, releaseNotes, releaseName });
        });
        appImageAutoUpdater.addListener('update-available', () => {
          mainWindow.webContents.send(channels.update.available);
        });
        appImageAutoUpdater.addListener('error', (error) => {
          mainWindow.webContents.send(channels.update.error, { error });
        });
      }

      mainWindow.once('show', () => {
        if (process.platform === 'win32') {
          winAutoUpdater.checkForUpdates().then();
        } else if (process.platform === 'linux' && process.env.APPIMAGE) {
          appImageAutoUpdater.checkForUpdates().then();
        }
      });

      ipcMain.on(channels.checkForInstallerUpdate, () => {
        if (process.platform === 'win32') {
          winAutoUpdater.checkForUpdates().then();
        } else if (process.platform === 'linux' && process.env.APPIMAGE) {
          appImageAutoUpdater.checkForUpdates().then();
        }
      });

      ipcMain.on('restartAndUpdate', () => {
        if (process.platform === 'win32') {
          winAutoUpdater.quitAndInstall();
        } else if (process.platform === 'linux' && process.env.APPIMAGE) {
          appImageAutoUpdater.quitAndInstall();
        }
        app.exit();
      });
    }
  }

  if (!app.requestSingleInstanceLock()) {
    app.quit();
  }

  app.setAppUserModelId('FlyByWire Installer');

  Menu.setApplicationMenu(null);

  app.on('ready', () => {
    createWindow();

    if (import.meta.env.DEV) {
      installExtension(REACT_DEVELOPER_TOOLS)
        .then((name) => console.log(`Added Extension:  ${name}`))
        .catch((err) => console.log('An error occurred: ', err));

      installExtension(REDUX_DEVTOOLS)
        .then((name) => console.log(`Added Extension:  ${name}`))
        .catch((err) => console.log('An error occurred: ', err));
    }

    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (
        input.type === 'keyUp' &&
        (input.key.toLowerCase() === 'r' || input.key === 'F5') &&
        (input.control || input.meta)
      ) {
        mainWindow.isFocused() && mainWindow.reload();
      }

      if (input.type === 'keyUp' && input.key === 'F12' && (input.control || input.meta)) {
        mainWindow.isFocused() && mainWindow.webContents.toggleDevTools();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });
}

SentryClient.initialize();

InstallManager.setupIpcListeners();

initializeApp();

export default {
  window: {
    minimize: 'window/minimize',
    maximize: 'window/maximize',
    close: 'window/close',
    isMaximized: 'window/isMaximized',
    reload: 'window/reload',
  },
  update: {
    error: 'update/error',
    available: 'update/available',
    downloaded: 'update/downloaded',
  },
  checkForInstallerUpdate: 'checkForInstallerUpdate',
  installManager: {
    fragmenterEvent: 'installManager/fragmenterEvent',
    installFromUrl: 'installManager/installFromUrl',
    cancelInstall: 'installManager/cancelInstall',
    uninstall: 'installManager/uninstall',
  },
  sentry: {
    requestSessionID: 'sentry/requestSessionID',
    provideSessionID: 'sentry/provideSessionID',
  },
  openPath: 'openPath',
  app: {
    getPath: 'app/getPath',
  },
  shell: {
    openExternal: 'shell/openExternal',
    writeShortcutLink: 'shell/writeShortcutLink',
    removeShortcut: 'shell/removeShortcut',
  },
  dialog: {
    showOpenDialog: 'dialog/showOpenDialog',
    showMessageBox: 'dialog/showMessageBox',
  },
  net: {
    checkTcpPort: 'net/checkTcpPort',
  },
  fs: {
    existsSync: 'fs/existsSync',
    mkdirSync: 'fs/mkdirSync',
    rmSync: 'fs/rmSync',
    readFile: 'fs/readFile',
    writeFile: 'fs/writeFile',
    readdir: 'fs/readdir',
    readlink: 'fs/readlink',
  },
  directories: {
    removeAllTemp: 'directories/removeAllTemp',
    removeAlternativesForAddon: 'directories/removeAlternativesForAddon',
    isGitInstall: 'directories/isGitInstall',
    isFragmenterInstall: 'directories/isFragmenterInstall',
  },
  settings: {
    getAll: 'settings/getAll',
    get: 'settings/get',
    set: 'settings/set',
    delete: 'settings/delete',
    changed: 'settings/changed',
  },
  msfs: {
    detectBasePath: 'msfs/detectBasePath',
    detectCommunityDir: 'msfs/detectCommunityDir',
  },
};

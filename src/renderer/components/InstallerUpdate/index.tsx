import React, { useEffect, useState } from 'react';
import channels from 'common/channels';

enum UpdateState {
  Standby,
  DownloadingUpdate,
  RestartToUpdate,
}

export const InstallerUpdate = (): JSX.Element => {
  const [updateState, setUpdateState] = useState(UpdateState.Standby);

  const updateNeeded = updateState !== UpdateState.Standby;

  let buttonText;
  switch (updateState) {
    case UpdateState.Standby:
      buttonText = '';
      break;
    case UpdateState.DownloadingUpdate:
      buttonText = 'Downloading update';
      break;
    case UpdateState.RestartToUpdate:
      buttonText = 'Restart to update';
      break;
  }

  useEffect(() => {
    const updateErrorHandler = (...args: unknown[]) => {
      console.error('Update error', args);
    };

    const updateAvailableHandler = () => {
      console.log('Update available');
      setUpdateState(UpdateState.DownloadingUpdate);
    };

    const updateDownloadedHandler = (...args: unknown[]) => {
      console.log('Update downloaded', args);

      setUpdateState(UpdateState.RestartToUpdate);

      Notification.requestPermission()
        .then(() => {
          console.log('Showing Update notification');
          new Notification('Restart to update!', {
            icon: `${window.electronAPI.resourcesPath}/extraResources/icon.ico`,
            body: 'An update to the installer has been downloaded',
          });
        })
        .catch((e) => console.log(e));
    };

    window.electronAPI.ipc.on(channels.update.error, updateErrorHandler);
    window.electronAPI.ipc.on(channels.update.available, updateAvailableHandler);
    window.electronAPI.ipc.on(channels.update.downloaded, updateDownloadedHandler);

    return () => {
      window.electronAPI.ipc.removeListener(channels.update.error, updateErrorHandler);
      window.electronAPI.ipc.removeListener(channels.update.available, updateAvailableHandler);
      window.electronAPI.ipc.removeListener(channels.update.downloaded, updateDownloadedHandler);
    };
  }, []);

  return (
    <div
      className={`z-50 flex h-full cursor-pointer items-center justify-center place-self-start bg-yellow-500 px-4 transition duration-200 hover:bg-yellow-600 ${
        updateNeeded ? 'visible' : 'hidden'
      }`}
      onClick={() => {
        if (updateState === UpdateState.RestartToUpdate) {
          window.electronAPI.ipc.send('restartAndUpdate');
        }
      }}
    >
      <div className="text-lg font-semibold text-white">{buttonText}</div>
    </div>
  );
};

import { useEffect, useState } from 'react';
import settings from 'renderer/rendererSettings';
import { Directories } from 'renderer/utils/Directories';
import { Simulators, TypeOfSimulator } from 'renderer/utils/SimManager';
import channels from 'common/channels';

export const useErrors = () => {
  const [errors, setErrors] = useState({
    noSimInstalled: false,
    msfs2020BasePathError: false,
    msfs2024BasePathError: false,
    msfs2020InstallError: false,
    msfs2024InstallError: false,
    tempLocationError: false,
  });

  useEffect(() => {
    const checkErrors = async () => {
      const checkExists = (p: string | null) =>
        p ? (window.electronAPI.ipc.invoke(channels.fs.existsSync, p) as Promise<boolean>) : Promise.resolve(false);

      const hasBasePathError = async (sim: TypeOfSimulator) => {
        if (!settings.get(`mainSettings.simulator.${sim}.enabled`)) return false;
        const basePath = Directories.simulatorBasePath(sim);
        if (basePath === null || basePath === 'notInstalled') return basePath === null;
        return !(await checkExists(basePath));
      };

      const hasInstallError = async (sim: TypeOfSimulator) => {
        if (!settings.get(`mainSettings.simulator.${sim}.enabled`)) return false;
        const [installOk, communityOk] = await Promise.all([
          checkExists(Directories.installLocation(sim)),
          checkExists(Directories.communityLocation(sim)),
        ]);
        return !installOk || Directories.installLocation(sim) === null || !communityOk;
      };

      const [
        msfs2020BasePathError,
        msfs2024BasePathError,
        msfs2020InstallError,
        msfs2024InstallError,
        tempLocationError,
      ] = await Promise.all([
        hasBasePathError(Simulators.Msfs2020),
        hasBasePathError(Simulators.Msfs2024),
        hasInstallError(Simulators.Msfs2020),
        hasInstallError(Simulators.Msfs2024),
        checkExists(settings.get('mainSettings.tempLocation')).then((ok) => !ok),
      ]);

      const noSimInstalled =
        !settings.get(`mainSettings.simulator.${Simulators.Msfs2020}.enabled`) &&
        !settings.get(`mainSettings.simulator.${Simulators.Msfs2024}.enabled`);

      setErrors({
        noSimInstalled,
        msfs2020BasePathError,
        msfs2024BasePathError,
        msfs2020InstallError,
        msfs2024InstallError,
        tempLocationError,
      });
    };

    void checkErrors();
  }, []);

  return errors;
};

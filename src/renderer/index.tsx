import React from 'react';
import ReactDOM from 'react-dom';
import * as Sentry from '@sentry/electron/renderer';
import { browserTracingIntegration } from '@sentry/browser';
import { Provider } from 'react-redux';
import App from 'renderer/components/App';
import { Configuration, InstallerConfiguration } from 'renderer/utils/InstallerConfiguration';
import { Directories } from 'renderer/utils/Directories';
import channels from 'common/channels';
import { MemoryRouter } from 'react-router-dom';
import { store } from 'renderer/redux/store';
import { setConfiguration } from './redux/features/configuration';
import { GitVersions } from '@flybywiresim/api-client';
import { addReleases } from 'renderer/redux/features/releaseNotes';
import { ModalProvider } from 'renderer/components/Modal';
import { setSentrySessionID } from 'renderer/redux/features/sentrySessionID';
import packageJson from '../../package.json';
import { initSettingsCache } from 'renderer/utils/SettingsCache';
import { initAppPaths } from 'renderer/utils/AppPaths';

import 'simplebar-react/dist/simplebar.min.css';
import './index.scss';
import { Button, ButtonType } from 'renderer/components/Button';

// Setup Sentry
Sentry.init({
  release: packageJson.version,
  integrations: [browserTracingIntegration()],
  tracesSampleRate: 1.0,
  beforeBreadcrumb: (event) => {
    if (event.category === 'fetch' && event.data.url.startsWith('http://localhost')) {
      return null;
    }
    return event;
  },
});

async function bootstrap() {
  // Load settings cache and app paths from main before any renderer code runs
  await Promise.all([initSettingsCache(), initAppPaths()]);

  // Request Sentry session ID
  window.electronAPI.ipc
    .invoke(channels.sentry.requestSessionID)
    .then((sessionID) => store.dispatch(setSentrySessionID(sessionID as string)));

  // Obtain configuration and use it
  InstallerConfiguration.obtain()
    .then((config: Configuration) => {
      store.dispatch(setConfiguration({ configuration: config }));

      for (const publisher of config.publishers) {
        for (const addon of publisher.addons) {
          if (addon.repoOwner && addon.repoName) {
            GitVersions.getReleases(addon.repoOwner, addon.repoName, false, 0, 5).then((res) => {
              const content = res.map((release) => ({
                name: release.name,
                publishedAt: release.publishedAt.getTime(),
                htmlUrl: release.htmlUrl,
                body: release.body,
              }));

              if (content.length) {
                store.dispatch(addReleases({ key: addon.key, releases: content }));
              } else {
                store.dispatch(addReleases({ key: addon.key, releases: [] }));
              }
            });
          } else {
            store.dispatch(addReleases({ key: addon.key, releases: [] }));
          }
        }
      }

      console.log('Using this configuration:', config);

      void Directories.removeAllTemp();

      ReactDOM.render(
        <Provider store={store}>
          <MemoryRouter>
            <ModalProvider>
              <App />
            </ModalProvider>
          </MemoryRouter>
        </Provider>,
        document.getElementById('root'),
      );
    })
    .catch((error: Error) => {
      ReactDOM.render(
        <div className="flex h-screen flex-col items-center justify-center gap-y-5 bg-navy text-gray-100">
          <span className="text-5xl font-semibold">Something went very wrong.</span>
          <span className="w-3/5 text-center text-2xl">
            We could not configure your installer. Please seek support on the Discord #support channel or on GitHub and
            provide a screenshot of the following information:
          </span>
          <pre className="mb-0 w-3/5 overflow-scroll rounded-lg bg-gray-700 px-6 py-2.5 font-mono text-2xl">
            {error.stack}
          </pre>

          <Button
            type={ButtonType.Neutral}
            onClick={() => window.electronAPI.ipc.send(channels.window.close)}
          >
            Close the installer
          </Button>
        </div>,
        document.getElementById('root'),
      );
    });
}

void bootstrap();

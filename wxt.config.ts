import { defineConfig } from 'wxt';
import { existsSync } from 'node:fs';
import path from 'node:path';

const detectBinary = (...candidates: Array<string | undefined>) =>
  candidates.find((candidate) => candidate && existsSync(candidate));

const resolveBraveBinary = () => {
  const candidates: Array<string | undefined> = [
    process.env.BRAVE_BROWSER_BINARY,
    process.env.BRAVE_BINARY,
  ];

  if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
    );
  } else if (process.platform === 'win32') {
    const programFiles = process.env.PROGRAMFILES;
    const programFilesX86 = process.env['PROGRAMFILES(X86)'];
    if (programFiles) {
      candidates.push(
        path.join(
          programFiles,
          'BraveSoftware',
          'Brave-Browser',
          'Application',
          'brave.exe'
        )
      );
    }
    if (programFilesX86) {
      candidates.push(
        path.join(
          programFilesX86,
          'BraveSoftware',
          'Brave-Browser',
          'Application',
          'brave.exe'
        )
      );
    }
  } else {
    candidates.push(
      '/usr/bin/brave-browser',
      '/usr/bin/brave',
      '/snap/bin/brave'
    );
  }

  return detectBinary(...candidates);
};

const resolveEdgeBinary = () => {
  const candidates: Array<string | undefined> = [
    process.env.EDGE_BROWSER_BINARY,
    process.env.EDGE_BINARY,
  ];

  if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    );
  } else if (process.platform === 'win32') {
    const programFiles = process.env.PROGRAMFILES;
    const programFilesX86 = process.env['PROGRAMFILES(X86)'];
    if (programFiles) {
      candidates.push(
        path.join(
          programFiles,
          'Microsoft',
          'Edge',
          'Application',
          'msedge.exe'
        )
      );
    }
    if (programFilesX86) {
      candidates.push(
        path.join(
          programFilesX86,
          'Microsoft',
          'Edge',
          'Application',
          'msedge.exe'
        )
      );
    }
  } else {
    candidates.push(
      '/usr/bin/microsoft-edge',
      '/usr/bin/microsoft-edge-stable',
      '/usr/bin/microsoft-edge-beta',
      '/usr/bin/microsoft-edge-dev'
    );
  }

  return detectBinary(...candidates);
};

const braveBinary = resolveBraveBinary();
const edgeBinary = resolveEdgeBinary();

const runnerBinaries: Record<string, string> = {};
if (braveBinary) {
  runnerBinaries.brave = braveBinary;
}
if (edgeBinary) {
  runnerBinaries.edge = edgeBinary;
}

const runnerConfig = Object.keys(runnerBinaries).length
  ? { binaries: runnerBinaries }
  : undefined;

export default defineConfig({
  modules: ['@wxt-dev/webextension-polyfill'],
  root: '.',
  srcDir: '.',
  entrypointsDir: 'entrypoints',
  outDir: 'build',
  manifestVersion: 3,
  browser: 'brave',
  runner: runnerConfig,
  manifest: ({ browser }) => {
    const baseManifest = {
      name: 'Hide My Email+',
      description:
        "Use iCloud's Hide My Email service in your browser with Hide My Email+.",
      version: process.env.npm_package_version ?? '1.0.0',
      background: {
        service_worker: 'background.js',
        type: 'module' as const,
      },
      action: {
        default_popup: 'popup.html',
        default_icon: 'icon-32.png',
      },
      content_scripts: [
        {
          matches: ['http://*/*', 'https://*/*', '<all_urls>'],
          js: ['content-script.js'],
          css: ['assets/content-script.css'],
        },
      ],
      options_page: 'options.html',
      declarative_net_request: {
        rule_resources: [
          {
            id: 'icloud_com_simulation_headers',
            enabled: true,
            path: 'rules.json',
          },
        ],
      },
      permissions: [
        'declarativeNetRequest',
        'storage',
        'tabs',
        'contextMenus',
        'webRequest',
        'notifications',
      ],
      host_permissions: ['https://*.icloud.com/*'],
      icons: {
        '16': 'icon-16.png',
        '32': 'icon-32.png',
        '48': 'icon-48.png',
        '128': 'icon-128.png',
      },
    };

    if (browser === 'firefox') {
      return {
        ...baseManifest,
        background: {
          scripts: ['background.js'],
        },
        browser_specific_settings: {
          gecko: {
            id: '{b3b720a0-8bf9-4e1f-b0e2-1e97f6ff708b}',
            strict_min_version: '126.0',
            data_collection_permissions: {
              required: ['none'],
            },
          },
          gecko_android: {
            strict_min_version: '126.0',
            data_collection_permissions: {
              required: ['none'],
            },
          },
        },
      };
    }

    return baseManifest;
  },
});

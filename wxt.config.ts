import { defineConfig } from 'wxt';
import { existsSync } from 'node:fs';
import path from 'node:path';

const detectBinary = (...candidates: Array<string | undefined>) =>
  candidates.find((candidate) => candidate && existsSync(candidate));

type BrowserBinarySpec = {
  /** Environment variables checked first, in order of precedence. */
  envVars: string[];
  /** Absolute path to the macOS app bundle executable. */
  darwinPath: string;
  /** Path segments below "Program Files" on Windows. */
  windowsPathSegments: string[];
  /** Absolute paths to try on Linux and other platforms. */
  linuxPaths: string[];
};

const resolveBrowserBinary = ({
  envVars,
  darwinPath,
  windowsPathSegments,
  linuxPaths,
}: BrowserBinarySpec) => {
  const candidates: Array<string | undefined> = envVars.map(
    (envVar) => process.env[envVar]
  );

  if (process.platform === 'darwin') {
    candidates.push(darwinPath);
  } else if (process.platform === 'win32') {
    for (const programFiles of [
      process.env.PROGRAMFILES,
      process.env['PROGRAMFILES(X86)'],
    ]) {
      if (programFiles) {
        candidates.push(path.join(programFiles, ...windowsPathSegments));
      }
    }
  } else {
    candidates.push(...linuxPaths);
  }

  return detectBinary(...candidates);
};

const braveBinary = resolveBrowserBinary({
  envVars: ['BRAVE_BROWSER_BINARY', 'BRAVE_BINARY'],
  darwinPath: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  windowsPathSegments: [
    'BraveSoftware',
    'Brave-Browser',
    'Application',
    'brave.exe',
  ],
  linuxPaths: ['/usr/bin/brave-browser', '/usr/bin/brave', '/snap/bin/brave'],
});

const edgeBinary = resolveBrowserBinary({
  envVars: ['EDGE_BROWSER_BINARY', 'EDGE_BINARY'],
  darwinPath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  windowsPathSegments: ['Microsoft', 'Edge', 'Application', 'msedge.exe'],
  linuxPaths: [
    '/usr/bin/microsoft-edge',
    '/usr/bin/microsoft-edge-stable',
    '/usr/bin/microsoft-edge-beta',
    '/usr/bin/microsoft-edge-dev',
  ],
});

const browserBinaries: Record<string, string> = {};
if (braveBinary) {
  browserBinaries.brave = braveBinary;
}
if (edgeBinary) {
  browserBinaries.edge = edgeBinary;
}

const webExtConfig = Object.keys(browserBinaries).length
  ? { binaries: browserBinaries }
  : undefined;

export default defineConfig({
  modules: ['@wxt-dev/webextension-polyfill'],
  // Demo mode is compiled in only for non-release builds. Replacing the flag at
  // build time (rather than exporting a runtime constant) lets the bundler drop
  // the demo UI and mockClient.ts from release output instead of shipping them
  // unreachable. WXT gives every non-production mode its own output directory,
  // so a demo-enabled build cannot be mistaken for a release artifact.
  vite: (env) => ({
    define: {
      __DEMO_MODE_AVAILABLE__: JSON.stringify(env.mode !== 'production'),
    },
  }),
  root: '.',
  srcDir: '.',
  entrypointsDir: 'entrypoints',
  outDir: 'build',
  manifestVersion: 3,
  browser: 'brave',
  webExt: webExtConfig,
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
          all_frames: true,
          match_about_blank: true,
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
      commands: {
        'suggest-alias': {
          suggested_key: {
            default: 'Alt+Shift+H',
            mac: 'Alt+Shift+H',
          },
          description: 'Generate and reserve a Hide My Email+ alias',
        },
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

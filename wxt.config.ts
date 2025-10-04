import { defineConfig } from 'wxt';

export default defineConfig({
  outDir: 'build',
  manifest: ({ browser }) => {
    const baseManifest = {
      name: 'Hide My Email+',
      description:
        "Use iCloud's Hide My Email service in your browser with Hide My Email+.",
      version: process.env.npm_package_version ?? '1.0.0',
      manifest_version: 3,
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
          css: ['content-script.css'],
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

# Hide My Email+ Browser Extension

This is a fork of the [icloud-hide-my-email-browser-extension](https://github.com/dedoussis/icloud-hide-my-email-browser-extension) by Dimitrios Dedoussis, with some modifications by Sachit Vithaldas.

Hide My Email+ builds on iCloud's [Hide My Email](https://support.apple.com/en-us/HT210425) privacy service. Safari offers a native integration with Hide My Email, whereby users are prompted to generate a Hide My Email address upon registration to any website. This extension aims to bring a similar UX into a wider variety of browsers.

[![codecov](https://codecov.io/gh/sachitv/icloud-hide-my-email-browser-plus-extension/graph/badge.svg?token=8ZAZ0Z9LZS)](https://codecov.io/gh/sachitv/icloud-hide-my-email-browser-plus-extension)

## Supported Browsers

- [Chrome](https://chromewebstore.google.com/detail/hide-my-email+/olkpkcclmmjmmknlhdggcjiefbdgjfke?hl=en)
- [Firefox](https://addons.mozilla.org/en-GB/firefox/addon/hide-my-email-plus/)
- [Brave](https://chromewebstore.google.com/detail/hide-my-email+/olkpkcclmmjmmknlhdggcjiefbdgjfke?hl=en)
- [Microsoft Edge](https://microsoftedge.microsoft.com/addons/detail/hide-my-email/dphflggbjdfhbgpodjplabjnfjdppknf)

The extension _should_ work on any browser that implements the [Manifest V3 extension API](https://developer.chrome.com/docs/extensions/reference/) supported by Chromium-based browsers.

_Disclaimer: This extension is not endorsed by, directly affiliated with, maintained, authorized, or sponsored by Apple._

<p align="center">
<img src="./src/assets/img/demo-popup.gif" alt="Extension popup demo" width="400" height="auto"/>
</p>

<p align="center">
<img src="./src/assets/img/demo-content.gif" alt="Extension content demo" width="600" height="auto"/>
</p>

## Features

- Simple pop-up UI for generating and reserving new Hide My Email+ aliases
- Ability to manage existing Hide My Email+ aliases (including deactivation, reactivation, and deletion)
- Autofilling on any HTML input element that is relevant to email
- Quick configuration of Hide My Email+ settings, such as the Forward-To address, through the Options page of the extension

## Options

### Address autofilling

The extension can be configured to

1. show an autofill button on input field focus
2. show a context menu item when right-clicking on input fields

<p align="center">
<img src="./src/assets/img/readme-button-autofilling.gif" alt="Autofilling button on input field focus" width="400" height="auto"/>
</p>

<p align="center">
<img src="./src/assets/img/readme-context-menu-autofilling.png" alt="Context menu item when right-clicking on input fields" width="400" height="auto"/>
</p>

You can enable/disable any of the autofilling mechanisms through the Options page of the extension.

## Develop

This extension is entirely written in TypeScript. The UI pages of the extension (e.g. Pop-Up and Options) are implemented as React apps and styled with Tailwind CSS.

### Environment

#### Prerequisites

- Node.js 22 LTS.

Once the prerequisites are installed, run `npm install` from the repository root to bootstrap the project.

### Development workflow

The table below outlines the sequence of steps that need to be followed in order to ship a change in the extension. The execution of some of these steps varies per browser engine.

Note: the following console commands are to be executed from the root directory of this repo

<!-- prettier-ignore-start -->
| # | Description | Brave | Chrome | Edge | Firefox |
| - | - | - | - | - | - |
| 0 | Install deps | `npm ci` | `npm ci` | `npm ci` | `npm ci && npm i -g web-ext` |
| 1 | Spin up the WXT dev server. The server generates the `build` dir and opens the browser. | `npm run start:brave` | `npm run start:chrome` | `npm run start:edge` | `npm run start:firefox`<br/>**Important**: Firefox dev tooling still runs MV2, so confirm MV3 behaviour with a production build before shipping. |
| 2 | Build productionized artifact | `npm run build:brave` | `npm run build:chrome` | `npm run build:edge` | `npm run build:firefox` |
| 3 | Create store-ready ZIP | `npm run package:brave` | `npm run package:chrome` | `npm run package:edge` | `npm run package:firefox` |
| 4 | Publish | [Chrome Web Store developer console](https://chrome.google.com/webstore/devconsole/) | [Chrome Web Store developer console](https://chrome.google.com/webstore/devconsole/) | [Microsoft Partner Center](https://partner.microsoft.com/en-us/dashboard/microsoftedge/overview) | [Mozilla Add-on Developer Hub](https://addons.mozilla.org/en-US/developers/addon/icloud-hide-my-email/versions/submit/) |
<!-- prettier-ignore-end -->

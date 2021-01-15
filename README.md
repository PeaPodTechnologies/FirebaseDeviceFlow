# Firebase Device Flow

[![forthebadge](https://forthebadge.com/images/badges/made-with-crayons.svg)](https://forthebadge.com) [![forthebadge](https://forthebadge.com/images/badges/gluten-free.svg)](https://forthebadge.com) [![forthebadge](https://forthebadge.com/images/badges/no-ragrets.svg)](https://forthebadge.com) [![forthebadge](https://forthebadge.com/images/badges/open-source.svg)](https://forthebadge.com) [![forthebadge](https://forthebadge.com/images/badges/powered-by-coffee.svg)](https://forthebadge.com)

Firebase authentication via [OAuth2 'Device Flow'](https://www.oauth.com/oauth2-servers/device-flow/) for Node.js CLI applications on limited input devices (i.e. IoT).

## Providers Currently Implemented

- GitHub [(Docs)](https://docs.github.com/en/free-pro-team@latest/developers/apps/authorizing-oauth-apps#device-flow)
- Google [(Docs)](https://developers.google.com/identity/protocols/oauth2/limited-input-device)

## Example Usage

See [test.js](./test.js).

1. Import `FirebaseDeviceFlow`.
2. Initialize Firebase app.
3. Pass app reference and OAuth config to `DeviceFlowUI` constructor.
4. `DeviceFlowUI.signIn()`

## How It Works

Google has a great resource on ["OAuth 2.0 for TV and Limited-Input Device Applications"](https://developers.google.com/identity/protocols/oauth2/limited-input-device#obtaining-oauth-2.0-access-tokens).

![Device Flow Diagram](https://developers.google.com/identity/protocols/images/oauth2/device/flow.png)

# Development

## Requirements

- Node.js and `npm`
- Install JS dependencies with `npm i`

## Todo

- [ ] 'Slow down' error code handling
- [ ] Add more providers?
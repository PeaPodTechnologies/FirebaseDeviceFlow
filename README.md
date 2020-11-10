# Firebase Device Flow
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

Refer to Google's ["OAuth 2.0 for TV and Limited-Input Device Applications" Documentation](https://developers.google.com/identity/protocols/oauth2/limited-input-device#obtaining-oauth-2.0-access-tokens).

![Device Flow Diagram](https://developers.google.com/identity/protocols/images/oauth2/device/flow.png)

# Development

## Requirements

- Node.js and `npm`
- All dependencies in [`package.json`](./package.json)

## Todo

- [] Improve error code reaction per-provider
- [] Add more providers?
- ...
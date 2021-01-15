//Firebase Dependencies
const firebase = require("firebase/app");
require('firebase/auth');

//HTTP
const axios = require("axios").default;

//UI
const ora = require('ora');
const chalk = require('chalk');
const inquirer = require('inquirer');
const sleep = millis => {
    return new Promise(resolve => {
        setTimeout(resolve, millis);
    });
};

/**
 * Failure, success, etc. conditions for an Axios responses.
 * @callback ResponseConditions
 * @param {AxiosResponse} response Axios response object.
 * @returns {Boolean} Does the repsonse meet certain conditions?
 */

/**
 * POSTs an endpoint repeatedly until either success or failure conditions are met.
 * @param {String} url - The URL of the endpoint to POST.
 * @param {Object} body - The body of the POST request.
 * @param {ResponseConditions} successConditions Success conditions. True if successful response, then this will return `response.data`.
 * @param {ResponseConditions} failureConditions Failure conditions. True if failed response, then this will throw `response`.
 * @param {Number} interval - The delay in seconds between attempts. Defaults to 1 second.
 * @param {Number} timeout - The maximum time in seconds to spend trying to fetch. Defaults to 10 seconds.
 * @param {Object} options - Options for the Axios POST handler. Defaults to requesting JSON and disable status code validation.
 * @returns {Promise<AxiosResponse | Error>} The response.
 */
function repeatedPOST(url, body, successConditions, failureConditions, interval = 1, timeout = 10, options = {
    headers: {
        'Accept': 'application/json'
    },
    validateStatus: undefined
}) {
    return new Promise((resolve, reject) => {
        const _interval = setInterval(async () => {
            try {
                let response = await axios.post(url, body, options);
                if (successConditions(response)) {
                    end();
                    resolve(response);
                } else if (failureConditions(response)) {
                    end();
                    reject(response);
                }
            } catch (err) {
                end();
                reject(err);
            }
        }, interval * 1000);
        const _timeout = setTimeout(() => {
            end();
            reject(new Error("Timed out. Check your internet connection."));
        }, timeout * 1000);
        let end = () => {
            clearInterval(_interval);
            clearTimeout(_timeout);
        }
    });
}

/**
 * Abstract base class for all per-provider device flow managers.
 */
class DeviceFlowManager {
    //The name of the provider.
    name;
    //The Firebase provider object for this provider.
    firebaseProvider;
    /**
     * Constructs an instance of the DeviceFlowManager interface.
     * @param {String} name - The human-readable name of the provider (i.e. "Google")
     * @param {firebase.default.auth.OAuthProvider} firebaseProvider - The Firebase provider object.
     */
    constructor(name, firebaseProvider) {
        if (this.constructor == DeviceFlowManager) {
            throw new Error("Abstract classes can't be instantiated.");
        }
        this.name = name;
        this.firebaseProvider = firebaseProvider;
    }

    /**
     * Polls the provider's OAuth token endpoint for the access token until the user completes the authorization step.
     * @param {Object} authorizationResponse The response data from the authorization step.
     * @param {String} clientid The OAuth Client ID for your app.
     * @param {undefined} clientsecret The OAuth Client Secret for your app.
     * @returns {Promise<Object>} The response data.
     */
    tokenRequest(authorizationResponse, clientid, clientsecret = undefined) {
        throw new Error("Not implemented.");
    }

    /**
     * Polls the provider's OAuth Device Flow authorization endpoint for the device code, URL, etc.
     * @param {String} clientid The OAuth Client ID for your app.
     * @param {String[]} scopes The scopes this token requires (provider-specific).
     * @returns {Promise<Object>} The response data.
     */
    authorizationRequest(clientid, scopes) {
        throw new Error("Not implemented.");
    }
}

class GoogleDeviceFlow extends DeviceFlowManager {
    openid;
    constructor() {
        super('Google', firebase.auth.GoogleAuthProvider);
    }
    /**
     * Polls the Google OAuth Device Flow authorization endpoint for the device code, URL, etc.
     * @param {String} clientid The "TVs and Limited Input devices" OAuth 2.0 Client ID generated via the [GCP Console](https://console.developers.google.com/apis/credentials).
     * @param {String[]} scopes The scopes this token requires, from (this list)[https://developers.google.com/identity/protocols/oauth2/limited-input-device#allowedscopes].
     * @returns {Promise<Object>} The response data.
     */
    authorizationRequest(clientid, scopes) {
        return axios.get("https://accounts.google.com/.well-known/openid-configuration", {
            headers: {
                'Accept': 'application/json'
            }
        }).then(response => {
            //OK
            if (response.status == 200) {
                this.openid = response.data;
            } else {
                throw new Error("Could not fetch latest Google OpenID configuration! (HTTP Code " + response.status + ")");
            }
        }).then(() => {
            return repeatedPOST(this.openid.device_authorization_endpoint, {
                'client_id': clientid,
                'scope': scopes.join(" ").toLowerCase()
            }, response => {
                return [200].includes(response.status) && response.data.error == undefined;
            }, response => {
                return [403].includes(response.status)
            }).then(auth => {
                auth.data.url = auth.data.verification_url;
                auth.data.code = auth.data.user_code;
                return auth.data;
            });
        });
    }
    /**
     * Polls the Google OAuth token endpoint for the access token until the user completes the authorization step.
     * @param {Object} authorizationResponse The response data from the authorization step.
     * @param {String} clientid The "TVs and Limited Input devices" OAuth 2.0 Client ID generated via the [GCP Console](https://console.developers.google.com/apis/credentials). 
     * @param {String} clientsecret The "TVs and Limited Input devices" OAuth 2.0 Client Secret generated via the [GCP Console](https://console.developers.google.com/apis/credentials).
     * @returns {Promise<Object>} The response data.
     */
    tokenRequest(authorizationResponse, clientid, clientsecret) {
        return repeatedPOST(this.openid.token_endpoint, {
            'client_id': clientid,
            'client_secret': clientsecret,
            'device_code': authorizationResponse.device_code,
            'grant_type': this.openid.grant_types_supported.filter(grant_type => {
                return grant_type.includes("device_code");
            })[0]
        }, response => {
            return [200].includes(response.status) && response.data.error == undefined;
        }, response => {
            return [400, 401, 403].includes(response.status) && ['invalid_client', 'access_denied', 'slow_down', 'invalid_grant', 'unsupported_grant_type'].includes(response.data.error);
        }, authorizationResponse.interval + 1, authorizationResponse.expires_in).then(token => {
            return token.data;
        });
    }

    /**
     * Builds and returns a Google-provider Firebase credential out of the token step's response.
     * @param {Object} tokenResponse - The response from the token step.
     * @returns {firebase.auth.OAuthCredential} The Firebase credential.
     */
    firebaseCredential(tokenResponse) {
        return this.firebaseProvider.credential(tokenResponse.id_token, tokenResponse.access_token);
    }
}

class GitHubDeviceFlow extends DeviceFlowManager {
    constructor() {
        super('GitHub', firebase.auth.GithubAuthProvider);
    }
    /**
     * Polls the Github OAuth Device Flow authorization endpoint for the device code, URL, etc.
     * @param {String} clientid The OAuth App Client ID generated via the [GitHub Developer settings panel](https://github.com/settings/developers).
     * @param {String[]} scopes The scopes this token requires, from (this list)[https://docs.github.com/en/free-pro-team@latest/developers/apps/scopes-for-oauth-apps].
     * @returns {Promise<Object | Error>} The response data.
     */
    authorizationRequest(clientid, scopes) {
        return repeatedPOST('https://github.com/login/device/code', {
            'client_id': clientid,
            'scope': scopes.join(" ").toLowerCase()
        }, response => {
            return [200].includes(response.status) && response.data.error == undefined;
        }, response => {
            console.log(response.data)
            return [403].includes(response.status)
        }).then(auth => {
            auth.data.url = auth.data.verification_uri;
            auth.data.code = auth.data.user_code;
            return auth.data;
        });
    }
    /**
     * Polls the Github OAuth token endpoint for the access token until the user completes the authorization step.
     * @param {Object} authorizationResponse The response data from the authorization step.
     * @param {String} clientid The OAuth App Client ID generated via the [GitHub Developer settings panel](https://github.com/settings/developers).
     * @param {undefined} clientsecret Unused.
     * @returns {Promise<Object>} The response data.
     */
    tokenRequest(authorizationResponse, clientid, clientsecret = undefined) {
        return repeatedPOST('https://github.com/login/oauth/access_token', {
            'client_id': clientid,
            'device_code': authorizationResponse.device_code,
            'grant_type': 'urn:ietf:params:oauth:grant-type:device_code'
        }, response => {
            return [200].includes(response.status) && response.data.error == undefined;
        }, response => {
            // console.log(response)
            return ['expired_token', 'unsupported_grant_type', 'incorrect_client_credentials', 'incorrect_device_code', 'access_denied'].includes(response.data.error);
        }, authorizationResponse.interval + 1, authorizationResponse.expires_in).then(token => {
            return token.data;
        });
    }
    /**
     * Builds and returns a GitHub-provider Firebase credential out of the token step's response.
     * @param {Object} tokenResponse - The response from the token step.
     * @returns {firebase.auth.OAuthCredential} The Firebase credential.
     */
    firebaseCredential(tokenResponse) {
        return this.firebaseProvider.credential(tokenResponse.access_token);
    }
}

//Namespace Fields and Functions
const Providers = {
    'Google': GoogleDeviceFlow,
    'GitHub': GitHubDeviceFlow
}

//UI
const defaultSpinner = {
    interval: 50,
    frames: [
        "▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁",
        "█▁▁▁▁▁▁▁▁▁▁▁▁▁▁",
        "██▁▁▁▁▁▁▁▁▁▁▁▁▁",
        "███▁▁▁▁▁▁▁▁▁▁▁▁",
        "████▁▁▁▁▁▁▁▁▁▁▁",
        "█████▁▁▁▁▁▁▁▁▁▁",
        "▁█████▁▁▁▁▁▁▁▁▁",
        "▁▁█████▁▁▁▁▁▁▁▁",
        "▁▁▁█████▁▁▁▁▁▁▁",
        "▁▁▁▁█████▁▁▁▁▁▁",
        "▁▁▁▁▁█████▁▁▁▁▁",
        "▁▁▁▁▁▁█████▁▁▁▁",
        "▁▁▁▁▁▁▁█████▁▁▁",
        "▁▁▁▁▁▁▁▁█████▁▁",
        "▁▁▁▁▁▁▁▁▁█████▁",
        "▁▁▁▁▁▁▁▁▁▁█████",
        "▁▁▁▁▁▁▁▁▁▁▁████",
        "▁▁▁▁▁▁▁▁▁▁▁▁███",
        "▁▁▁▁▁▁▁▁▁▁▁▁▁██",
        "▁▁▁▁▁▁▁▁▁▁▁▁▁▁█",
    ]
}

/**
 * Prebuilt turn-key Firebase Device Flow UI.
 */
class DeviceFlowUI {
    loadingSpinner;
    config;
    app;
    /**
     * Constructs a Firebase Device Flow UI instance with OAuth settings. See `Providers` for the individual provider requirements.
     * @param {firebase.default.app.App} app The initialized Firebase app.
     * @param {Object} config The set of config objects for each provider.
     * @param {Object} config.Google The Google config object. Leave `undefined` to disable this provider.
     * @param {String} config.Google.clientid The "TVs and Limited Input devices" OAuth 2.0 Client ID generated via the [GCP Console](https://console.developers.google.com/apis/credentials).
     * @param {String} config.Google.clientsecret The "TVs and Limited Input devices" OAuth 2.0 Client Secret generated via the [GCP Console](https://console.developers.google.com/apis/credentials).
     * @param {String[]} config.Google.scopes The scopes this token requires, from (this list)[https://developers.google.com/identity/protocols/oauth2/limited-input-device#allowedscopes].
     * @param {Object} config.GitHub The GitHub config object. Leave `undefined` to disable this provider.
     * @param {String} config.GitHub.clientid The OAuth App Client ID generated via the [GitHub Developer settings panel](https://github.com/settings/developers).
     * @param {String} config.GitHub.clientsecret Unused.
     * @param {String[]} config.GitHub.scopes The scopes this token requires, from (this list)[https://docs.github.com/en/free-pro-team/developers/apps/scopes-for-oauth-apps].
     * @param {ora.Spinner} loadingSpinner The `ora` spinner object (see the [`ora` spinner documentation](https://www.npmjs.com/package/ora#spinner) for details).
     */
    constructor(app, config, loadingSpinner = defaultSpinner) {
        this.app = app;
        this.loadingSpinner = loadingSpinner;
        this.config = Object.fromEntries(Object.entries(config).filter(provider => {
            return Object.keys(Providers).includes(provider[0]);
        }));
        if (Object.keys(this.config).length < 1) {
            throw new Error("Invalid config - no providers recognized! Names are case sensitive.");
        }
    }
    /**
     * Signs the user in to your app.
     * @returns {Promise<firebase.default.User>} The user.
     **/
    async signIn() {
        while (this.app.auth().currentUser === null) {
            //Select provider
            const provider = (await inquirer.prompt([{
                type: 'list',
                name: 'provider',
                message: 'Sign in via:',
                choices: Object.keys(this.config),
            }])).provider;
            await this.signInViaProvider(new Providers[provider]());
        }
        return this.app.auth().currentUser;
    }

    /**
     * Signs the user in to your app using the given provider.
     * @param {DeviceFlowManager} provider - The provider to use.
     * @returns {Promise<firebase.default.User>} The user.
     */
    async signInViaProvider(provider) {
        var loading;
        //Authenticate with Firebase
        try {
            //Get login code
            loading = ora({
                text: 'Fetching ' + chalk.bold(provider.name) + ' Device Code & URL...',
                spinner: this.loadingSpinner,
            }).start();

            var authResponse = await provider.authorizationRequest(this.config[provider.name].clientid, this.config[provider.name].scopes);
        } catch (err) {
            if (err.data.error) {
                loading.fail('Fetching ' + chalk.bold(provider.name) + ' Device Code & URL Failed! (Code ' + err.status + '-' + err.data.error + ')');
            } else {
                loading.fail('Fetching ' + chalk.bold(provider.name) + ' Device Code & URL Failed! (Code ' + err.status + ')');
            }
            await sleep(2000);
            return;
        }
        try {
            loading.succeed(chalk.bold(provider.name) + ' Device Code Fetched!');
            await sleep(1000);

            //Display URL and code
            console.log('Go to: ' + chalk.bold(authResponse.url));
            console.log('Enter the code: ' + chalk.bold(authResponse.code));
            await sleep(1000);

            //Get access token
            loading = ora({
                text: 'Awaiting ' + chalk.bold(provider.name) + ' Authorization...',
                spinner: this.loadingSpinner,
            }).start();

            var tokenResponse = await provider.tokenRequest(authResponse, this.config[provider.name].clientid, this.config[provider.name].clientsecret);

            loading.succeed(chalk.bold(provider.name) + ' Access Token Recieved!')
            // console.log(tokenResponse);
            await sleep(1000);
        } catch (err) {
            //General errors
            if (err.data.error) {
                loading.fail(chalk.bold(provider.name) + ' Authorization & Token Fetch Failed! (Code ' + err.status + '-' + err.data.error + ')');
            } else {
                loading.fail(chalk.bold(provider.name) + ' Authorization & Token Fetch Failed! (Code ' + err.status + ')');
            }
            await sleep(2000);
            return;
        }

        //Build credential and authenticate
        try {
            loading = ora({
                text: 'Authenticating...',
                spinner: this.loadingSpinner,
            }).start();

            const user = await this.app.auth().signInWithCredential(provider.firebaseCredential(tokenResponse));

            if (user.additionalUserInfo.profile.name == undefined) {
                loading.succeed('Authenticated Successfully!');
            } else {
                loading.succeed('Authenticated ' + chalk.bold(user.additionalUserInfo.profile.name) + ' Successfully!');
            }
            await sleep(2000);
            return user;
        } catch (err) {
            //Different credentials, same email?
            if (err.code == 'auth/account-exists-with-different-credential') {
                loading.stop();
                return await this.linkCredToExisting(err.email, provider.firebaseCredential(tokenResponse));
            } else {
                loading.fail(err.message);
                await sleep(2000);
                return;
            }
        }
    }

    /**
     * Links a new credential to an existing account.
     * @param {String} email The account's email, by which the default existing method is fetched.
     * @param {firebase.default.auth.AuthCredential} newCred The new credential.
     * @return {Promise<firebase.default.User>} The user, now associated with both credentials.
     */
    async linkCredToExisting(email, newCred) {
        const providerIDToName = {
            'google.com': "Google",
            'github.com': "GitHub"
        };

        var loading;

        //It's implied this works
        var defaultMethod = providerIDToName[(await this.app.auth().fetchSignInMethodsForEmail(email))[0]];
        var link = (await inquirer.prompt([{
            type: 'list',
            name: 'link',
            message: 'Existing Credentials Found!',
            choices: [{
                    name: chalk.bold('Link') + ' New and Existing (' + chalk.bold(defaultMethod) + ')',
                    value: 'Link'
                },
                {
                    name: chalk.bold('Scrap') + ' and ' + chalk.bold('Restart') + ' (Select ' + chalk.bold(defaultMethod) + ' at Sign-In)',
                    value: 'Restart'
                }
            ]
        }])).link;

        //Link em?
        if (link == 'Link') {
            console.log("Sign in to " + chalkPresets.cloudponics + " via " + chalk.bold(defaultMethod) + ':');
            await sleep(2000);
            const user = await this.signInViaProvider(new Providers[defaultMethod]());

            //Link success, return user
            loading = ora({
                text: 'Linking...',
                spinner: this.loadingSpinner,
            }).start();
            await user.user.linkWithCredential(newCred);
            loading.succeed("Linked " + chalk.bold(defaultMethod) + " Credential to Account!");
            await sleep(1000);
            return user;
        } else {
            console.log('Restarting.')
            await sleep(2000);
            return;
        }
    }
}

module.exports.DeviceFlowUI = DeviceFlowUI;
module.exports.Providers = Providers;
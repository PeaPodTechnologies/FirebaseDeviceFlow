import firebase from "firebase";
import auth from "firebase/auth"
import axios, {AxiosResponse, AxiosRequestConfig} from 'axios';
import ora from 'ora';
import chalk from 'chalk';
import inquirer from 'inquirer';
const sleep = (millis : number) => {
    return new Promise(resolve => {
        setTimeout(resolve, millis);
    });
};

/**
 * Failure, success, etc. conditions for an Axios responses.
 * @param {AxiosResponse} response Axios response object.
 * @returns {Boolean} Does the repsonse meet certain conditions?
 */
type ResponseConditions = {
    (response: AxiosResponse): boolean;
}

type AuthenticationResponse = {
    url: string,
    code: string,
    device_code: string,
    interval: number,
    expires_in: number,
    [index: string]: any
}

type TokenResponse = {
    access_token: string,
    id_token?: string,
    [index: string]: any
}

/**
 * POSTs an endpoint repeatedly until either success or failure conditions are met.
 * @param {string} url - The URL of the endpoint to POST.
 * @param {Object} body - The body of the POST request.
 * @param {ResponseConditions} successConditions Success conditions. True if successful response, then this will return `response.data`.
 * @param {ResponseConditions} failureConditions Failure conditions. True if failed response, then this will throw `response`.
 * @param {number} interval - The delay in seconds between attempts. Defaults to 1 second.
 * @param {number} timeout - The maximum time in seconds to spend trying to fetch. Defaults to 10 seconds.
 * @param {AxiosRequestConfig} options - Options for the Axios POST handler. Defaults to requesting JSON and disable status code validation.
 * @returns {Promise<AxiosResponse>} The response.
*/
function repeatedPOST(url : string, body : Object, successConditions : ResponseConditions, failureConditions : ResponseConditions, interval : number = 1, timeout : number = 10, options : AxiosRequestConfig = {
    headers: {
        'Accept': 'application/json'
    },
    validateStatus: undefined
}) : Promise<AxiosResponse> {
    return new Promise<AxiosResponse>((resolve, reject) => {
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
 * Abstract base interface for all per-provider device flow managers.
 */
interface DeviceFlowManager {
    name : string,
    firebaseProvider : any,
    authorizationRequest(clientid : string, scopes : string[]) : Promise<AuthenticationResponse>,
    tokenRequest(authorizationResponse : AuthenticationResponse, clientid : string, clientsecret : string) : Promise<TokenResponse>,
    firebaseCredential(tokenResponse : TokenResponse) : firebase.auth.OAuthCredential
}

class GoogleDeviceFlow implements DeviceFlowManager {
    private openid : any;
    readonly name : string = "Google";
    readonly firebaseProvider = firebase.auth.GoogleAuthProvider;
    constructor() {}
    /**
     * Polls the Google OAuth Device Flow authorization endpoint for the device code, URL, etc.
     * @param {string} clientid The "TVs and Limited Input devices" OAuth 2.0 Client ID generated via the [GCP Console](https://console.developers.google.com/apis/credentials).
     * @param {string[]} scopes The scopes this token requires, from (this list)[https://developers.google.com/identity/protocols/oauth2/limited-input-device#allowedscopes].
     * @returns {Promise<AuthenticationResponse>} The response data.
     */
    authorizationRequest(clientid : string, scopes : string[]) : Promise<AuthenticationResponse> {
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
                let result : AuthenticationResponse = auth.data;
                result.url = auth.data.verification_url;
                result.code = auth.data.user_code;
                return result;
            });
        });
    }
    /**
     * Polls the Google OAuth token endpoint for the access token until the user completes the authorization step.
     * @param {AuthenticationResponse} authorizationResponse The response data from the authorization step.
     * @param {String} clientid The "TVs and Limited Input devices" OAuth 2.0 Client ID generated via the [GCP Console](https://console.developers.google.com/apis/credentials). 
     * @param {String} clientsecret The "TVs and Limited Input devices" OAuth 2.0 Client Secret generated via the [GCP Console](https://console.developers.google.com/apis/credentials).
     * @returns {Promise<TokenResponse>} The response data.
     */
    tokenRequest(authorizationResponse : AuthenticationResponse, clientid : string, clientsecret : string) : Promise<TokenResponse>{
        return repeatedPOST(this.openid.token_endpoint, {
            'client_id': clientid,
            'client_secret': clientsecret,
            'device_code': authorizationResponse.device_code,
            'grant_type': (this.openid.grant_types_supported as Array<string>).filter(grant_type => {
                return grant_type.includes("device_code");
            })[0]
        }, response => {
            return [200].includes(response.status) && response.data.error == undefined;
        }, response => {
            return [400, 401, 403].includes(response.status) && ['invalid_client', 'access_denied', 'slow_down', 'invalid_grant', 'unsupported_grant_type'].includes(response.data.error);
        }, authorizationResponse.interval + 1, authorizationResponse.expires_in).then(token=>{
            return (token.data as TokenResponse);
        });
    }

    /**
     * Builds and returns a Google-provider Firebase credential out of the token step's response.
     * @param {TokenResponse} tokenResponse - The response from the token step.
     * @returns {firebase.auth.OAuthCredential} The Firebase credential.
     */
    firebaseCredential(tokenResponse : TokenResponse) : firebase.auth.OAuthCredential{
        return this.firebaseProvider.credential(tokenResponse.id_token, tokenResponse.access_token);
    }
}

class GitHubDeviceFlow implements DeviceFlowManager {
    private openid : any;
    readonly name : string = "GitHub";
    readonly firebaseProvider = firebase.auth.GithubAuthProvider;
    constructor() {}
    /**
     * Polls the Github OAuth Device Flow authorization endpoint for the device code, URL, etc.
     * @param {string} clientid The OAuth App Client ID generated via the [GitHub Developer settings panel](https://github.com/settings/developers).
     * @param {string[]} scopes The scopes this token requires, from (this list)[https://docs.github.com/en/free-pro-team@latest/developers/apps/scopes-for-oauth-apps].
     * @returns {Promise<AuthenticationResponse>} The response data.
     */
    authorizationRequest(clientid : string, scopes : string[]) : Promise<AuthenticationResponse> {
        return repeatedPOST('https://github.com/login/device/code', {
            'client_id': clientid,
            'scope': scopes.join(" ").toLowerCase()
        }, response => {
            return [200].includes(response.status) && response.data.error == undefined;
        }, response => {
            console.log(response.data)
            return [403].includes(response.status)
        }).then(auth => {
            let response : AuthenticationResponse = auth.data;
            response.url = auth.data.verification_uri;
            response.code = auth.data.user_code;
            return response;
        });
    }
    /**
     * Polls the Github OAuth token endpoint for the access token until the user completes the authorization step.
     * @param {AuthenticationResponse} authorizationResponse The response data from the authorization step.
     * @param {string} clientid The OAuth App Client ID generated via the [GitHub Developer settings panel](https://github.com/settings/developers).
     * @param {string} clientsecret Unused.
     * @returns {Promise<TokenResponse>} The response data.
     */
    tokenRequest(authorizationResponse : AuthenticationResponse, clientid : string, clientsecret : string) : Promise<TokenResponse>{
        return repeatedPOST('https://github.com/login/oauth/access_token', {
            'client_id': clientid,
            'device_code': authorizationResponse.device_code,
            'grant_type': 'urn:ietf:params:oauth:grant-type:device_code'
        }, response => {
            return [200].includes(response.status) && response.data.error == undefined;
        }, response => {
            // console.log(response)
            return ['expired_token', 'unsupported_grant_type', 'incorrect_client_credentials', 'incorrect_device_code', 'access_denied'].includes(response.data.error);
        }, authorizationResponse.interval + 1, authorizationResponse.expires_in).then(token=>{
            let result : TokenResponse = token.data;
            return result;
        });
    }
    /**
     * Builds and returns a GitHub-provider Firebase credential out of the token step's response.
     * @param {TokenResponse} tokenResponse - The response from the token step.
     * @returns {firebase.auth.OAuthCredential} The Firebase credential.
     */
    firebaseCredential(tokenResponse : TokenResponse) {
        return this.firebaseProvider.credential(tokenResponse.access_token);
    }
}

function stringTuple<T extends [string] | string[]>(...data: T): T {
    return data;
}

const ProviderNames = stringTuple('Google', 'GitHub');
type TProviderID = typeof ProviderNames[number];

type TProviderIDMap = {
    [key in TProviderID]: key
} 
function buildProviderIDMap(names : typeof ProviderNames) : TProviderIDMap {
    let o : {
        [key : string] : string
    } = {}; 
    for(const i of ProviderNames){
        o[i] = i;
    }
    return o as TProviderIDMap;
}
const ProviderIDMap : TProviderIDMap = buildProviderIDMap(ProviderNames);

type TProviderMap = {
    [key in TProviderID]: typeof GoogleDeviceFlow | typeof GitHubDeviceFlow
}

type TProviderURLMap = {
    [key in TProviderID]: string
}

// The DeviceFlowUI options object, indexed by that enum of strings
export type DeviceFlowUIOptions = {
    [key in TProviderID]?: {
        clientid: string,
        clientsecret?: string,
        scopes: string[]
    }
}

const ProviderMap : TProviderMap = {
    Google: GoogleDeviceFlow,
    GitHub: GitHubDeviceFlow
}

const ProviderURLMap : TProviderURLMap = {
    Google: "google.com",
    GitHub: "github.com"
}

//UI
const defaultSpinner : ora.Spinner = {
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
export class DeviceFlowUI {
    app : firebase.app.App;
    options : DeviceFlowUIOptions;
    loadingSpinner : ora.Spinner;
    /**
     * Constructs a Firebase Device Flow UI instance with your app's OAuth settings.
     * @param {firebase.default.app.App} app The initialized Firebase app.
     * @param {DeviceFlowUIOptions} options Your app's OAuth settings.
     * @param {ora.Spinner} loadingSpinner The `ora` spinner object (see the [`ora` spinner documentation](https://www.npmjs.com/package/ora#spinner) for details).
     */
    constructor(app : firebase.app.App, options : DeviceFlowUIOptions, loadingSpinner : ora.Spinner = defaultSpinner) {
        this.app = app;
        this.options = options;
        this.loadingSpinner = loadingSpinner;
    }
    /**
     * Signs the user in to your app.
     * @returns {Promise<firebase.User>} The user.
     **/
    public signIn = async () : Promise<firebase.User> => {
        while (this.app.auth().currentUser === null) {
            //Select provider
            const provider : TProviderID = (await inquirer.prompt([{
                type: 'list',
                name: 'provider',
                message: 'Sign in via:',
                choices: Object.values(ProviderIDMap).filter(provider => {return this.options[provider] != undefined}),
            }])).provider;
            await this.signInViaProvider(provider);
        }
        return (this.app.auth().currentUser as firebase.User);
    }

    /**
     * Signs the user in to your app using the given provider.
     * @param {TProviderID} providerid - The ID of the provider to use.
     * @returns {Promise<firebase.auth.UserCredential>} The user.
     */
    private signInViaProvider = async (providerid : TProviderID) : Promise<firebase.auth.UserCredential | undefined> => {
        var provider = new ProviderMap[providerid]();
        var loading : ora.Ora;
        loading = ora({
            text: 'Fetching ' + chalk.bold(provider.name) + ' Device Code & URL...',
            spinner: this.loadingSpinner,
        }).start();
        //Authenticate with Firebase
        try {
            //Get login code
            var authResponse = await provider.authorizationRequest(this.options[providerid]?.clientid as string, this.options[providerid]?.scopes as string[]);
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

            var tokenResponse = await provider.tokenRequest(authResponse, this.options[providerid]?.clientid as string, this.options[providerid]?.clientsecret as string);

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
            loading.succeed('Authenticated Successfully!');
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
     * @return {Promise<firebase.default.User | undefined>} The user, now associated with both credentials.
     */
    private linkCredToExisting = async (email : string, newCred : firebase.auth.AuthCredential) : Promise<firebase.auth.UserCredential | undefined> => {
        var loading;

        //It's implied this works
        const defaultURL = (await this.app.auth().fetchSignInMethodsForEmail(email))[0];
        let defaultMethod : TProviderID | undefined;
        for(const entry of Object.entries(ProviderURLMap)){
            if(entry[1] == defaultURL){
                defaultMethod = ProviderIDMap[entry[0] as TProviderID];
            }
        }
        if(!defaultMethod){
            throw new Error("Hmmmmm");
        }

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
            let user : firebase.auth.UserCredential | undefined;
            while(!user){
                console.log("Sign in via " + chalk.bold(defaultMethod) + ':');
                await sleep(2000);
                user = await this.signInViaProvider(defaultMethod);
            }
            if(user.user === null){
                throw new Error("Hmmmmmmm");
            }
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
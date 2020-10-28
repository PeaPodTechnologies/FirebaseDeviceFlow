//Firebase Dependencies
const firebase = require("firebase/app");
require("firebase/auth");

//CLI Dependencies
const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const sleep = millis=>{return new Promise(resolve=>{setTimeout(resolve(), millis);});}

//HTTP
const axios = require('axios').default;

//CLI Presets
var loading;
const palette = {
    "cloud":"2D4B8B",
    "ponics":"e47862",
    "ponics2":"c85e41",
    "peapod":"3db351",
    "peapod2":"197d2a"
};
const chalkPresets = {
    cloudponics : chalk.bold(chalk.hex(palette.cloud)('Cloud')+chalk.hex(palette.ponics)('Ponics')),
    peapod : chalk.bold(chalk.hex(palette.peapod)('PeaPod'))
}
const loadingSpinner = {
    interval : 50,
    frames : [
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
};

class DeviceFlowManager {
    name;
    FirebaseProvider;
    constructor(authorizationSettings, tokenSettings, deviceCodeRequestLabel, URLResponseLabel, IDTokenResponseLabel){
        this.authorizationSettings = authorizationSettings;
        this.tokenSettings = tokenSettings;
        this.tokenSettings.authorized = false;
        this.deviceCodeRequestLabel = deviceCodeRequestLabel;
        this.URLResponseLabel = URLResponseLabel;
        this.IDTokenResponseLabel = IDTokenResponseLabel;
    }
    /**
    * Polls to the authorization server to request the device code.
    * @param {Number} interval - The delay in seconds between attempts.
    * @param {Number} timeout - The maximum time in seconds to spend trying to fetch.
    * @returns {Promise<Object>} Response data.
    */
    async authorizationRequest(interval=1, timeout=10){
        return new Promise((resolve,reject)=>{
            const _interval = setInterval(async ()=>{
                try{
                    var response = await axios.post(this.authorizationSettings.url, this.authorizationSettings.body, {headers: {'Accept':'application/json'}});
                } catch(err) {
                    //TODO: Fatal errors?
                    return;
                }
                //TODO: Fatal responses?
                //Success criteria: 200 code and defined data
                if(response.status == 200){
                    response.data.verification_uri = response.data[this.URLResponseLabel]
                    this.tokenSettings.authorized = true;
                    this.tokenSettings.body[this.deviceCodeRequestLabel] = response.data.device_code;
                    this.tokenSettings.interval = response.data.interval;
                    this.tokenSettings.expires_in = response.data.expires_in;
                    clearInterval(_interval);
                    clearTimeout(_timeout);
                    resolve(response.data);
                }
            }, interval*1000);
            const _timeout = setTimeout(()=>{
                reject(new Error("Timed out. Check your internet connection."));
                clearInterval(_interval);
            }, timeout*1000);
        });
    }
    
    /**
    * Polls the token endpoint to request an access token.
    * @returns {Promise<Object>} Response data.
    */
    async tokenRequest(){
        if(this.tokenSettings.authorized == false){
            throw new Error('Must first fetch device code.');
        } else {
            return new Promise((resolve, reject) => {
                const _interval = setInterval(async ()=>{
                    try{
                        var response = await axios.post(this.tokenSettings.url, this.tokenSettings.body, {headers: {'Accept':'application/json'}});
                    } catch(err) {
                        //TODO: Fatal errors?
                        return;
                    }
                    //Success conditions: code 200
                    if(response.status == 200){
                        this.firebaseSettings = response.data;
                        resolve(response.data);
                        clearInterval(_interval);
                        clearTimeout(_timeout);
                    } else if (response.status == 400){
                        //Fatal if access denied or token expired.
                        if(response.data.error == 'access_denied'){
                            reject(new Error('Authorization denied.'))
                        } else if (response.data.error == 'expired_token'){
                            timedout();
                        }
                    }
                }, 1000*(this.tokenSettings.interval+1));
                const timedout = ()=>{
                    reject(new Error("Device code expired."));
                    clearInterval(_interval);
                    clearTimeout(_timeout);
                };
                const _timeout = setTimeout(timedout, 1000*this.tokenSettings.expires_in);
            });
        }
    }
    firebaseCredential(){}
}

class GoogleDeviceFlow extends DeviceFlowManager {
    name = 'Google'
    FirebaseProvider = firebase.auth.GoogleAuthProvider;
    constructor(){
        super({
            url:'https://oauth2.googleapis.com/device/code', 
            body:{
                'client_id':"513099710307-78rqvpchfe8qissqgaugp160nsa1d4t5.apps.googleusercontent.com", 
                'scope':'email profile'
            }
        },
        {
            url:'https://oauth2.googleapis.com/token',
            body:{
                'client_id' : "513099710307-78rqvpchfe8qissqgaugp160nsa1d4t5.apps.googleusercontent.com",
                'client_secret' : "YKCeZITc11tfDAypvT2q4Ld9",
                'grant_type' : 'http://oauth.net/grant_type/device/1.0'
            }
        },
        'code',
        'verification_url');
    }
    /**
    * Builds and returns a Google-specific Firebase credential out of the token request's response object.
    * @returns {firebase.auth.OAuthCredential} The credential.
    */
    firebaseCredential(){
        // console.log(this.firebaseSettings);
        return this.FirebaseProvider.credential(this.firebaseSettings.id_token, this.firebaseSettings.access_token);
    }
}

class GitHubDeviceFlow extends DeviceFlowManager {
    name = 'GitHub'
    FirebaseProvider = firebase.auth.GithubAuthProvider;
    constructor(){
        super({
            url:'https://github.com/login/device/code', 
            body:{
                'client_id':'f982a1faefcf73eb1268', 
                'scope':'read:user user:email'
            }
        },
        {
            url:'https://github.com/login/oauth/access_token',
            body: {
                'client_id' : 'f982a1faefcf73eb1268',
                'grant_type' : 'urn:ietf:params:oauth:grant-type:device_code'
            }
        },
        'device_code',
        'verification_uri');
    }
    /**
    * Builds and returns a GitHub-specific Firebase credential out of the token request's response object.
    * @returns {firebase.auth.OAuthCredential} The credential.
    */
    firebaseCredential(){
        // console.log(this.firebaseSettings);
        return this.FirebaseProvider.credential(this.firebaseSettings.access_token);
    }
}

//Namespace Fields and Functions
DeviceFlowManager.Providers = {
    'Google' : GoogleDeviceFlow,
    'GitHub' : GitHubDeviceFlow
}
/**
* Signs the user in to CloudPonics with their method of choice via the command line.
* @returns {firebase.auth.UserCredential} The user.
**/
DeviceFlowManager.signIn = async () => {
    while(firebase.auth().currentUser === null){
        console.clear();
        //Select provider
        const provider = (await inquirer.prompt([
            {
                type: 'list',
                name: 'provider',
                message: 'Sign in to '+chalkPresets.cloudponics+' via:',
                choices: Object.keys(DeviceFlowManager.Providers),
            }
        ])).provider;
        await DeviceFlowManager.signInViaProvider(new DeviceFlowManager.Providers[provider]());
    }
}

/**
* Signs the user in to CloudPonics via the command line.
* @param {DeviceFlowManager} provider
* @returns {firebase.auth.UserCredential} The user.
*/
DeviceFlowManager.signInViaProvider = async (provider) => {
    return new Promise(async resolve=>{
        //Authenticate with Firebase
        try{
            //Get login code
            loading = ora({
                text: 'Fetching '+chalk.bold(provider.name)+' Device Code...',
                spinner: loadingSpinner,
            }).start();
            const authResponse = await provider.authorizationRequest();
            loading.succeed(chalk.bold(provider.name)+' Device Code Fetched!');
            await sleep(1000);
            
            console.log('Go to: '+chalk.bold(authResponse.verification_uri));
            console.log('Enter the code: '+chalk.bold(authResponse.user_code));
            await sleep(1000);
            
            //Get access token
            loading = ora({
                text: 'Awaiting '+chalk.bold(provider.name)+' Authorization...',
                spinner: loadingSpinner,
            }).start();
            //[Access Token, Expires In]
            await provider.tokenRequest();
            loading.succeed(chalk.bold(provider.name)+' Access Token Recieved!')
            await sleep(1000);
        } catch(err) {
            //General errors
            loading.fail(err.message);
            await sleep(2000);
            resolve();
        }
        
        //Build credential and authenticate
        try{
            loading = ora({
                text: 'Authenticating with '+chalkPresets.cloudponics+'...',
                spinner: loadingSpinner,
            }).start();
            const user = await firebase.auth().signInWithCredential(provider.firebaseCredential());
            loading.succeed('Authenticated '+chalk.bold(user.additionalUserInfo.profile.name)+' Successfully with '+chalkPresets.cloudponics+'!');
            await sleep(2000);
            resolve(user);
        } catch (err) {
            //Different credentials, same email?
            if(err.code == 'auth/account-exists-with-different-credential'){
                loading.stop();
                resolve(await DeviceFlowManager.linkCredToExisting(err.email, provider.firebaseCredential()));
            } else {
                loading.fail(err.message);
                await sleep(2000);
                resolve();
            }
        }
    });
}

/**
* Links a new credential to an existing account.
* @param {String} email The account's email, by which the default existing method is fetched.
* @param {firebase.auth.AuthCredential} newCred The new credential.
* @return {Promise<firebase.auth.UserCredential>} The user, now associated with both credentials.
*/
DeviceFlowManager.linkCredToExisting = async (email, newCred)=>{
    return new Promise(async resolve => {
        const providerIDToName = {
            'google.com' : "Google",
            'github.com' : "GitHub"
        };
        
        //It's implied this works
        var defaultMethod = providerIDToName[(await firebase.auth().fetchSignInMethodsForEmail(email))[0]];
        var link = (await inquirer.prompt([
            {
                type: 'list',
                name: 'link',
                message: 'Existing '+chalkPresets.cloudponics+' Credentials Found!',
                choices: [
                    {
                        name : chalk.bold('Link')+' New and Existing ('+chalk.bold(defaultMethod)+')',
                        value : 'Link'
                    },
                    {
                        name : chalk.bold('Scrap')+' and '+chalk.bold('Restart')+' (Select '+chalk.bold(defaultMethod)+' at Sign-In)',
                        value : 'Restart'
                    }
                ]
            }
        ])).link;
        
        //Link em?
        if(link == 'Link'){
            console.clear();
            console.log("Sign in to "+chalkPresets.cloudponics+" via "+chalk.bold(defaultMethod)+':');
            await sleep(2000);
            const user = await DeviceFlowManager.signInViaProvider(new DeviceFlowManager.Providers[defaultMethod]());
            
            //Link success, return user
            loading = ora({
                text: 'Linking...',
                spinner: loadingSpinner,
            }).start();
            await user.user.linkWithCredential(newCred);
            loading.succeed("Linked "+chalk.bold(defaultMethod)+" Credential to Account!");
            await sleep(1000);
            resolve(user);
        } else {
            console.log('Restarting.')
            await sleep(2000);
            resolve();
        }
    });
}

module.exports = DeviceFlowManager;
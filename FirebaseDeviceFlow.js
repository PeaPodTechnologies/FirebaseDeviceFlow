//Firebase Dependencies
const firebase = require("firebase/app").default;
require("firebase/auth")

//HTTP
const axios = require('axios').default;

/**
* Parent class for all device flow managers per-provider.
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
    constructor(name, firebaseProvider){
        this.name = name;
        this.firebaseProvider = firebaseProvider;
    }
    /**
    * Polls the authorization server for the device code, URL, etc.
    * @param {String} url - The URL to POST.
    * @param {Object} body - The body of the POST request.
    * @param {Number} interval - The delay in seconds between attempts. Defaults to 1 second.
    * @param {Number} timeout - The maximum time in seconds to spend trying to fetch. Defaults to 10 seconds.
    * @param {Number[]} nonfailureCodes - The HTTP response codes that neither result in failure nor success.
    * @param {Object} options - Options for the Axios POST handler. Defaults to `{headers: {'Accept':'application/json'}}`
    * @returns {Promise<Object>} Response data.
    */
    async authorizationRequest(url, body, nonfailureCodes = [], interval=1, timeout=10, options={headers: {'Accept':'application/json'}}){
        return new Promise((resolve,reject)=>{
            const _interval = setInterval(async ()=>{
                try{
                    var response = await axios.post(url, body, options);
                } catch(err) {
                    end();
                    reject(err);
                }
                //TODO: Fatal non-error responses?
                //Success criteria: 200 code 'OK'
                if(response.status == 200){
                    end();
                    resolve(response.data);
                } else if (!nonfailureCodes.includes(response.status)){
                    end();
                    reject(response.data);
                }
            }, interval*1000);
            const _timeout = setTimeout(()=>{
                end();
                reject(new Error("Timed out. Check your internet connection."));
            }, timeout*1000);
            let end = ()=>{clearInterval(_interval);clearTimeout(_timeout);}
        });
    }
    
    /**
    * Polls the token endpoint for the access token until the user completes the authorization step.
    * @param {String} url - The URL to POST.
    * @param {Object} body - The body of the POST request.
    * @param {Number} interval - The delay in seconds between attempts. Defaults to 1 second.
    * @param {Number} timeout - The maximum time in seconds to spend trying to fetch. Defaults to 10 seconds.
    * @param {Number[]} nonfailureCodes - The HTTP response codes that neither result in failure nor success.
    * @param {Object} options - Options for the Axios POST handler. Defaults to `{headers: {'Accept':'application/json'}}`
    * @returns {Promise<Object>} Response data.
    */
    tokenRequest(url, body, nonfailureCodes = [], interval = 1, timeout = 10, options={headers: {'Accept':'application/json'}}){
        return new Promise((resolve, reject) => {
            const _interval = setInterval(async ()=>{
                try{
                    var response = await axios.post(url, body, options);
                } catch(err) {
                    end();
                    reject(err);
                }
                //Success conditions: code 200
                if(response.status == 200){
                    end();
                    resolve(response.data);
                } else if(!nonfailureCodes.includes(response.status)){
                    end();
                    reject(err);
                }
            }, 1000*interval);
            const _timeout = setTimeout(()=>{
                reject(new Error("Timed out. Check your internet connection."));
                end();
            }, 1000*timeout);
            let end = ()=>{clearInterval(_interval);clearTimeout(_timeout);}
        });
    }
    firebaseCredential(){}
}

class GoogleDeviceFlow extends DeviceFlowManager {
    openid;
    constructor(){
        super('Google', firebase.auth.GoogleAuthProvider);
        axios.get("https://accounts.google.com/.well-known/openid-configuration", {headers:{'Accept':'application/json'}}).then(response=>{
            //OK
            if(response.status == 200){
                this.openid = response.data;
            } else {
                throw new Error("Could not fetch latest Google OpenID configuration! (HTTP Code "+response.status+")");
            }
        });
    }
    /**
    * Polls the Google OAuth Device Flow authorization endpoint for the device code, URL, etc.
    * @param {String} clientid The "TVs and Limited Input devices" OAuth 2.0 Client ID generated via the [GCP Console](https://console.developers.google.com/apis/credentials).
    * @param {String[]} scopes The scopes this token requires, from (this list)[https://developers.google.com/identity/protocols/oauth2/limited-input-device#allowedscopes].
    * @returns {Promise<Object>} The response.
    */
    async authorizationRequest(clientid, scopes){
        let auth = await super.authorizationRequest(this.openid.device_authorization_endpoint, {
            'client_id':clientid, 
            'scope':scopes.join(" ").toLowerCase()
        });
        auth.url = auth.verification_url;
        auth.code = auth.user_code;
        return auth;
    }
    /**
    * Polls the Google OAuth token endpoint for the access token until the user completes the authorization step.
    * @param {Object} authorizationResponse The response from the authorization step.
    * @param {String} clientid The "TVs and Limited Input devices" OAuth 2.0 Client ID generated via the [GCP Console](https://console.developers.google.com/apis/credentials). 
    * @param {String} clientsecret The "TVs and Limited Input devices" OAuth 2.0 Client Secret generated via the [GCP Console](https://console.developers.google.com/apis/credentials).
    * @returns {Promise<Object>} The response.
    */
    tokenRequest(authorizationResponse, clientid, clientsecret){
        return super.tokenRequest(this.openid.token_endpoint, {
            'client_id' : clientid,
            'client_secret' : clientsecret,
            'device_code' : authorizationResponse.device_code,
            'grant_type' : this.openid.grant_types_supported.filter(grant_type=>{return grant_type.includes("device_code");})[0]
        }, [428], authorizationResponse.interval+1, authorizationResponse.expires_in);
    }
    /**
    * Builds and returns a Google-provider Firebase credential out of the token step's response.
    * @param {Object} tokenResponse - The response from the token step.
    * @returns {firebase.auth.OAuthCredential} The Firebase credential.
    */
    firebaseCredential(tokenResponse){
        return this.firebaseProvider.credential(tokenResponse.id_token, tokenResponse.access_token);
    }
}

class GitHubDeviceFlow extends DeviceFlowManager {
    constructor(){
        super('GitHub', firebase.auth.GithubAuthProvider);
    }
    /**
    * Polls the Github OAuth Device Flow authorization endpoint for the device code, URL, etc.
    * @param {String} clientid The OAuth App Client ID generated via the [GitHub Developer settings panel](https://github.com/settings/developers).
    * @param {String[]} scopes The scopes this token requires, from (this list)[https://docs.github.com/en/free-pro-team@latest/developers/apps/scopes-for-oauth-apps].
    * @returns {Promise<Object>} The response.
    */
    async authorizationRequest(clientid, scopes){
        let auth = await super.authorizationRequest('https://github.com/login/device/code', {
            'client_id':clientid, 
            'scope':scopes.join(" ").toLowerCase()
        });
        auth.url = auth.verification_uri;
        auth.code = auth.user_code;
        return auth;
    }
    /**
    * Polls the Github OAuth token endpoint for the access token until the user completes the authorization step.
    * @param {Object} authorizationResponse The response from the authorization step.
    * @param {String} clientid The OAuth App Client ID generated via the [GitHub Developer settings panel](https://github.com/settings/developers).
    * @param {undefined} clientsecret Unused.
    * @returns {Promise<Object>} The response.
    */
    tokenRequest(authorizationResponse, clientid, clientsecret=undefined){
        return super.tokenRequest('https://github.com/login/oauth/access_token', {
            'client_id' : clientid,
            'device_code' : authorizationResponse.device_code,
            'grant_type' : 'urn:ietf:params:oauth:grant-type:device_code'
        }, [428], authorizationResponse.interval+1, authorizationResponse.expires_in);
    }
    /**
    * Builds and returns a GitHub-provider Firebase credential out of the token step's response.
    * @param {Object} tokenResponse - The response from the token step.
    * @returns {firebase.auth.OAuthCredential} The Firebase credential.
    */
    firebaseCredential(tokenResponse){
        return this.firebaseProvider.credential(tokenResponse.access_token);
    }
}

//Namespace Fields and Functions
DeviceFlowManager.Providers = {
    'Google' : GoogleDeviceFlow,
    'GitHub' : GitHubDeviceFlow
}

module.exports = DeviceFlowManager.Providers;
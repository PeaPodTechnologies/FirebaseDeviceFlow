"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceFlowUI = void 0;
var firebase_1 = __importDefault(require("firebase"));
var axios_1 = __importDefault(require("axios"));
var ora_1 = __importDefault(require("ora"));
var chalk_1 = __importDefault(require("chalk"));
var inquirer_1 = __importDefault(require("inquirer"));
var sleep = function (millis) {
    return new Promise(function (resolve) {
        setTimeout(resolve, millis);
    });
};
function repeatedPOST(url, body, successConditions, failureConditions, interval, timeout, options) {
    var _this = this;
    if (interval === void 0) { interval = 1; }
    if (timeout === void 0) { timeout = 10; }
    if (options === void 0) { options = {
        headers: {
            'Accept': 'application/json'
        },
        validateStatus: undefined
    }; }
    return new Promise(function (resolve, reject) {
        var _interval = setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
            var response, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4, axios_1.default.post(url, body, options)];
                    case 1:
                        response = _a.sent();
                        if (successConditions(response)) {
                            end();
                            resolve(response);
                        }
                        else if (failureConditions(response)) {
                            end();
                            reject(new Error(String(response)));
                        }
                        return [3, 3];
                    case 2:
                        err_1 = _a.sent();
                        end();
                        reject(err_1);
                        return [3, 3];
                    case 3: return [2];
                }
            });
        }); }, interval * 1000);
        var _timeout = setTimeout(function () {
            end();
            reject(new Error("Timed out. Check your internet connection."));
        }, timeout * 1000);
        var end = function () {
            clearInterval(_interval);
            clearTimeout(_timeout);
        };
    });
}
var GoogleDeviceFlow = (function () {
    function GoogleDeviceFlow() {
        this.name = "Google";
        this.firebaseProvider = firebase_1.default.auth.GoogleAuthProvider;
    }
    GoogleDeviceFlow.prototype.authorizationRequest = function (clientid, scopes) {
        var _this = this;
        return axios_1.default.get("https://accounts.google.com/.well-known/openid-configuration", {
            headers: {
                'Accept': 'application/json'
            }
        }).then(function (response) {
            if (response.status == 200) {
                _this.openid = response.data;
            }
            else {
                throw new Error("Could not fetch latest Google OpenID configuration! (HTTP Code " + response.status + ")");
            }
        }).then(function () {
            return repeatedPOST(_this.openid.device_authorization_endpoint, {
                'client_id': clientid,
                'scope': scopes.join(" ").toLowerCase()
            }, function (response) {
                return [200].includes(response.status) && response.data.error === undefined;
            }, function (response) {
                return [403].includes(response.status);
            }).then(function (auth) {
                var result = auth.data;
                result.url = auth.data.verification_url;
                result.code = auth.data.user_code;
                return result;
            });
        });
    };
    GoogleDeviceFlow.prototype.tokenRequest = function (authorizationResponse, clientid, clientsecret) {
        return repeatedPOST(this.openid.token_endpoint, {
            'client_id': clientid,
            'client_secret': clientsecret,
            'device_code': authorizationResponse.device_code,
            'grant_type': this.openid.grant_types_supported.filter(function (grant_type) {
                return grant_type.includes("device_code");
            })[0]
        }, function (response) {
            return [200].includes(response.status) && response.data.error == undefined;
        }, function (response) {
            return [400, 401, 403].includes(response.status) && ['invalid_client', 'access_denied', 'slow_down', 'invalid_grant', 'unsupported_grant_type'].includes(response.data.error);
        }, authorizationResponse.interval + 1, authorizationResponse.expires_in).then(function (token) {
            return token.data;
        });
    };
    GoogleDeviceFlow.prototype.firebaseCredential = function (tokenResponse) {
        return this.firebaseProvider.credential(tokenResponse.id_token, tokenResponse.access_token);
    };
    return GoogleDeviceFlow;
}());
var GitHubDeviceFlow = (function () {
    function GitHubDeviceFlow() {
        this.name = "GitHub";
        this.firebaseProvider = firebase_1.default.auth.GithubAuthProvider;
    }
    GitHubDeviceFlow.prototype.authorizationRequest = function (clientid, scopes) {
        return repeatedPOST('https://github.com/login/device/code', {
            'client_id': clientid,
            'scope': scopes.join(" ").toLowerCase()
        }, function (response) {
            return [200].includes(response.status) && response.data.error == undefined;
        }, function (response) {
            return [403].includes(response.status);
        }).then(function (auth) {
            var response = auth.data;
            response.url = auth.data.verification_uri;
            response.code = auth.data.user_code;
            return response;
        });
    };
    GitHubDeviceFlow.prototype.tokenRequest = function (authorizationResponse, clientid, clientsecret) {
        return repeatedPOST('https://github.com/login/oauth/access_token', {
            'client_id': clientid,
            'device_code': authorizationResponse.device_code,
            'grant_type': 'urn:ietf:params:oauth:grant-type:device_code'
        }, function (response) {
            return [200].includes(response.status) && response.data.error == undefined;
        }, function (response) {
            return ['expired_token', 'unsupported_grant_type', 'incorrect_client_credentials', 'incorrect_device_code', 'access_denied'].includes(response.data.error);
        }, authorizationResponse.interval + 1, authorizationResponse.expires_in).then(function (token) {
            var result = token.data;
            return result;
        });
    };
    GitHubDeviceFlow.prototype.firebaseCredential = function (tokenResponse) {
        return this.firebaseProvider.credential(tokenResponse.access_token);
    };
    return GitHubDeviceFlow;
}());
function stringTuple() {
    var data = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        data[_i] = arguments[_i];
    }
    return data;
}
var ProviderNames = stringTuple('Google', 'GitHub');
var ProviderMap = {
    Google: GoogleDeviceFlow,
    GitHub: GitHubDeviceFlow
};
var ProviderURLMap = {
    Google: "google.com",
    GitHub: "github.com"
};
function buildProviderIDMap(names) {
    var o = {};
    for (var _i = 0, ProviderNames_1 = ProviderNames; _i < ProviderNames_1.length; _i++) {
        var i = ProviderNames_1[_i];
        o[i] = i;
    }
    return o;
}
var ProviderIDMap = buildProviderIDMap(ProviderNames);
var defaultSpinner = {
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
};
var DeviceFlowUI = (function () {
    function DeviceFlowUI(app, options, loadingSpinner) {
        var _this = this;
        if (loadingSpinner === void 0) { loadingSpinner = defaultSpinner; }
        this.signIn = function () { return __awaiter(_this, void 0, void 0, function () {
            var provider;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(this.app.auth().currentUser === null)) return [3, 3];
                        return [4, inquirer_1.default.prompt([{
                                    type: 'list',
                                    name: 'provider',
                                    message: 'Sign in via:',
                                    choices: Object.values(ProviderIDMap).filter(function (provider) { var _a, _b; return _this.options[provider] != undefined && ((_a = _this.options[provider]) === null || _a === void 0 ? void 0 : _a.clientid) != undefined && ((_b = _this.options[provider]) === null || _b === void 0 ? void 0 : _b.scopes) != undefined; }),
                                }])];
                    case 1:
                        provider = (_a.sent()).provider;
                        return [4, this.signInViaProvider(provider)];
                    case 2:
                        _a.sent();
                        return [3, 0];
                    case 3: return [2, this.app.auth().currentUser];
                }
            });
        }); };
        this.signInViaProvider = function (providerid) { return __awaiter(_this, void 0, void 0, function () {
            var provider, loading, authResponse, err_2, tokenResponse, err_3, user, err_4;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        provider = new ProviderMap[providerid]();
                        loading = ora_1.default({
                            text: 'Fetching ' + chalk_1.default.bold(provider.name) + ' Device Code & URL...',
                            spinner: this.loadingSpinner,
                        }).start();
                        _e.label = 1;
                    case 1:
                        _e.trys.push([1, 3, , 5]);
                        return [4, provider.authorizationRequest((_a = this.options[providerid]) === null || _a === void 0 ? void 0 : _a.clientid, (_b = this.options[providerid]) === null || _b === void 0 ? void 0 : _b.scopes)];
                    case 2:
                        authResponse = _e.sent();
                        return [3, 5];
                    case 3:
                        err_2 = _e.sent();
                        if (err_2.data && err_2.data.error) {
                            loading.fail('Fetching ' + chalk_1.default.bold(provider.name) + ' Device Code & URL Failed! (Code ' + err_2.status + '-' + err_2.data.error + ')');
                        }
                        else {
                            loading.fail('Fetching ' + chalk_1.default.bold(provider.name) + ' Device Code & URL Failed! (Code ' + err_2.status + ')');
                        }
                        return [4, sleep(2000)];
                    case 4:
                        _e.sent();
                        return [2];
                    case 5:
                        _e.trys.push([5, 10, , 12]);
                        loading.succeed(chalk_1.default.bold(provider.name) + ' Device Code Fetched!');
                        return [4, sleep(1000)];
                    case 6:
                        _e.sent();
                        console.log('Go to: ' + chalk_1.default.bold(authResponse.url));
                        console.log('Enter the code: ' + chalk_1.default.bold(authResponse.code));
                        return [4, sleep(1000)];
                    case 7:
                        _e.sent();
                        loading = ora_1.default({
                            text: 'Awaiting ' + chalk_1.default.bold(provider.name) + ' Authorization...',
                            spinner: this.loadingSpinner,
                        }).start();
                        return [4, provider.tokenRequest(authResponse, (_c = this.options[providerid]) === null || _c === void 0 ? void 0 : _c.clientid, (_d = this.options[providerid]) === null || _d === void 0 ? void 0 : _d.clientsecret)];
                    case 8:
                        tokenResponse = _e.sent();
                        loading.succeed(chalk_1.default.bold(provider.name) + ' Access Token Recieved!');
                        return [4, sleep(1000)];
                    case 9:
                        _e.sent();
                        return [3, 12];
                    case 10:
                        err_3 = _e.sent();
                        if (err_3.data && err_3.data.error) {
                            loading.fail(chalk_1.default.bold(provider.name) + ' Authorization & Token Fetch Failed! (Code ' + err_3.status + '-' + err_3.data.error + ')');
                        }
                        else {
                            loading.fail(chalk_1.default.bold(provider.name) + ' Authorization & Token Fetch Failed! (Code ' + err_3.status + ')');
                        }
                        return [4, sleep(2000)];
                    case 11:
                        _e.sent();
                        return [2];
                    case 12:
                        _e.trys.push([12, 15, , 20]);
                        loading = ora_1.default({
                            text: 'Authenticating...',
                            spinner: this.loadingSpinner,
                        }).start();
                        return [4, this.app.auth().signInWithCredential(provider.firebaseCredential(tokenResponse))];
                    case 13:
                        user = _e.sent();
                        loading.succeed('Authenticated Successfully!');
                        return [4, sleep(2000)];
                    case 14:
                        _e.sent();
                        return [2, user];
                    case 15:
                        err_4 = _e.sent();
                        if (!(err_4.code == 'auth/account-exists-with-different-credential')) return [3, 17];
                        loading.stop();
                        return [4, this.linkCredToExisting(err_4.email, provider.firebaseCredential(tokenResponse))];
                    case 16: return [2, _e.sent()];
                    case 17:
                        loading.fail(err_4.message);
                        return [4, sleep(2000)];
                    case 18:
                        _e.sent();
                        return [2];
                    case 19: return [3, 20];
                    case 20: return [2];
                }
            });
        }); };
        this.linkCredToExisting = function (email, newCred) { return __awaiter(_this, void 0, void 0, function () {
            var loading, defaultURL, defaultMethod, _i, _a, entry, link, user;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4, this.app.auth().fetchSignInMethodsForEmail(email)];
                    case 1:
                        defaultURL = (_b.sent())[0];
                        for (_i = 0, _a = Object.entries(ProviderURLMap); _i < _a.length; _i++) {
                            entry = _a[_i];
                            if (entry[1] == defaultURL) {
                                defaultMethod = ProviderIDMap[entry[0]];
                            }
                        }
                        if (!defaultMethod) {
                            throw new Error("Hmmmmm");
                        }
                        return [4, inquirer_1.default.prompt([{
                                    type: 'list',
                                    name: 'link',
                                    message: 'Existing Credentials Found!',
                                    choices: [{
                                            name: chalk_1.default.bold('Link') + ' New and Existing (' + chalk_1.default.bold(defaultMethod) + ')',
                                            value: 'Link'
                                        },
                                        {
                                            name: chalk_1.default.bold('Scrap') + ' and ' + chalk_1.default.bold('Restart') + ' (Select ' + chalk_1.default.bold(defaultMethod) + ' at Sign-In)',
                                            value: 'Restart'
                                        }
                                    ]
                                }])];
                    case 2:
                        link = (_b.sent()).link;
                        if (!(link == 'Link')) return [3, 9];
                        user = void 0;
                        _b.label = 3;
                    case 3:
                        if (!!user) return [3, 6];
                        console.log("Sign in via " + chalk_1.default.bold(defaultMethod) + ':');
                        return [4, sleep(2000)];
                    case 4:
                        _b.sent();
                        return [4, this.signInViaProvider(defaultMethod)];
                    case 5:
                        user = _b.sent();
                        return [3, 3];
                    case 6:
                        if (user.user === null) {
                            throw new Error("Hmmmmmmm");
                        }
                        loading = ora_1.default({
                            text: 'Linking...',
                            spinner: this.loadingSpinner,
                        }).start();
                        return [4, user.user.linkWithCredential(newCred)];
                    case 7:
                        _b.sent();
                        loading.succeed("Linked " + chalk_1.default.bold(defaultMethod) + " Credential to Account!");
                        return [4, sleep(1000)];
                    case 8:
                        _b.sent();
                        return [2, user];
                    case 9:
                        console.log('Restarting.');
                        return [4, sleep(2000)];
                    case 10:
                        _b.sent();
                        return [2];
                }
            });
        }); };
        this.authTests = function () { return __awaiter(_this, void 0, void 0, function () {
            var _i, _a, providerid, provider, authResponse, error_1, err;
            var _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _i = 0, _a = Object.values(ProviderIDMap);
                        _d.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3, 7];
                        providerid = _a[_i];
                        if (!Object.keys(this.options).includes(providerid)) {
                            return [3, 6];
                        }
                        console.log("Testing " + providerid + ":");
                        provider = new ProviderMap[providerid]();
                        _d.label = 2;
                    case 2:
                        _d.trys.push([2, 4, , 5]);
                        return [4, provider.authorizationRequest((_b = this.options[providerid]) === null || _b === void 0 ? void 0 : _b.clientid, (_c = this.options[providerid]) === null || _c === void 0 ? void 0 : _c.scopes)];
                    case 3:
                        authResponse = _d.sent();
                        return [3, 5];
                    case 4:
                        error_1 = _d.sent();
                        err = error_1;
                        throw new Error('Fetching ' + chalk_1.default.bold(provider.name) + ' Device Code & URL Failed! Message: ' + err.message);
                    case 5:
                        console.log("Device Code Fetched! " + authResponse.code + " @ " + authResponse.url);
                        _d.label = 6;
                    case 6:
                        _i++;
                        return [3, 1];
                    case 7:
                        console.log('All tests passed.');
                        return [2];
                }
            });
        }); };
        this.app = app;
        this.options = options;
        this.loadingSpinner = loadingSpinner;
    }
    return DeviceFlowUI;
}());
exports.DeviceFlowUI = DeviceFlowUI;

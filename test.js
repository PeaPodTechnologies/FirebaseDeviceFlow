"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var _a, _b;
exports.__esModule = true;
var app_1 = require("firebase/app");
var FirebaseDeviceFlow_1 = require("./dist/FirebaseDeviceFlow");
var fs = __importStar(require("fs"));
if (fs.existsSync('.env')) {
    var config = require('dotenv').config();
    if (config.error) {
        throw config.error;
    }
    else {
        console.log('Environment variable file found!');
    }
}
else {
    console.log('Environment variable file not found. Assuming variables are set.');
}
var app = app_1.initializeApp({
    apiKey: process.env.FIREBASE_APIKEY,
    authDomain: process.env.FIREBASE_AUTHDOMAIN,
    databaseURL: process.env.FIREBASE_DATABASEURL,
    projectId: process.env.FIREBASE_PROJECTID,
    storageBucket: process.env.FIREBASE_STORAGEBUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGINGSENDERID,
    appId: process.env.FIREBASE_APPID,
    measurementId: process.env.FIREBASE_MEASUREMENTID
});
var ui = new FirebaseDeviceFlow_1.DeviceFlowUI(app, {
    Google: {
        scopes: (_a = process.env.GOOGLE_SCOPES) === null || _a === void 0 ? void 0 : _a.split(' '),
        clientid: process.env.GOOGLE_CLIENTID,
        clientsecret: process.env.GOOGLE_CLIENTSECRET
    },
    GitHub: {
        scopes: (_b = process.env.GITHUB_SCOPES) === null || _b === void 0 ? void 0 : _b.split(' '),
        clientid: process.env.GITHUB_CLIENTID,
        clientsecret: process.env.GITHUB_CLIENTSECRET
    }
});
ui.authTests().then(function () {
    ui.signIn().then(function (user) {
        if (user.displayName) {
            console.log("Welcome, " + user.displayName + "!");
        }
        else {
            console.log("Welcome!");
        }
    }, function (err) {
        console.log(err);
    });
})["catch"](function (reason) {
    console.log(reason);
});

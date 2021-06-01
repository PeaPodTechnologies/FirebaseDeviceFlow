"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
var app_1 = __importDefault(require("firebase/app"));
var FirebaseDeviceFlow_1 = require("./dist/FirebaseDeviceFlow");
var config = require('dotenv').config();
if (config.error) {
    throw config.error;
}
var app = app_1.default.initializeApp({
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

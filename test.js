"use strict";
var _a, _b;
exports.__esModule = true;
//SAMPLE TEST CODE
var app_1 = require("firebase/app");
var FirebaseDeviceFlow_1 = require("./dist/FirebaseDeviceFlow");
var fs = require("fs");
// ------ OPTION 1: Create config objects directly ------
// const app = firebase.initializeApp({
//     // Firebase App Config Object
// });
// const ui = new DeviceFlowUI(app, {
//     //FDF Config Object
//     /**
//      * Example FDF Config Object:
//      * 
//      * - Provider is a key, one of Google, GitHub, etc.
//      * - Scopes are a list of scope strings (defined by the provider's API)
//      * - Client ID and client secret are provided by the providers
//      * 
//      * {
//      *   Provider1 : {
//      *     scopes : ['scope'],
//      *     clientid : 'clientid',
//      *     clientsecret : 'clientsecret'
//      *   },
//      *   Provider2 : ...
//      * }
//      */
// });
// ------ OPTION 2: Set up your app to use a .env file for the two configuration objects ------
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
var app = app_1["default"].initializeApp({
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
// FOR PRODUCTION: Sign in functionality
// ui.signIn().then(user=>{
//     if(user.displayName){
//         console.log("Welcome, "+user.displayName+"!");
//     } else {
//         console.log("Welcome!");
//     }
//     // Do what you want here!
// }, err=>{
//     console.log(err);
// });
// FOR EVALUATION: Unit tests
ui.authTests();

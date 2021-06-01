//SAMPLE TEST CODE
import firebase from "firebase/app";
import { DeviceFlowUI } from "./dist/FirebaseDeviceFlow";

// OPTION 1: Create config objects directly

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

// OPTION 2: Set up your app to use a .env file for the two configuration objects.

const config = require('dotenv').config();
if (config.error) {
    throw config.error
}

const app = firebase.initializeApp({
    apiKey: process.env.FIREBASE_APIKEY,
    authDomain: process.env.FIREBASE_AUTHDOMAIN,
    databaseURL: process.env.FIREBASE_DATABASEURL,
    projectId: process.env.FIREBASE_PROJECTID,
    storageBucket: process.env.FIREBASE_STORAGEBUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGINGSENDERID,
    appId: process.env.FIREBASE_APPID,
    measurementId: process.env.FIREBASE_MEASUREMENTID
});

const ui = new DeviceFlowUI(app, {
    Google : {
        scopes : process.env.GOOGLE_SCOPES?.split(' '),
        clientid : process.env.GOOGLE_CLIENTID,
        clientsecret : process.env.GOOGLE_CLIENTSECRET
    },
    GitHub : {
        scopes : process.env.GITHUB_SCOPES?.split(' '),
        clientid : process.env.GITHUB_CLIENTID,
        clientsecret : process.env.GITHUB_CLIENTSECRET
    }
});

ui.signIn().then(user=>{
    if(user.displayName){
        console.log("Welcome, "+user.displayName+"!");
    } else {
        console.log("Welcome!");
    }
    // Do what you want here!
}, err=>{
    console.log(err);
});
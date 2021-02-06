//SAMPLE TEST CODE
import firebase from "firebase/app";
import {DeviceFlowUI} from "./src/index";

const app = firebase.initializeApp({
    apiKey: "AIzaSyC7iBFv4PEmWss4h_Ul01Mpkzgpu2GuXao",
    authDomain: "peapod-283416.firebaseapp.com",
    databaseURL: "https://peapod-283416.firebaseio.com",
    projectId: "peapod-283416",
    storageBucket: "peapod-283416.appspot.com",
    messagingSenderId: "513099710307",
    appId: "1:513099710307:web:9280ad994c219256f79d56",
    measurementId: "G-39TFQEV2HD"
});

const ui = new DeviceFlowUI(app, {
    Google : {
        clientid : '513099710307-78rqvpchfe8qissqgaugp160nsa1d4t5.apps.googleusercontent.com',
        clientsecret : 'YKCeZITc11tfDAypvT2q4Ld9',
        scopes : ['email', 'profile']
    },
    GitHub : {
        clientid : 'f982a1faefcf73eb1268',
        scopes : ['read:user', 'user:email']
    }
});

/**
 * Example FDF Config Object:
 * 
 * - Provider is a key, one of Google, GitHub, etc.
 * - Scopes are a list of scope strings (defined by the provider's API)
 * - Client ID and client secret are provided by the providers
 * 
 * {
 *   Provider1 : {
 *     scopes : ['scope'],
 *     clientid : 'clientid',
 *     clientsecret : 'clientsecret'
 *   },
 *   Provider2 : ...
 * }
 */

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
//SAMPLE TEST CODE
import firebase from "firebase/app";
import { DeviceFlowUI } from "./index";

const app = firebase.initializeApp({
    // Firebase App Config Object
});

const ui = new DeviceFlowUI(app, {
    //FDF Config Object
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
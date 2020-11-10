//SAMPLE TEST CODE
const firebase = require('firebase/app');
const fdf = require('./FirebaseDeviceFlow');

const app = firebase.initializeApp({
    // Firebase App Config Object
});

const ui = new fdf.DeviceFlowUI(app, {
    Google : {
        scopes : ['scope'],
        clientid : 'clientid',
        clientsecret : 'clientsecret'
    },
    GitHub : {
        clientid : 'clientid',
        scopes : ['scope']
    }
});

ui.signIn().then(user=>{
    //Do what you want
}, err=>{
    console.log(err);
});
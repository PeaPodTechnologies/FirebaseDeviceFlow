import firebase from "firebase/app";
import "firebase/auth";
import ora from 'ora';
declare const ProviderNames: ["Google", "GitHub"];
declare type TProviderID = typeof ProviderNames[number];
export declare type DeviceFlowUIOptions = {
    [key in TProviderID]?: {
        clientid?: string;
        clientsecret?: string;
        scopes?: string[];
    };
};
export declare class DeviceFlowUI {
    app: firebase.app.App;
    options: DeviceFlowUIOptions;
    loadingSpinner: ora.Spinner;
    constructor(app: firebase.app.App, options: DeviceFlowUIOptions, loadingSpinner?: ora.Spinner);
    signIn: () => Promise<firebase.User>;
    private signInViaProvider;
    private linkCredToExisting;
    authTests: () => Promise<void>;
}
export {};

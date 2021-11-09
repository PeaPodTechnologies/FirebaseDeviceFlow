import { FirebaseApp } from "firebase/app";
import { User } from "firebase/auth";
import { Spinner } from 'ora';
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
    app: FirebaseApp;
    options: DeviceFlowUIOptions;
    loadingSpinner: Spinner;
    constructor(app: FirebaseApp, options: DeviceFlowUIOptions, loadingSpinner?: Spinner);
    signIn: () => Promise<User>;
    private signInViaProvider;
    private linkCredToExisting;
    authTests: () => Promise<void>;
}
export {};

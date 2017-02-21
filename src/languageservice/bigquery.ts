'use strict';

import { ExtensionContext, window, OutputChannel } from 'vscode';
import {
    LanguageClient, LanguageClientOptions, ServerOptions,
    TransportKind, RequestType, NotificationType, NotificationHandler
} from 'vscode-languageclient';

import {Logger} from '../models/logger';
import Constants = require('../constants/constants');
import { ServerInitializationResult } from './serverStatus';
import StatusView from '../views/statusView';
import * as LanguageServiceContracts from '../models/contracts/languageService';
import * as path from 'path';
import { ISqlToolsServiceClient } from './serviceclient';


let _channel: OutputChannel = undefined;

export default class BigQueryServiceClient implements ISqlToolsServiceClient {
    private static _instance: BigQueryServiceClient = undefined;
    private _client: LanguageClient;
    public static get instance(): BigQueryServiceClient {
        if (this._instance === undefined) {
            _channel = window.createOutputChannel(Constants.serviceInitializingOutputChannelName);
            let logger = new Logger(text => _channel.append(text));
            let statusView = new StatusView();
            this._instance = new BigQueryServiceClient(logger, statusView);
        }
        return this._instance;
    }

    constructor(
        private _logger: Logger,
        private _statusView: StatusView) {
    }

    public initialize(context: ExtensionContext): Promise<ServerInitializationResult> {
        this._logger.appendLine(Constants.serviceInitializing);
        return new Promise<ServerInitializationResult>((resolve, reject) => {
            this.initializeLanguageClient(context);
            resolve(new ServerInitializationResult(false, true, 'dummy'));
        });
    }

    private initializeLanguageClient(context: ExtensionContext): void {
        this._client = this.createLanguageClient(context);
        const disposable = this._client.start();
        context.subscriptions.push(disposable);
    }

    private createLanguageClient(context: ExtensionContext): LanguageClient {
        const serverModule = context.asAbsolutePath(path.join('node_modules', 'languageserver-bigquery', 'out', 'index.js'));

        const debugOptions = { execArgv: ['--nolazy', '--debug=6399'] };

        // server options define how language server is started
        // this particular form forks vscode and uses
        // its bundled NodeJS runtime to execute specified node modules
        const serverOptions: ServerOptions = {
            run : { module: serverModule, transport: TransportKind.ipc },
            debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
        };

        const clientOptions: LanguageClientOptions = {
            documentSelector: ['sql'],
            synchronize: {
                configurationSection: ['mssql', 'bigquery']
            }
        };

        const client = new LanguageClient('BigQuery language client', serverOptions, clientOptions);

        client.onNotification(LanguageServiceContracts.StatusChangedNotification.type, this.handleLanguageServiceStatusNotification());
        return client;
    }

    private handleLanguageServiceStatusNotification(): NotificationHandler<LanguageServiceContracts.StatusChangeParams> {
        return (event: LanguageServiceContracts.StatusChangeParams): void => {
            this._statusView.languageServiceStatusChanged(event.ownerUri, event.status);
        };
    }

    public sendRequest<P, R, E>(type: RequestType<P, R, E>, params?: P): Thenable<R> {
        if (this._client !== undefined) {
            const ret = this._client.sendRequest(type, params);
            return ret;
        }
    }

    public onNotification<P>(type: NotificationType<P>, handler: NotificationHandler<P>): void {
        if (this._client !== undefined) {
             return this._client.onNotification(type, handler);
        }
    }

    /**
     * Send a notification to the service client
     * @param params The params to pass with the notification
     */
    public sendNotification<P>(type: NotificationType<P>, params?: P): void {
        if (this._client !== undefined) {
            this._client.sendNotification(type, params);
        }
    }
}

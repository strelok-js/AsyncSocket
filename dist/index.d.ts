import { EventEmitter } from 'events';
export type AsyncSocketPackageRestData = {
    waitId?: string;
    timeout?: number;
    [key: string]: any;
};
export type StoredSentData<d = any> = {
    waitId: string;
    timeout?: number | ReturnType<typeof setTimeout>;
    resolve: (value: IncomingDataPackage<d>) => void;
    reject: (reason?: any) => void;
};
export interface IncomingDataPackage<d = any> {
    as: AsyncSocket;
    waitId?: string;
    eventName?: string;
    isEvent: boolean;
    sendNoReply(data: AsyncSocketPackageRestData): void;
    send<d = any>(data: AsyncSocketPackageRestData): Promise<IncomingDataPackage<d>>;
    accept(as: AsyncSocket): this;
    data: d;
}
export interface Engine extends InstanceType<typeof EventEmitter> {
    send(data: AsyncSocketPackageRestData): void;
    on<D = any>(event: string | symbol, listener: (data: IncomingDataPackage<D>) => void): this;
    emit<D = any>(event: string | symbol, data: D): boolean;
}
interface ServerEngineEvents<A extends AsyncSocket = AsyncSocket> {
    connection: (data: A) => void;
}
export interface ServerEngine<A extends AsyncSocket = AsyncSocket> extends InstanceType<typeof EventEmitter> {
    on<K extends keyof ServerEngineEvents<A>>(event: K, listener: ServerEngineEvents<A>[K]): this;
}
export declare class AsyncSocket<E extends Engine = Engine> extends EventEmitter {
    readonly engine: E;
    private readonly options;
    private readonly _awaitMessages;
    constructor(engine: E, options?: {});
    on<D = any>(event: string | symbol, listener: (data: IncomingDataPackage<D>) => void): this;
    emit<D = any>(event: string | symbol, data: D): boolean;
    private setupMessageHandler;
    private processIncomingMessage;
    private isEventMessage;
    private isResponseMessage;
    private handleResponseMessage;
    private clearTimeout;
    private createTimeoutHandler;
    private storePendingMessage;
    sendEmit(eventName: string, payload: any): void;
    sendNoReply(data: AsyncSocketPackageRestData): void;
    send<d = any>(data: AsyncSocketPackageRestData): Promise<IncomingDataPackage<d>>;
}
export declare class AsyncSocketServer<E extends ServerEngine<A> = ServerEngine, A extends AsyncSocket = AsyncSocket> extends EventEmitter {
    readonly engine: E;
    constructor(engine: E);
    private setupConnectionHandler;
    on<K extends keyof ServerEngineEvents<A>>(event: K, listener: ServerEngineEvents<A>[K]): this;
    emit<K extends keyof ServerEngineEvents<A>>(event: K, ...args: Parameters<ServerEngineEvents<A>[K]>): boolean;
}
declare const _default: {
    AsyncSocket: typeof AsyncSocket;
    AsyncSocketServer: typeof AsyncSocketServer;
};
export default _default;

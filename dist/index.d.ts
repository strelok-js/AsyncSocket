import { EventEmitter } from 'events';
export type JSONPrimitive = string | number | boolean | null;
export type JSONValue = JSONPrimitive | {
    [key: string]: JSONValue;
} | JSONValue[];
export type AsyncSocketPackageRestData = {
    waitId?: string;
    timeout?: number;
};
export type AsyncSocketPackageEventData = {
    eventName?: string;
    isEvent: boolean;
};
export type AsyncSocketPackageData = AsyncSocketPackageRestData & AsyncSocketPackageEventData & {
    data: JSONValue;
};
export type StoredSentData = {
    waitId: string;
    timeout?: number | ReturnType<typeof setTimeout>;
    resolve: (value: IncomingDataPackage | PromiseLike<IncomingDataPackage>) => void;
    reject: (reason?: any) => void;
};
export interface IncomingDataPackage {
    as: AsyncSocket;
    waitId?: string;
    eventName?: string;
    isEvent: boolean;
    sendNoReply(data: AsyncSocketPackageData): void;
    send(data: AsyncSocketPackageData): ReturnType<Engine['send']>;
    accept(as: AsyncSocket): IncomingDataPackage;
    data: JSONValue;
}
export interface EngineEvents {
    message: (data: IncomingDataPackage) => void;
}
export interface Engine extends InstanceType<typeof EventEmitter> {
    send(data: AsyncSocketPackageData): void;
    on<K extends keyof EngineEvents>(event: K, listener: EngineEvents[K]): this;
}
export declare class AsyncSocket extends EventEmitter {
    engine: Engine;
    options: any;
    _awaitMessages: {
        [key: string]: StoredSentData;
    };
    constructor(engine: Engine, options?: {});
    _incomingType(packageData: IncomingDataPackage): 1 | 0 | 2;
    sendEmit(eventName: string, payload: JSONValue): void;
    sendNoReply(data: AsyncSocketPackageData): void;
    send(data: AsyncSocketPackageRestData & {
        [key: string]: JSONValue;
    }): Promise<IncomingDataPackage>;
}
interface ServerEngineEvents {
    connection: (data: AsyncSocket) => void;
}
export interface ServerEngine extends InstanceType<typeof EventEmitter> {
    on<K extends keyof ServerEngineEvents>(event: K, listener: ServerEngineEvents[K]): this;
}
export declare class AsyncSocketServer extends EventEmitter {
    engine: ServerEngine;
    constructor(engine: ServerEngine);
}
declare const _default: {
    AsyncSocket: typeof AsyncSocket;
    AsyncSocketServer: typeof AsyncSocketServer;
};
export default _default;

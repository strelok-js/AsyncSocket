import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

type JSONPrimitive = string | number | boolean | null;
type JSONValue = JSONPrimitive | { [key: string]: JSONValue } | JSONValue[];

type AsyncSocketPackageRestData = {
    waitId?: string;
    timeout?: number;
};

type AsyncSocketPackageEventData = {
    eventName?: string;
    isEvent: boolean;
};

type AsyncSocketPackageData = AsyncSocketPackageRestData &
    AsyncSocketPackageEventData & {
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

export class AsyncSocket extends EventEmitter {
    engine: Engine;
    options: any;
    _awaitMessages: {
        [key: string]: StoredSentData;
    };
    constructor(engine: Engine, options = {}) {
        super();
        this.engine = engine;
        this.options = options;

        this._awaitMessages = {};

        this.engine.on('message', (message) => {
            if (this._incomingType(message) === 2) return this.emit('message', message.accept(this));
        });
    }
    _incomingType(packageData: IncomingDataPackage) {
        if (packageData.isEvent && packageData.eventName) {
            this.emit(packageData.eventName, packageData.data);
            return 1;
        }
        if (packageData.waitId && this._awaitMessages[packageData.waitId]) {
            this._awaitMessages[packageData.waitId].resolve(packageData.accept(this));
            clearTimeout(this._awaitMessages[packageData.waitId].timeout);
            delete this._awaitMessages[packageData.waitId];
            return 0;
        }
        return 2;
    }
    sendEmit(eventName: string, payload: JSONValue) {
        return this.sendNoReply({
            isEvent: true,
            eventName,
            data: payload,
        });
    }
    sendNoReply(data: AsyncSocketPackageData) {
        this.engine.send(data);
    }
    send(data: AsyncSocketPackageRestData & { [key: string]: JSONValue }): Promise<IncomingDataPackage> {
        const { waitId = uuidv4(), timeout = 60000, ...payload } = data;

        return new Promise((resolve, reject) => {
            this._awaitMessages[waitId] = {
                waitId,
                resolve,
                reject,
                timeout: timeout ? setTimeout(() => reject(new Error('The waiting time has been exceeded')), timeout) : undefined,
            };

            this.sendNoReply({
                waitId,
                isEvent: false,
                data: payload,
            });
        });
    }
}

interface ServerEngineEvents {
    connection: (data: AsyncSocket) => void;
}

export interface ServerEngine extends InstanceType<typeof EventEmitter> {
    on<K extends keyof ServerEngineEvents>(event: K, listener: ServerEngineEvents[K]): this;
}

export class AsyncSocketServer extends EventEmitter {
    engine: ServerEngine;
    constructor(engine: ServerEngine) {
        super();
        this.engine = engine;

        this.engine.on('connection', (asyncSocket) => {
            this.emit('connection', asyncSocket);
        });
    }
}

// Default export для браузера
export default {
    AsyncSocket,
    AsyncSocketServer,
};

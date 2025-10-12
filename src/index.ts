import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

export type JSONPrimitive = string | number | boolean | null;
export type JSONValue = JSONPrimitive | { [key: string]: JSONValue } | JSONValue[];

export type AsyncSocketPackageRestData = {
    waitId?: string;
    timeout?: number;
};

export type AsyncSocketPackageEventData = {
    eventName?: string;
    isEvent: boolean;
};

export type AsyncSocketPackageData = AsyncSocketPackageRestData &
    AsyncSocketPackageEventData & {
        data: JSONValue;
    };

export type StoredSentData<d extends JSONValue = JSONValue> = {
    waitId: string;
    timeout?: number | ReturnType<typeof setTimeout>;
    resolve: (value: IncomingDataPackage<d>) => void;
    reject: (reason?: any) => void;
};

export interface IncomingDataPackage<d extends JSONValue = JSONValue> {
    as: AsyncSocket;
    waitId?: string;
    eventName?: string;
    isEvent: boolean;

    sendNoReply(data: AsyncSocketPackageData): void;
    send<d extends JSONValue = JSONValue>(data: AsyncSocketPackageData): Promise<IncomingDataPackage<d>>;
    accept(as: AsyncSocket): this;

    data: d;
}

export interface EngineEvents<message extends IncomingDataPackage = IncomingDataPackage> {
    message: (data: message) => void;
}

export interface AsyncSocketEvents<message extends IncomingDataPackage = IncomingDataPackage> {
    [key: string | symbol]: (data: message) => void;
}

export interface Engine extends InstanceType<typeof EventEmitter> {
    send(data: { [key: string]: JSONValue }): void;
    on<K extends keyof EngineEvents>(event: K, listener: EngineEvents[K]): this;
}

export class AsyncSocket<E extends Engine = Engine> extends EventEmitter {
    engine: E;
    options: any;
    _awaitMessages: {
        [key: string]: StoredSentData<any>;
    };
    constructor(engine: E, options = {}) {
        super();
        this.engine = engine;
        this.options = options;

        this._awaitMessages = {};

        this.engine.on('message', (message) => {
            if (this._incomingType(message) === 2) return this.emit('message', message.accept(this));
        });
    }

    on<K extends keyof AsyncSocketEvents<IncomingDataPackage>>(event: K, listener: AsyncSocketEvents<IncomingDataPackage>[K]): this {
        return super.on(event as string | symbol, listener);
    }

    emit<K extends keyof AsyncSocketEvents<IncomingDataPackage>>(event: K, ...args: Parameters<AsyncSocketEvents<IncomingDataPackage>[K]>): boolean {
        return super.emit(event as string | symbol, ...args);
    }

    _incomingType(packageData: IncomingDataPackage) {
        if (packageData.isEvent && packageData.eventName) {
            this.emit(packageData.eventName, packageData.accept(this));
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
    sendNoReply(data: { [key: string]: JSONValue }) {
        this.engine.send(data);
    }
    send<d extends JSONValue = JSONValue>(data: AsyncSocketPackageRestData & { [key: string]: JSONValue }): Promise<IncomingDataPackage<d>> {
        const { waitId = uuidv4(), timeout = 60000, ...payload } = data;

        return new Promise<IncomingDataPackage<d>>((resolve, reject) => {
            this._awaitMessages[waitId] = {
                waitId,
                resolve,
                reject,
                timeout: timeout ? setTimeout(() => reject(new Error('AS: The waiting time has been exceeded')), timeout) : undefined,
            };

            this.sendNoReply({
                waitId,
                isEvent: false,
                data: payload,
            });
        });
    }
}

interface ServerEngineEvents<A extends AsyncSocket = AsyncSocket> {
    connection: (data: A) => void;
}

export interface ServerEngine<A extends AsyncSocket = AsyncSocket> extends InstanceType<typeof EventEmitter> {
    on<K extends keyof ServerEngineEvents<A>>(event: K, listener: ServerEngineEvents<A>[K]): this;
}

export class AsyncSocketServer<E extends ServerEngine<A> = ServerEngine, A extends AsyncSocket = AsyncSocket> extends EventEmitter {
    engine: E;
    constructor(engine: E) {
        super();
        this.engine = engine;

        this.engine.on('connection', (asyncSocket) => {
            this.emit('connection', asyncSocket);
        });
    }

    on<K extends keyof ServerEngineEvents<A>>(event: K, listener: ServerEngineEvents<A>[K]): this {
        return super.on(event, listener);
    }

    emit<K extends keyof ServerEngineEvents<A>>(event: K, ...args: Parameters<ServerEngineEvents<A>[K]>): boolean {
        return super.emit(event, ...args);
    }
}

export default {
    AsyncSocket,
    AsyncSocketServer,
};

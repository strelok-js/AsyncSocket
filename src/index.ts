import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

export type SentData = {
    waitId?: string;
    isEvent?: boolean;
    eventName?: string;
    timeout?: number;
} & SentDataStore;

export type StoredSentData = {
    resolve: (value: IncomingDataStore | PromiseLike<IncomingDataStore>) => void;
} & SentData;

export type SentDataStore = {
    [key: string]: SentDataStore | unknown;
};

export interface EngineEvents {
    message: (data: IncomingDataStore) => void;
}

export interface Engine extends EventEmitter {
    send(data: SentData): void;
    on<K extends keyof EngineEvents>(event: K, listener: EngineEvents[K]): this;
}

export interface IncomingDataStore {
    [key: string]: SentDataStore | unknown;
    as: AsyncSocket;
    waitId?: string;
    eventName?: string;
    isEvent?: boolean;

    sendNoReply(data: SentDataStore): void;
    send(data: SentData | SentDataStore): ReturnType<Engine['send']>;
    accept(as: AsyncSocket): IncomingDataStore;
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
    _incomingType(data: IncomingDataStore) {
        if (data.isEvent && data.eventName) {
            this.emit(data.eventName, data.body);
            return 1;
        }
        if (data.waitId && this._awaitMessages[data.waitId]) {
            this._awaitMessages[data.waitId].resolve(data.accept(this));
            clearTimeout(this._awaitMessages[data.waitId].timeout);
            delete this._awaitMessages[data.waitId];
            return 0;
        }
        return 2;
    }
    sendEmit(eventName: string, body: SentDataStore) {
        return this.sendNoReply({
            isEvent: true,
            eventName,
            body,
        });
    }
    sendNoReply(data: SentDataStore) {
        this.engine.send(data);
    }
    send(data: SentData = {}): Promise<IncomingDataStore> {
        const { waitId = uuidv4(), timeout = 60000 } = data;

        return new Promise((resolve, reject) => {
            this._awaitMessages[waitId] = {
                waitId,
                resolve,
                reject,
                timeout: timeout ? (setTimeout(() => reject(new Error('The waiting time has been exceeded')), timeout) as unknown as number) : undefined,
            };

            this.sendNoReply({ ...data, waitId });
        });
    }
}

interface ServerEngineEvents {
    connection: (data: AsyncSocket) => void;
}

export interface ServerEngine extends EventEmitter {
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

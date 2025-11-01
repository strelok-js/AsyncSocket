import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

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

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TIMEOUT = 60000;
const MESSAGE_TYPE = {
    RESPONSE: 0,
    EVENT: 1,
    UNHANDLED: 2,
} as const;

// ============================================================================
// AsyncSocket Class
// ============================================================================

export class AsyncSocket<E extends Engine = Engine> extends EventEmitter {
    readonly engine: E;
    private readonly options: any;
    private readonly _awaitMessages: Map<string, StoredSentData<any>>;

    constructor(engine: E, options = {}) {
        super();
        this.engine = engine;
        this.options = options;
        this._awaitMessages = new Map();

        this.setupMessageHandler();
    }

    // ========================================================================
    // EventEmitter Overrides
    // ========================================================================

    on<D = any>(event: string | symbol, listener: (data: IncomingDataPackage<D>) => void): this {
        return super.on(event as string | symbol, listener);
    }

    emit<D = any>(event: string | symbol, data: D): boolean {
        return super.emit(event, data);
    }

    // ========================================================================
    // Private Methods
    // ========================================================================

    private setupMessageHandler(): void {
        this.engine.on('message', (message: IncomingDataPackage) => {
            const messageType = this.processIncomingMessage(message);

            if (messageType === MESSAGE_TYPE.UNHANDLED) {
                this.emit('message', message.accept(this));
            }
        });
    }

    private processIncomingMessage(packageData: IncomingDataPackage): (typeof MESSAGE_TYPE)[keyof typeof MESSAGE_TYPE] {
        // Handle event messages
        if (this.isEventMessage(packageData)) {
            this.emit(packageData.eventName!, packageData.accept(this));
            return MESSAGE_TYPE.EVENT;
        }

        // Handle response messages
        if (this.isResponseMessage(packageData)) {
            this.handleResponseMessage(packageData);
            return MESSAGE_TYPE.RESPONSE;
        }

        // Unhandled message
        return MESSAGE_TYPE.UNHANDLED;
    }

    private isEventMessage(packageData: IncomingDataPackage): boolean {
        return packageData.isEvent === true && Boolean(packageData.eventName);
    }

    private isResponseMessage(packageData: IncomingDataPackage): boolean {
        return Boolean(packageData.waitId) && this._awaitMessages.has(packageData.waitId!);
    }

    private handleResponseMessage(packageData: IncomingDataPackage): void {
        const storedData = this._awaitMessages.get(packageData.waitId!);
        if (!storedData) return;

        storedData.resolve(packageData.accept(this));
        this.clearTimeout(storedData.timeout);
        this._awaitMessages.delete(packageData.waitId!);
    }

    private clearTimeout(timeout?: number | ReturnType<typeof setTimeout>): void {
        if (timeout && typeof timeout !== 'number') {
            clearTimeout(timeout);
        }
    }

    private createTimeoutHandler(waitId: string, timeout: number): ReturnType<typeof setTimeout> {
        return setTimeout(() => {
            const storedData = this._awaitMessages.get(waitId);
            if (storedData) {
                storedData.reject(new Error('AS: The waiting time has been exceeded'));
                this._awaitMessages.delete(waitId);
            }
        }, timeout);
    }

    private storePendingMessage<d = any>(
        waitId: string,
        timeout: number,
        resolve: (value: IncomingDataPackage<d>) => void,
        reject: (reason?: any) => void,
    ): void {
        this._awaitMessages.set(waitId, {
            waitId,
            resolve,
            reject,
            timeout: timeout > 0 ? this.createTimeoutHandler(waitId, timeout) : undefined,
        });
    }

    // ========================================================================
    // Public Methods
    // ========================================================================

    sendEmit(eventName: string, payload: any): void {
        this.sendNoReply({
            isEvent: true,
            eventName,
            data: payload,
        });
    }

    sendNoReply(data: AsyncSocketPackageRestData): void {
        this.engine.send(data);
    }

    send<d = any>(data: AsyncSocketPackageRestData): Promise<IncomingDataPackage<d>> {
        const { waitId = uuidv4(), timeout = DEFAULT_TIMEOUT, ...payload } = data;

        return new Promise<IncomingDataPackage<d>>((resolve, reject) => {
            this.storePendingMessage(waitId, timeout, resolve, reject);

            this.sendNoReply({
                waitId,
                isEvent: false,
                data: payload,
            });
        });
    }
}

// ============================================================================
// AsyncSocketServer Class
// ============================================================================

export class AsyncSocketServer<E extends ServerEngine<A> = ServerEngine, A extends AsyncSocket = AsyncSocket> extends EventEmitter {
    readonly engine: E;

    constructor(engine: E) {
        super();
        this.engine = engine;
        this.setupConnectionHandler();
    }

    private setupConnectionHandler(): void {
        this.engine.on('connection', (asyncSocket: A) => {
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

// ============================================================================
// Default Export
// ============================================================================

export default {
    AsyncSocket,
    AsyncSocketServer,
};

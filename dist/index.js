"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsyncSocketServer = exports.AsyncSocket = void 0;
const uuid_1 = require("uuid");
const events_1 = require("events");
// ============================================================================
// Constants
// ============================================================================
const DEFAULT_TIMEOUT = 60000;
const MESSAGE_TYPE = {
    RESPONSE: 0,
    EVENT: 1,
    UNHANDLED: 2,
};
// ============================================================================
// AsyncSocket Class
// ============================================================================
class AsyncSocket extends events_1.EventEmitter {
    engine;
    options;
    _awaitMessages;
    constructor(engine, options = {}) {
        super();
        this.engine = engine;
        this.options = options;
        this._awaitMessages = new Map();
        this.setupMessageHandler();
    }
    // ========================================================================
    // EventEmitter Overrides
    // ========================================================================
    on(event, listener) {
        return super.on(event, listener);
    }
    emit(event, data) {
        return super.emit(event, data);
    }
    // ========================================================================
    // Private Methods
    // ========================================================================
    setupMessageHandler() {
        this.engine.on('message', (message) => {
            const messageType = this.processIncomingMessage(message);
            if (messageType === MESSAGE_TYPE.UNHANDLED) {
                this.emit('message', message.accept(this));
            }
        });
    }
    processIncomingMessage(packageData) {
        // Handle event messages
        if (this.isEventMessage(packageData)) {
            this.emit(packageData.eventName, packageData.accept(this));
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
    isEventMessage(packageData) {
        return packageData.isEvent === true && Boolean(packageData.eventName);
    }
    isResponseMessage(packageData) {
        return Boolean(packageData.waitId) && this._awaitMessages.has(packageData.waitId);
    }
    handleResponseMessage(packageData) {
        const storedData = this._awaitMessages.get(packageData.waitId);
        if (!storedData)
            return;
        storedData.resolve(packageData.accept(this));
        this.clearTimeout(storedData.timeout);
        this._awaitMessages.delete(packageData.waitId);
    }
    clearTimeout(timeout) {
        if (timeout && typeof timeout !== 'number') {
            clearTimeout(timeout);
        }
    }
    createTimeoutHandler(waitId, timeout) {
        return setTimeout(() => {
            const storedData = this._awaitMessages.get(waitId);
            if (storedData) {
                storedData.reject(new Error('AS: The waiting time has been exceeded'));
                this._awaitMessages.delete(waitId);
            }
        }, timeout);
    }
    storePendingMessage(waitId, timeout, resolve, reject) {
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
    sendEmit(eventName, payload) {
        this.sendNoReply({
            isEvent: true,
            eventName,
            data: payload,
        });
    }
    sendNoReply(data) {
        const { waitId, ...payload } = data;
        this.engine.send({
            waitId,
            isEvent: false,
            data: payload,
        });
    }
    send(data) {
        const { waitId = (0, uuid_1.v4)(), timeout = DEFAULT_TIMEOUT, ...payload } = data;
        return new Promise((resolve, reject) => {
            this.storePendingMessage(waitId, timeout, resolve, reject);
            this.sendNoReply({
                waitId,
                isEvent: false,
                data: payload,
            });
        });
    }
}
exports.AsyncSocket = AsyncSocket;
// ============================================================================
// AsyncSocketServer Class
// ============================================================================
class AsyncSocketServer extends events_1.EventEmitter {
    engine;
    constructor(engine) {
        super();
        this.engine = engine;
        this.setupConnectionHandler();
    }
    setupConnectionHandler() {
        this.engine.on('connection', (asyncSocket) => {
            this.emit('connection', asyncSocket);
        });
    }
    on(event, listener) {
        return super.on(event, listener);
    }
    emit(event, ...args) {
        return super.emit(event, ...args);
    }
}
exports.AsyncSocketServer = AsyncSocketServer;
// ============================================================================
// Default Export
// ============================================================================
exports.default = {
    AsyncSocket,
    AsyncSocketServer,
};

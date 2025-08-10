"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsyncSocketServer = exports.AsyncSocket = void 0;
const uuid_1 = require("uuid");
const events_1 = require("events");
class AsyncSocket extends events_1.EventEmitter {
    engine;
    options;
    _awaitMessages;
    constructor(engine, options = {}) {
        super();
        this.engine = engine;
        this.options = options;
        this._awaitMessages = {};
        this.engine.on('message', (message) => {
            if (this._incomingType(message) === 2)
                return this.emit('message', message.accept(this));
        });
    }
    _incomingType(packageData) {
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
    sendEmit(eventName, payload) {
        return this.sendNoReply({
            isEvent: true,
            eventName,
            data: payload,
        });
    }
    sendNoReply(data) {
        this.engine.send(data);
    }
    send(data) {
        const { waitId = (0, uuid_1.v4)(), timeout = 60000, ...payload } = data;
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
exports.AsyncSocket = AsyncSocket;
class AsyncSocketServer extends events_1.EventEmitter {
    engine;
    constructor(engine) {
        super();
        this.engine = engine;
        this.engine.on('connection', (asyncSocket) => {
            this.emit('connection', asyncSocket);
        });
    }
}
exports.AsyncSocketServer = AsyncSocketServer;
// Default export для браузера
exports.default = {
    AsyncSocket,
    AsyncSocketServer,
};

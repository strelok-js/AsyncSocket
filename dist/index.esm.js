import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
export class AsyncSocket extends EventEmitter {
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
export class AsyncSocketServer extends EventEmitter {
    engine;
    constructor(engine) {
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

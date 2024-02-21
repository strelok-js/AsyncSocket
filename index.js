const WebSocket = require('ws');
const EventEmitter = require('node:events');

function JSONParse(message) {
    try {
        return JSON.parse(message);
    } catch (err) {
        return null;
    }
}
class AsyncSocket extends EventEmitter {
    constructor(ws) {
        super();
        this.ws = ws;
        this._awaitMessages = {};

        ws.on('message', (blobMessage) => {
            const data = JSONParse(blobMessage);
            if(data === null) return this.emit('message', blobMessage);
            if(this._incoming(data)===2) return this.emit('message', {
                ...data,
                asyncSocket: this,
                reply: function(data) {
                    data.waitId ??= this.waitId;
                    return this.asyncSocket.send(data);
                }
            });
        });
        
        this.nativeOn = this.on;
        this.on = function(event, listener) {
            if(event=="message") this.nativeOn(event, listener);
            else ws.on(event, listener);
        };
        this.emit('open');
    }
    _incoming(data) {
        if(this._awaitMessages[data.waitId]) {
            this._awaitMessages[data.waitId].resolve(data);
            clearTimeout(this._awaitMessages[data.waitId].timeout);
            delete this._awaitMessages[data.waitId];
            return 0;
        }
        if(data.isEvent) {
            this.emit(data.eventName, data.body);
            return 1;
        }
        return 2;
    }
    sendEmit(eventName, body) {
        return this.sendNoReply({
            isEvent: true,
            eventName, body
        });
    }
    sendNoReply(data) {
        this.ws.send(JSON.stringify(data));
    }
    send(data={}) {
        const {waitId = Date.now().toString(), timeout=10000} = data;
        return new Promise((resolve, reject) => {
            this._awaitMessages[waitId] = {
                waitId, resolve, reject,
                timeout: timeout?setTimeout(() => reject(new Error("The waiting time has been exceeded")), timeout):null
            };

            this.sendNoReply(data);
        });
    }
}

class AsyncSocketServer extends EventEmitter {
    constructor(serverOptions) {
        super();
        const wss = new WebSocket.Server(serverOptions);
        this._wss = wss;

        wss.on('connection', ws=>{
            const wsr = new AsyncSocket(ws);
            this.emit('connection', wsr);
        });

        this.nativeOn = this.on;
        this.on = function(event, listener) {
            if(event=="connection") this.nativeOn(event, listener);
            else wss.on(event, listener);
        };
    }
}
function AsyncSocketClient(wsc) {
    return new Promise((resolve, reject) => {
        wsc.on('open', async () => {
            const wsr = new AsyncSocket(wsc);
            resolve(wsr);
        });
    });
}
module.exports = {AsyncSocket, AsyncSocketServer, AsyncSocketClient};
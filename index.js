const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('node:events');

function JSONParse(message) {
    try {
        return JSON.parse(message);
    } catch (err) {
        return null;
    }
}
class AsyncSocket extends EventEmitter {
    constructor(ws, options={}) {
        super();
        this.ws = ws;
        this.options = options;
        this._awaitMessages = {};
        this.timeout = {
            time:options.time??2,//секунды
            count:1,
            countLimit: options.count??5
        };
        this.tasksForRecon = [];
        this.ws.on('message', (blobMessage) => {
            const data = JSONParse(blobMessage);
            if(data === null) return this.emit('message', blobMessage);
            if(this._incoming(data)===2) return this.emit('message', {
                ...data,
                asyncSocket: this,
                reply: function(data) {
                    data.waitId ??= this.waitId;
                    data.timeout ??= null;
                    return this.asyncSocket.send(data);
                }
            });
        });
        
        this.nativeOn = this.on;
        this.on = function(event, listener) {
            if(!['error', 'upgrade', 'ping', 'pong', "unexpected-response"].includes(event)) this.nativeOn(event, listener);
            else this.ws.on(event, listener);
        };
        this.emit('open');
        if(options.reconnect){
            this.ws.on("close", ()=>{
                this.emit('close');
                const oldEvents = this.ws._events;
                this.disconnected = true;
                const reconnect = address => new Promise((resolve, reject)=>{
                    const ws = new WebSocket(address);
                    ws.on("open", ()=>{
                        this.ws = ws;
                        this.emit('reconnect');
                        this.timeout.count = 1;
                        this.ws._events = oldEvents;
                        this.disconnected = false;
                        for(const task of this.tasksForRecon) this.sendNoReply(task);
                        this.tasksForRecon = [];
                        resolve(this.ws);
                    });
                    ws.on("error", reject);
                    ws.on("close", reject);
                }).catch(async (reason)=>{
                    if(this.timeout.count > this.timeout.countLimit) return this.emit('close');
                    await new Promise(resolve=>setTimeout(resolve, (this.timeout.time*this.timeout.count)*1000));
                    this.timeout.count++;
                    reconnect(address);
                });
                reconnect(this.ws._url);
            });
        }
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
        if(this.disconnected) this.tasksForRecon.push(data);
        else this.ws.send(JSON.stringify(data));
    }
    send(data={}) {
        const {waitId = uuidv4(), timeout=10000, noReply=false} = data;

        this.sendNoReply({...data, waitId, noReply});

        if(!noReply) return new Promise((resolve, reject) => {
            this._awaitMessages[waitId] = {
                waitId, resolve, reject,
                timeout: timeout?setTimeout(() => reject(new Error("The waiting time has been exceeded")), timeout):null
            };   
        }); else return void 0;
    }
}

class AsyncSocketServer extends EventEmitter {
    constructor(serverOptions) {
        super();
        const wss = new WebSocket.Server(serverOptions);
        this._wss = wss;

        wss.on('connection', ws=>{
            const wsr = new AsyncSocket(ws, {});
            this.emit('connection', wsr);
        });

        this.nativeOn = this.on;
        this.on = function(event, listener) {
            if(event=="connection") this.nativeOn(event, listener);
            else wss.on(event, listener);
        };
    }
}
function AsyncSocketClient(wsc, options) {
    return new Promise((resolve, reject) => {
        wsc.on('open', async () => {
            const wsr = new AsyncSocket(wsc,options);
            resolve(wsr);
        });
    });
}
module.exports = {AsyncSocket, AsyncSocketServer, AsyncSocketClient};

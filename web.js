function JSONParse(message) {
    try {
        return JSON.parse(message);
    } catch (err) {
        return null;
    }
}
function uuidv4() {
    return "10000000-1000-4000-8000-100000000000".replace(
        /[018]/g, 
        c =>(c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}
  

class AsyncSocket extends EventTarget {
    constructor(ws, options={}) {
        super();
        this.ws = ws;
        this._awaitMessages = {};
        this.timeout = {
            time:options.time??2,//секунды
            countLimit:options.count??5,
            count:1
        };
        this.tasksForRecon = [];

        ws.addEventListener('message', (message) => {
            const data = JSONParse(message.data);
            if(data === null) return this.dispatchEvent(new CustomEvent('message', {detail: message}));
            if(this._incoming(data)===2) return this.dispatchEvent(new CustomEvent('message', {
                detail: {
                    ...data,
                    asyncSocket: this,
                    reply: function(data) {
                        data.waitId ??= this.waitId;
                        return this.asyncSocket.send(data);
                    }
                }
            }));
        });
        
        this.nativeOn = this.addEventListener;
        this.addEventListener = function(event, listener) {
            if(![].includes(event)) this.nativeOn(event, listener);
            else ws.addEventListener(event, listener);
        };
        this.dispatchEvent(new CustomEvent('open'));
        if(options.reconnect){
            this.ws.addEventListener("close", ()=>{
                const oldEvents = this.ws._events;
                this.disconnected = true;
                const reconnect = address => new Promise((resolve, reject)=>{
                    const ws = new WebSocket(address);
                    ws.addEventListener("open", ()=>{
                        this.ws = ws;
                        this.timeout.count = 1;
                        this.ws._events = oldEvents;
                        this.disconnected = false;
                        for(const task of this.tasksForRecon) this.sendNoReply(task);
                        this.tasksForRecon = [];
                        resolve(ws);
                    });
                    ws.addEventListener("error", reject);
                    ws.addEventListener("close", reject);
                }).catch(async (reason)=>{
                    if(this.timeout.count > this.timeout.countLimit) return;
                    await new Promise(resolve=>setTimeout(resolve, (this.timeout.time**this.timeout.count)*1000));
                    this.timeout.count++;
                    reconnect(address);
                });
                reconnect(this.ws.url);
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
            this.dispatchEvent(new CustomEvent(data.eventName, {detail: data.body}));
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
        const {waitId = uuidv4(), timeout=10000} = data;
        return new Promise((resolve, reject) => {
            this._awaitMessages[waitId] = {
                waitId, resolve, reject,
                timeout: timeout?setTimeout(() => reject(new Error("The waiting time has been exceeded")), timeout):null
            };

            this.sendNoReply({...data, waitId});
        });
    }
}

function AsyncSocketClient(wsc,options) {
    return new Promise((resolve, reject) => {
        wsc.addEventListener('open', async () => {
            const wsr = new AsyncSocket(wsc,options);
            resolve(wsr);
        });
    });
}

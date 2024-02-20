function JSONParse(message) {
    try {
        return JSON.parse(message);
    } catch (err) {
        return null;
    }
}

class AsyncSocket extends EventTarget {
    constructor(ws) {
        super();
        this.ws = ws;
        this._awaitMessages = {};

        ws.addEventListener('message', (message) => {
            const data = JSONParse(message.data);
            if(data === null) return this.dispatchEvent('message', message);
            if(this._incoming(data)===2) return this.dispatchEvent(new CustomEvent('message', {
                data: {
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
            if(event=="message") this.nativeOn(event, listener);
            else ws.addEventListener(event, listener);
        };
        this.dispatchEvent(new CustomEvent('open'));
    }
    _incoming(data) {
        if(this._awaitMessages[data.waitId]) {
            this._awaitMessages[data.waitId].resolve(data);
            clearTimeout(this._awaitMessages[data.waitId].timeout);
            delete this._awaitMessages[data.waitId];
            return 0;
        }
        if(data.isEvent) {
            this.dispatchEvent(new CustomEvent(data.eventName, data.body));

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

function AsyncSocketClient(wsc) {
    return new Promise((resolve, reject) => {
        wsc.addEventListener('open', async () => {
            const wsr = new AsyncSocket(wsc);
            resolve(wsr);
        });
    });
}
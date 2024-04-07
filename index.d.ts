import { ServerOptions, WebSocketServer } from "ws";

export class AsyncSocket {
    constructor(ws: WebSocket, options?: {
        reconnect: Boolean,
        time: number,
        count: number
    });
    ws: WebSocket;
    options: {
        reconnect: Boolean,
        time: number,
        count: number
    };
    _awaitMessages: object;
    timeout: {
        time: any;
        count: number;
        countLimit: any;
    };
    tasksForRecon: any[];
    nativeOn: any;
    on: (event: string, listener: any) => void;
    disconnected: boolean;
    _incoming(data: any): 0 | 1 | 2;
    sendEmit(eventName: string, body: object): void;
    sendNoReply(data: object): void;
    send(data?: object): Promise<object>;
}
export class AsyncSocketServer {
    constructor(serverOptions: ServerOptions);
    _wss: WebSocketServer;
    nativeOn: any;
    on: (event: string, listener: any) => void;
}
export function AsyncSocketClient(wsc: any, options: any): any;

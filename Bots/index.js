import { WebSocketServer } from "ws";
import { Worker } from "node:worker_threads";

console.log('Server started....');

class ClientManager {
    constructor() {
        if (!ClientManager.instance) {
            this.clients = new Map();
            ClientManager.instance = this;
        }
        return ClientManager.instance;
    }

    reset() {
        this.clients.forEach((client, ip) => {
            this.remove(ip);
        });
    }

    getClient(ip) {
        return this.clients.get(ip) || null;
    }

    set(ip, socket, origin) {
        let client = this.clients.get(ip);
        if (!client) {
            client = new Client(ip, socket, origin);
            this.clients.set(ip, client);
            console.log('New connection added.');
        }
        return client;
    }

    remove(ip) {
        if (this.clients.has(ip)) {
            const client = this.clients.get(ip);
            client.clear();
            this.clients.delete(ip);
        }
    }
}

class Client {
    constructor(ip, socket, origin) {
        this.clientIP = ip;
        this.clientSocket = socket;
        this.clientOrigin = origin;
        this.clientManager = new ClientManager();
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.clientSocket.on('message', this.onMessage.bind(this));
        this.clientSocket.on('error', this.onError.bind(this));
        this.clientSocket.on('close', this.onClose.bind(this));

        this.setupThreads();
    }

    getWorker(origin) {
        switch (origin) {
            case "https://agar.cc": {
                return "./protocols/agarioCC.js";
            }
            default: {
                return "./protocols/default.js";
            }
        }
    }

    setupThreads() {
        var getWorker = this.getWorker(this.clientOrigin);

        this.worker = new Worker(getWorker);

        this.worker.on('message', (message) => {
            var msg = JSON.parse(message);
            switch (msg.type) {
                case "openConnectionsUpdate":
                    let botCount = this.Buffer(15);
                    botCount.setUint8(0, 6);
                    botCount.setUint32(1, msg.count, true);
                    botCount.setUint32(10, msg.max, true);
                    this.send(botCount);
                    break;
            }
        });
    }

    get wsOPEN() {
        return this.clientSocket && this.clientSocket.readyState == 1;
    }
    send(message) {
        if (this.wsOPEN) {
            this.clientSocket.send(message);
        }
    }

    onClose(code, reason) {
        console.log(`Connection closed | Code: ${code}, Reason: ${reason}`);
        this.worker.terminate();
        this.clientManager.remove(this.clientIP);
    }

    onMessage(data, isBinary) {
        try {
            var reader = Buffer.from(data);
            const header = reader.readUInt8(0, true);

            switch (header) {
                case 0:
                    var string = reader.toString('utf16le', 1);
                    if (this.worker) {
                        this.worker.postMessage(JSON.stringify({
                            type: 'startBots',
                            url: string
                        }));
                    }
                    break;
                case 1:
                    if (this.worker) {
                        this.worker.postMessage(JSON.stringify({
                            type: 'stopBots'
                        }));
                    }
                    break;
                case 2:
                    if (this.worker) {
                        this.worker.postMessage(JSON.stringify({
                            type: 'splitBots'
                        }));
                    }
                    break;
                case 3:
                    if (this.worker) {
                        this.worker.postMessage(JSON.stringify({
                            type: 'ejectBots'
                        }));
                    }
                    break;
                case 4:
                    var clientX = reader.readDoubleLE(1);
                    var clientY = reader.readDoubleLE(9);
                    if (this.worker) {
                        this.worker.postMessage(JSON.stringify({
                            type: 'mousePos',
                            coords: {
                                x: clientX,
                                y: clientY
                            }
                        }));
                    }
                    break;
                case 5:
                    var string = reader.toString('utf16le', 1);
                    if (this.worker) {
                        this.worker.postMessage(JSON.stringify({
                            type: 'chatBots',
                            message: string
                        }));
                    }
                    break;
            }
        } catch (error) {
            console.log(error);
        }
    }

    Buffer(buffer = 1) {
        return new DataView(new ArrayBuffer(buffer));
    }

    onError(err) {
        console.error(`Error: ${err}`);
    }

    clear() {
        this.clientSocket = null;
        this.clientIP = null;
    }
}

class Server {
    constructor(port = 8080) {
        this.port = port;
        this.clientManager = new ClientManager();
        this.runServer();
    }

    runServer() {
        this.socket = new WebSocketServer({ port: this.port });
        this.socket.on('connection', this.onConnection.bind(this));
    }

    onConnection(socket, request) {
        const ip = request.socket.remoteAddress;
        const origin = request.headers.origin;
        this.clientManager.set(ip, socket, origin);
    }
}

globalThis.botServer = new Server();
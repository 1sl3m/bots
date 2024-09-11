import { parentPort } from "node:worker_threads";
import config from "../config.js";
import { WebSocket } from "ws";
import axios from "axios";
import ProxyAgent from "proxy-agent";

console.log("Loading default...");

const url =
    "https://raw.githubusercontent.com/themiralay/Proxy-List-World/master/data.txt";

let proxyList = [];

const fetchProxies = async () => {
    try {
        const response = await axios.get(url);
        const data = response.data;
        proxyList = data
            .split(/\r?\n/)
            .filter((proxy) => proxy.trim() !== "")
            .map((proxy) => proxy.replace(/\r$/, ""));
        console.log("Proxies fetched:", proxyList.length);
    } catch (error) {
        console.error(`Error fetching proxies: ${error}`);
    }
};

fetchProxies();

const getRandomProxy = () => {
    if (proxyList.length === 0) {
        return null;
    }
    const randomIndex = Math.floor(Math.random() * proxyList.length);
    return proxyList[randomIndex];
};

var isStartedBots = false;

class Bot {
    constructor(socketUrl) {
        this.socketUrl = socketUrl;
        this.initBot();
    }

    initBot() {
        this.botName =
            config.botNames[Math.floor(Math.random() * config.botNames.length)];
        this.isReconnecting = false;
        this.connect();
    }

    connect() {
        const randProxy = getRandomProxy();
        this.randomProxy = new ProxyAgent(`${config.proxyType}://${randProxy}`);
        this.socket = new WebSocket(this.socketUrl, {
            headers: {
                Pragma: "no-cache",
                "Cache-Control": "no-cache",
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 OPR/107.0.0.0",
                Origin: "https://agar.cc",
                "Sec-WebSocket-Version": "13",
                "Accept-Encoding": "gzip, deflate, br",
                "Accept-Language": "en-US,en;q=0.9",
            },
            rejectUnauthorized: false,
            agent: this.randomProxy,
        });

        this.socket.binaryType = "arraybuffer";
        this.socket.onopen = this.onOpen.bind(this);
        this.socket.onmessage = this.onMessage.bind(this);
        this.socket.onerror = this.onError.bind(this);
        this.socket.onclose = this.onClose.bind(this);
    }

    reconnect() {
        this.clearIntervals();

        delete this.socket;
        delete this.randomProxy;

        if (this.socketUrl) {
            this.connect();
        }
    }

    disconnect() {
        this.clearIntervals();

        if (this.socket) {
            this.socket.terminate();
            this.socket = null;
        }

        delete this.socket;
        delete this.randomProxy;
    }

    clearIntervals() {
        clearInterval(this.pingInterval);
        clearTimeout(this.spawnInterval);
    }

    Buffer(buf = 1) {
        return new DataView(new ArrayBuffer(buf));
    }

    onOpen() {
        // Implement.
    }

    onMessage(data) {
        // Implement.
    }

    onError(error) {
        // Implement.
    }

    onClose() {
        this.handleReconnection();
    }

    handleReconnection() {
        if (!this.isReconnecting) {
            this.isReconnecting = true;
            this.reconnect();
        }
    }

    spawn() {
        // Implement.
    }

    split() {
        this.sendUint8(17);
    }

    eject() {
        this.sendUint8(21);
    }

    sendMove(x, y) {
        // Implement.
    }

    sendChat(message) {
        // Implement.
    }

    sendUint8(offset) {
        const onebyte = new DataView(new ArrayBuffer(1));
        onebyte.setUint8(0, offset);
        this.send(onebyte);
    }

    get onopen() {
        return this.socket && this.socket.readyState === WebSocket.OPEN;
    }

    send(data) {
        if (this.onopen) {
            this.socket.send(data.buffer);
        }
    }
}

const bots = [];

const sendOpenConnectionsUpdate = () => {
    const openBots = bots.filter(
        (bot) => bot.socket && bot.socket.readyState === WebSocket.OPEN,
    );

    parentPort.postMessage(
        JSON.stringify({
            type: "openConnectionsUpdate",
            count: openBots.length,
            max: config.max,
        }),
    );
};

const updateInterval = setInterval(sendOpenConnectionsUpdate, 500);

parentPort.on("message", (message) => {
    const msg = JSON.parse(message);
    switch (msg.type) {
        case "startBots":
            if (!isStartedBots) {
                const socketUrl = msg.url;
                for (let i = 0; i < config.max; i++) {
                    bots.push(new Bot(socketUrl));
                }
                isStartedBots = true;
            }
            break;
        case "stopBots":
            bots.forEach((bot) => bot.disconnect());
            bots.length = 0;
            isStartedBots = false;
            break;
        case "splitBots":
            bots.forEach((bot) => bot.split());
            break;
        case "ejectBots":
            bots.forEach((bot) => bot.eject());
            break;
        case "mousePos":
            const { x, y } = msg.coords;
            bots.forEach((bot) => bot.sendMove(x, y));
            break;
        case "chatBots":
            bots.forEach((bot) => bot.sendChat(msg.message));
            break;
    }
});
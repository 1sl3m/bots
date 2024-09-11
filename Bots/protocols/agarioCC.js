import { parentPort } from 'node:worker_threads';
import config from "../config.js";
import { WebSocket } from 'ws';
import axios from 'axios';
import ProxyAgent from 'proxy-agent';

console.log('Loading agar.cc');

let proxyList = [];

const fetchProxies = async () => {
    try {
        const response = await axios.get(config.url);
        const data = response.data;
        proxyList = data.split(/\r?\n/).filter(proxy => proxy.trim() !== '').map(proxy => proxy.replace(/\r$/, ''));
        console.log('Proxies fetched:', proxyList.length);
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
        this.botName = config.botNames[Math.floor(Math.random() * config.botNames.length)];
        this.isReconnecting = false;
        this.connect();
    }

    async connect() {
        const randProxy = getRandomProxy();
        this.randomProxy = new ProxyAgent(`${config.proxyType}://${randProxy}`);
        this.newParsedUrl = await this.requestRegionCode(this.socketUrl).catch(() => null);
        if (!this.newParsedUrl) {
            return this.onClose();
        }
        this.socket = new WebSocket(this.newParsedUrl, {
            headers: {
                'Pragma': 'no-cache',
                'Cache-Control': 'no-cache',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 OPR/107.0.0.0',
                'Origin': 'https://agar.cc',
                'Sec-WebSocket-Version': '13',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            rejectUnauthorized: false,
            agent: this.randomProxy
        });
        this.socket.binaryType = 'arraybuffer';
        this.socket.on('open', this.onOpen.bind(this));
        this.socket.on('message', this.onMessage.bind(this));
        this.socket.on('error', this.onError.bind(this));
        this.socket.on('close', this.onClose.bind(this));
    }

    async requestRegionCode(originalURL) {
        try {
            const response = await axios.get("https://agar.cc/", {
                httpsAgent: this.randomProxy,
                timeout: 5000
            });

            const keyValue = this.extractKeyValue(response.data);
            if (keyValue) {
                const updatedURL = this.replaceKeyValueInURL(originalURL, keyValue);
                return updatedURL;
            } else {
                throw new Error("Key value not found in the response body.");
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                //console.log('Fetch aborted');
            } else {
                //throw new Error(`Error: ${error}`);
            }
        }
    }

    replaceKeyValueInURL(url, keyValue) {
        const regex = /\?key=[^"'\s]+/;
        return url.replace(regex, `?key=${keyValue}`);
    }

    extractKeyValue(body) {
        const regex = /\?key=([^"'\s]+)/;
        const match = body.match(regex);
        if (match && match[1]) {
            return match[1];
        }
        return null;
    }

    reconnect() {
        this.clearIntervals();

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
    }

    clearIntervals() {
        clearInterval(this.pingInterval);
        clearTimeout(this.spawnInterval);
    }

    Buffer(buf = 1) {
        return new DataView(new ArrayBuffer(buf));
    }

    onOpen() {
        //console.log('Bot connected:', this.botName);
        var msg = this.Buffer(5);
        msg.setUint8(0, 254);
        msg.setUint32(1, 5, true);
        this.send(msg);
        msg = this.Buffer(5);
        msg.setUint8(0, 255);
        msg.setUint32(1, 123456789, true);
        this.send(msg);
        this.sendNickName();
        this.sendHand();

        this.spawnInterval = setInterval(() => {
            this.sendNickName();
        }, 3000);
    }

    sendHand() {
        var hash = '12321321';
        var msg = this.Buffer(1 + 2 * hash.length);
        msg.setUint8(0, 56);
        for (var i = 0; i < hash.length; ++i) msg.setUint16(1 + 2 * i, hash.charCodeAt(i), true);
        this.send(msg);
    }

    sendNickName() {
        const max = 704;
        const randomInt = Math.floor(Math.random() * (max + 1));

        var type = "{" + randomInt + "}";

        var userNickName = type + this.botName;
        var msg = this.Buffer(1 + 2 * userNickName.length);

        msg.setUint8(0, 192);
        for (var i = 0; i < userNickName.length; ++i) msg.setUint16(1 + 2 * i, userNickName.charCodeAt(i), true);
        this.send(msg);
    }

    onMessage(data) {
    }

    onError(error) {
    }

    onClose() {
        //console.log('Bot disconnected:', this.botName);
        this.handleReconnection();
    }

    handleReconnection() {
        if (!this.isReconnecting) {
            this.isReconnecting = true;
            this.reconnect();
        }
    }

    spawn() {
    }

    split() {
        this.sendUint8(17);
    }

    eject() {
        this.sendUint8(21);
    }

    sendMove(x, y) {
        var msg = this.Buffer(21);
        msg.setUint8(0, 16);
        msg.setFloat64(1, x, true);
        msg.setFloat64(9, y, true);
        msg.setUint32(17, 0, true);
        this.send(msg);
    }

    sendChat(message) {
        var msg = this.Buffer(2 + 2 * message.length);
        var offset = 0;
        var flags = 0;
        msg.setUint8(offset++, 206);
        msg.setUint8(offset++, flags);
        for (var i = 0; i < message.length; ++i) {
            msg.setUint16(offset, message.charCodeAt(i), true);
            offset += 2;
        }

        this.send(msg);
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
    const openBots = bots.filter(bot => bot.socket && bot.socket.readyState === WebSocket.OPEN);

    parentPort.postMessage(JSON.stringify({
        type: 'openConnectionsUpdate',
        count: openBots.length,
        max: config.max
    }));
};

const updateInterval = setInterval(sendOpenConnectionsUpdate, 500);

parentPort.on('message', (message) => {
    const msg = JSON.parse(message);
    switch (msg.type) {
        case 'startBots':
            if (!isStartedBots) {
                const socketUrl = msg.url;
                for (let i = 0; i < config.max; i++) {
                    bots.push(new Bot(socketUrl));
                }
                isStartedBots = true;
            }
            break;
        case 'stopBots':
            bots.forEach(bot => bot.disconnect());
            bots.length = 0;
            isStartedBots = false;
            break;
        case 'splitBots':
            bots.forEach(bot => bot.split());
            break;
        case 'ejectBots':
            bots.forEach(bot => bot.eject());
            break;
        case 'mousePos':
            const { x, y } = msg.coords;
            bots.forEach(bot => bot.sendMove(x, y));
            break;
        case 'chatBots':
            bots.forEach(bot => bot.sendChat(msg.message));
            break;
    }
});
// ==UserScript==
// @name         Default Bots Script
// @namespace    https://discord.gg/bAstbAfem9
// @version      1.0.0
// @description  Default Bots Script Template
// @author       Tatsuya
// @match        *.agar.cc/*
// @grant        none
// @run-at       document-start
// ==/UserScript==


(__window__ => {
  console.log("Init.");
  let client;
  class Client {
    serverSocketIP = "ws://localhost:8080/";
    socket = null;
    mouseCords = {
      x: "0",
      y: "0"
    };
    startedBots = false;
    isInjected = false;
    getId = id => {
      return document.getElementById(id);
    };
    clientSocket = "";
    constructor() {
      this.mouseInt();
      this.connectToSocket();
      this.inject();
      this.addBinds();
    }
    mouseInt() {
      setInterval(() => {
        var test = this.Buffer(26);
        test.setUint8(0, 4, true);
        test.setFloat64(1, this.mouseCords.x, true);
        test.setFloat64(9, this.mouseCords.y, true);
        this.send(test);
      }, 50);
    }
    connectToSocket() {
      this.socket = new WebSocket(this.serverSocketIP);
      this.socket.binaryType = "arraybuffer";
      this.socket.onopen = this.onOpen.bind(this);
      this.socket.onmessage = this.onMessage.bind(this);
      this.socket.onclose = this.onClose.bind(this);
      this.socket.onerror = this.onError.bind(this);
    }
    addBinds() {
      window.addEventListener("keypress", event => {
        if (event.isTrusted) {
          switch (event.key) {
            case "e":
              // Split
              this.sendByte(2);
              break;
            case "r":
              // Eject
              this.sendByte(3);
              break;
            case "p":
              // Spam
              var bruh = prompt("What should the bots spam:", "default");
              if (bruh) {
                this.sendChat(bruh);
              } else {
                return;
              }
              break;
          }
        }
      });
    }
    sendChat(msg) {
      var serverData = this.Buffer(1 + msg.length * 2);
      serverData.setUint8(0, 5);
      for (var i = 0; i < msg.length; ++i) {
        serverData.setUint16(1 + i * 2, msg.charCodeAt(i), true);
      }
      this.send(serverData);
    }
    startBots() {
      if (!this.clientSocket || this.clientSocket.includes(this.serverSocketIP)) {
        return false;
      }
      var serverData = this.Buffer(1 + this.clientSocket.length * 2);
      serverData.setUint8(0, 0);
      for (var i = 0; i < this.clientSocket.length; ++i) {
        serverData.setUint16(1 + i * 2, this.clientSocket.charCodeAt(i), true);
      }
      this.send(serverData);
      return true;
    }
    stopBots() {
      this.sendByte(1);
      return true;
    }
    setStartedInput() {
      if (this.startedBots) {
        this.startedBots = !this.stopBots();
      } else {
        this.startedBots = this.startBots();
      }
      ;
      this.updateGUIStarted(this.startedBots);
    }
    updateGUIStarted(check) {
      if (!this.isInjected) {
        return;
      }
      var buttone = this.getId("appDataStartBots");
      if (!check) {
        buttone.innerHTML = "Start";
        buttone.style.color = "green";
      } else {
        buttone.innerHTML = "Stop";
        buttone.style.color = "red";
      }
    }
    inject() {
      this.uiCode = `<div id="appData"> <div id="appDataHeader"> <div id="appDataHeaderTitle"> Bots Menu </div> </div> <div id="appDataInfo"> <div id="appDataInfoTitle"> Bots </div> <div id="appDataInfoCount"> 0 / 0 </div> </div> <div id="appDataButtons"> <div id="appDataButtonsTitle"> Start / Stop </div> <div id="appDataButtonsContainer"> <div class="appDataButton" id="appDataStartBots"> Start </div> </div> </div> <div id="appDataStatus"> <div id="appDataStatusTitle"> Status </div> <div id="appDataStatusInfo"> Disconnected </div> </div> </div> <style> #appData { background: rgba(0, 0, 0, 0.5); display: flex; width: 8rem; height: 15rem; padding: 0.5rem; justify-content: center; align-items: center; flex-direction: column; font-family: monospace; color: white; user-select: none; font-weight: bold; border-radius: 1rem; z-index: 9998; } #appDataHeader { width: 8rem; height: 2rem; text-align: center; padding: 0.5rem; display: flex; align-items: center; text-align: center; justify-content: center; } #appDataHeaderTitle {} #appDataInfo { width: 8rem; height: 3rem; text-align: center; padding: 0.5rem; display: flex; flex-direction: column; } #appDataInfoTitle { margin: 0.3rem; } #appDataInfoCount { margin: 0.3rem; } #appDataButtons { width: 8rem; height: 3rem; text-align: center; padding: 0.5rem; display: flex; flex-direction: column; } #appDataButtonsContainer { display: flex; justify-content: center; } .appDataButton { cursor: pointer; } #appDataButtonsTitle { margin: 0.3rem; } #appDataStartBots { color: green; margin: 0.3rem; } #appDataStatus { width: 8rem; height: 3rem; text-align: center; padding: 0.5rem; display: flex; flex-direction: column; } #appDataStatusTitle { margin: 0.3rem; } #appDataStatusInfo { margin: 0.3rem; color: red; } </style>`;
      const fullScreenDiv = document.createElement("div");
      fullScreenDiv.style.position = "fixed";
      fullScreenDiv.style.zIndex = "9000";
      fullScreenDiv.innerHTML = this.uiCode;
      document.body.appendChild(fullScreenDiv);
      this.getId("appDataStartBots").addEventListener("click", event => {
        if (event.isTrusted) {
          this.setStartedInput();
        }
      });
      this.isInjected = true;
    }
    onOpen() {
      console.log("Connected to Server.");
      var stats = this.getId("appDataStatusInfo");
      stats.textContent = "Connected";
      stats.style.color = "green";
    }
    updateGUICounter(spawned, max) {
      if (!this.isInjected) {
        return;
      }
      this.getId("appDataInfoCount").innerHTML = spawned + " / " + max;
    }
    onMessage(message) {
      try {
        message = this.dataParse(message.data);
        var data = new DataView(message.buffer);
        var opcode = data.getUint8(0);
        switch (opcode) {
          case 6:
            var spawnedBots = data.getUint32(1, true);
            var maxBots = data.getUint32(10, true);
            this.updateGUICounter(spawnedBots, maxBots);
            break;
        }
      } catch (error) {
        console.log(`Error in parsing data: ${error}`);
      }
    }
    resetGUI() {
      this.updateGUIStarted(this.startedBots);
    }
    onClose(msg) {
      console.log("Disconnected from Server.");
      var stats = this.getId("appDataStatusInfo");
      stats.textContent = "Disconnected";
      stats.style.color = "red";
      if (msg.code == 1006) {
        setTimeout(this.connectToSocket.bind(this), 2500);
      } else {
        setTimeout(this.connectToSocket.bind(this), 5000);
      }
      this.startedBots = false;
      this.resetGUI();
    }
    onError(error) {
      console.log("Server Error: " + error);
    }
    dataParse(args) {
      if (args instanceof ArrayBuffer) {
        return new Uint8Array(args);
      }
      if (args instanceof DataView) {
        return new Uint8Array(args.buffer);
      }
      if (args instanceof Uint8Array) {
        return args;
      }
      if (args instanceof Array) {
        return new Uint8Array(args);
      }
      throw new Error(`Unsupported data type: ${args}`);
    }
    parse(data, ws) {
      try {
        data = this.dataParse(data);
        switch (data.length) {
          case 21:
          case 17:
            data = new DataView(data.buffer);
            var datax = data.getFloat64(1, true);
            var datay = data.getFloat64(9, true);
            this.clientSocket = ws.url;
            this.mouseCords.x = datax;
            this.mouseCords.y = datay;
            break;
          default:
            this.clientSocket = ws.url;
            break;
        }
      } catch (error) {
        console.log(`Error in parsing data: ${error}`);
      }
    }
    get isSocketOpen() {
      return this.socket && this.socket.readyState === 1;
    }
    Buffer(buffer) {
      return new DataView(new ArrayBuffer(buffer));
    }
    sendByte(byte) {
      var oneByte = this.Buffer(1);
      oneByte.setUint8(0, byte);
      this.send(oneByte);
    }
    send(data) {
      if (this.isSocketOpen) {
        this.socket.send(data);
      }
    }
  }
  window.addEventListener("load", () => {
    client = new Client();
  });
  __window__.WebSocket.prototype.send = new Proxy(__window__.WebSocket.prototype.send, {
    apply: (target, thisArg, args) => {
      if (thisArg.url.includes(client?.serverSocketIP) || thisArg.url.includes("delimiter.a9a832h")) {
        return target.apply(thisArg, args);
      }
      client?.parse(...args, thisArg);
      return target.apply(thisArg, args);
    }
  });
})(window);
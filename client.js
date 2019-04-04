/**
 iZ³ | Izzzio blockchain - https://izzz.io

 Copyright 2018 Izio Ltd (OOO "Изио")

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

const RELAY_ADDRESS = 'proxyRelay';
const NODES = ["ws://176.9.104.200:6031"];
const PROXY_HOST = 'localhost';
const PROXY_PORT = 1080;

//************************************
const socks = require('socksv5');
const net = require('net');
const Candy = require('iz3-candy');
const utils = require('./utils');

let sockets = {};

const MESSAGES = {
    handshake: 'HANDSHAKE',
    handshakeOk: 'HANDSHAKEOK',
    incomeData: 'RCV',
    outcomeData: 'SND',
    newConnection: 'CNT',
    endConnection: 'END',
    socketConnected: 'CNTOK'
};

/**
 * Send message to
 * @param {string} to
 * @param {object} message
 * @param {string} messageId
 */
function sendMessage(to, message, messageId) {
    let msg = candy.starwave.createMessage(message, to, undefined, messageId);
    candy.starwave.sendMessage(msg);
}

console.log('Starting Candy connection...');
let candy = new Candy(NODES).start();

/**
 * Connecting Candy
 */
candy.onready = function () {
    console.log('Connected.');
    setTimeout(function () {
        console.log('Waiting for handshake...');
        sendMessage(RELAY_ADDRESS, {msg: 'Hello'}, MESSAGES.handshake);
    }, 1000);
};

/**
 * Handshake handler
 */
candy.starwave.registerMessageHandler(MESSAGES.handshakeOk, function (message) {
    console.log('OK Handshake received. Starting...');
    startServer();
});

/**
 * Income data handler
 */
candy.starwave.registerMessageHandler(MESSAGES.incomeData, function (message) {
    try {
        let payload = Buffer.from(message.data.data, 'hex');//utils.hexString2Uint8Array(utils.unicode2HexString(message.data.data));
        sockets[message.data.socketId].socket.write(Buffer.from(payload));
    } catch (e) {
        console.log(e);
    }
});

/**
 * Remote connection handler
 */
candy.starwave.registerMessageHandler(MESSAGES.socketConnected, function (message) {
    let socketId = message.data.socketId;
    let socket = sockets[socketId].socket;
});

/**
 * Ending connection handler
 */
candy.starwave.registerMessageHandler(MESSAGES.endConnection, function (message) {
    let socketId = message.data.socketId;
    let socket = sockets[socketId].socket;
    socket.end();
});

/**
 * Start SOCKS5
 */
function startServer() {

    /**
     * Start socks server
     */
    var srv = socks.createServer(function (info, accept, deny) {

        let socketId = candy.getid();
        socket = accept(true);
        sockets[socketId] = {socket: socket, id: socketId};

        /**
         * Data from client
         */
        socket.on('data', function (data) {
            sendMessage(RELAY_ADDRESS, {
                data: /*utils.hexString2Unicode*/(data.toString('hex')),
                socketId: socketId
            }, MESSAGES.outcomeData)
        });

        socket.on('end', function () {
            sendMessage(RELAY_ADDRESS, {
                socketId: socketId
            }, MESSAGES.endConnection);
        });

        socket.on('error', function () {
            sendMessage(RELAY_ADDRESS, {
                socketId: socketId
            }, MESSAGES.endConnection);
        });

        //Send new connection beacon
        sendMessage(RELAY_ADDRESS, {
            port: info.dstPort,
            address: info.dstAddr,
            socketId: socketId
        }, MESSAGES.newConnection);

    });

    srv.listen(PROXY_PORT, PROXY_HOST, function () {
        console.log('SOCKSv5 server listening on ', PROXY_HOST, PROXY_PORT);
    });

    srv.useAuth(socks.auth.None());
    //srv.useAuth();

}


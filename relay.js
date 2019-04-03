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

//************************************
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


console.log('iZ3 Socksv5 relay');

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
candy.recieverAddress = RELAY_ADDRESS;

candy.onready = function () {
    console.log('Connected.');
    console.log('Waiting for handshakes');
};

candy.starwave.registerMessageHandler(MESSAGES.handshake, function (message) {
    //console.log('Incoming connection from', message.sender);
    sendMessage(message.sender, {msg: 'Hello'}, MESSAGES.handshakeOk);
    workWithConnection(message.sender);
});

function workWithConnection(address) {
    let client;
    candy.starwave.registerMessageHandler(MESSAGES.newConnection, function (message) {
        if(message.sender === address) {
            try {
                let port = message.data.port;
                let remoteAddress = message.data.address;
                //console.log('Outcoming connection to', remoteAddress, port);

                client = new net.Socket();
                sockets[message.data.socketId] = {socket: client, id: message.data.socketId};
                //console.log('NEW SOCKET CREATED', message.data.socketId);

                client.connect(port, remoteAddress, function () {
                    sendMessage(address, {
                        socketId: message.data.socketId
                    }, MESSAGES.socketConnected);
                    //console.log('Connected to', remoteAddress);
                });

                client.on('end', function () {
                    sendMessage(address, {
                        socketId: message.data.socketId
                    }, MESSAGES.endConnection);
                });

                client.on('error', function (err) {
                    //console.log(err);
                    sendMessage(address, {
                        socketId: message.data.socketId
                    }, MESSAGES.endConnection);
                });

                client.on('data', function (data) {
                    //console.log('INCOME DATA', data);
                    sendMessage(address, {
                        data: /*utils.hexString2Unicode*/(data.toString('hex')),
                        socketId: message.data.socketId
                    }, MESSAGES.incomeData);
                });
            } catch (e) {
                console.log(e);
            }
        }

        return false;
    });

    candy.starwave.registerMessageHandler(MESSAGES.outcomeData, function (message) {
        if(message.sender === address) {
            try {
                let payload = Buffer.from(message.data.data, 'hex');//utils.hexString2Uint8Array(utils.unicode2HexString(message.data.data));
                //console.log('OUTCOME DATA', Buffer.from(payload).toString());
                //console.log("WRITING DATA TO", message.data.socketId);
                //console.log("WRITING DATA TO", sockets[message.data.socketId].socket);
                sockets[message.data.socketId].socket.write(Buffer.from(payload));
            } catch (e) {
                console.log(e);
            }
        }

        return false;
    });

    candy.starwave.registerMessageHandler(MESSAGES.endConnection, function (message) {
        if(message.sender === address) {
            let socketId = message.data.socketId;
            let socket = sockets[socketId].socket;
            socket.end();
        }

        return false;
    });


}

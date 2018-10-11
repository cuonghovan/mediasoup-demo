'use strict';
process.title = 'mediasoup-demo-server';
const config = require('./config');
const fs = require('fs');
const cors = require('cors');
const express = require('express');
const https = require('https');
const mediasoup = require('mediasoup');
const Logger = require('./lib/Logger');
const Room = require('./lib/Room');

const app = express();

app.use(cors());

const logger = new Logger();

// Map of Room instances indexed by roomId.
const rooms = new Map();

// mediasoup server.
const mediaServer = mediasoup.Server(
	{
		numWorkers       : null, // Use as many CPUs as available.
		logLevel         : config.mediasoup.logLevel,
		logTags          : config.mediasoup.logTags,
		rtcIPv4          : config.mediasoup.rtcIPv4,
		rtcIPv6          : config.mediasoup.rtcIPv6,
		rtcAnnouncedIPv4 : config.mediasoup.rtcAnnouncedIPv4,
		rtcAnnouncedIPv6 : config.mediasoup.rtcAnnouncedIPv6,
		rtcMinPort       : config.mediasoup.rtcMinPort,
		rtcMaxPort       : config.mediasoup.rtcMaxPort
	});

// HTTPS server for the protoo WebSocket server.
const tls =
{
	cert : fs.readFileSync(config.tls.cert),
	key  : fs.readFileSync(config.tls.key)
};

const httpsServer = https.createServer(tls, app);

const socketServer = require('socket.io')(httpsServer);

httpsServer.listen(3443, '0.0.0.0', () =>
{
	logger.info('server is running on port 3443');
});

// Handle connections from clients.
socketServer.on('connection', (socket) =>
{
	// The client indicates the roomId and peerId in the URL query.
	const { roomId, peerName } = socket.handshake.query;

	if (!roomId || !peerName)
	{
		logger.warn('connection request without roomId and/or peerName');

		return;
	}

	logger.info(
		'connection request [roomId:"%s", peerName:"%s"]', roomId, peerName);

	let room;

	// If an unknown roomId, create a new Room.
	if (!rooms.has(roomId))
	{
		logger.info('creating a new Room [roomId:"%s"]', roomId);

		try
		{
			room = new Room(roomId, mediaServer);

			global.APP_ROOM = room;
		}
		catch (error)
		{
			logger.error('error creating a new Room: %s', error);

			return;
		}

		const logStatusTimer = setInterval(() =>
		{
			room.logStatus();
		}, 30000);

		rooms.set(roomId, room);

		room.on('close', () =>
		{
			rooms.delete(roomId);
			clearInterval(logStatusTimer);
		});
	}
	else
	{
		room = rooms.get(roomId);
	}

	room.handleConnection(socket, peerName);
});

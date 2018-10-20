'use strict';
process.title = 'mediasoup-demo-server';
const config = require('./config');
const fs = require('fs');
const cors = require('cors');
const express = require('express');
const https = require('https');
const mediasoup = require('mediasoup');
const bodyParser = require('body-parser');
const multer = require('multer');
const Logger = require('./lib/Logger');
const Room = require('./lib/Room');
const upload = multer({ dest: 'uploads/' });
const readline = require("readline");
const readJson = require("r-json");
const { google } = require("googleapis");

const app = express();

app.use(cors());
app.use(bodyParser.json());

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

//------------Upload  recorded videos to Youtube --------------------------------------------------------------------------
/**
 * To use OAuth2 authentication, we need access to a a CLIENT_ID, CLIENT_SECRET, AND REDIRECT_URI.  
 * To get these credentials for your application, visit https://console.cloud.google.com/apis/credentials.
 */
const CREDENTIALS = readJson(`${__dirname}/configs/oauth2.keys.json`);
const TOKENS = readJson(`${__dirname}/configs/tokens.json`);

/**
 * Create a new OAuth2 client with the configured keys.
 */
const oauth2Client = new google.auth.OAuth2(
  CREDENTIALS.web.client_id,
  CREDENTIALS.web.client_secret,
  CREDENTIALS.web.redirect_uris[0]
);

/**
 *  Set refresh token for permanent authorization
 */
 oauth2Client.setCredentials({
  refresh_token: TOKENS.refresh_token
});

/**
 * initialize the Youtube API library
 */
const youtube = google.youtube({
  version: "v3",
  auth: oauth2Client
});

/**
 * Uploading a video to youtube
 */
async function uploadVideo(fileName) {
  const fileSize = fs.statSync(fileName).size;
  const res = await youtube.videos.insert(
    {
      part: "id,snippet,status",
      notifySubscribers: false,
      requestBody: {
        snippet: {
          title: "Node.js YouTube Upload Test",
          description: "Testing YouTube upload via Google APIs Node.js Client"
        },
        status: {
          privacyStatus: "private"
        }
      },
      media: {
        body: fs.createReadStream(fileName)
      }
    },
    {
      // Use the `onUploadProgress` event from Axios to track the
      // number of bytes uploaded to this point.
      onUploadProgress: evt => {
        const progress = (evt.bytesRead / fileSize) * 100;
        readline.clearLine();
        readline.cursorTo(0);
        process.stdout.write(`${Math.round(progress)}% complete`);
      }
    }
  );
  console.log("\n\n");
  console.log(res.data);
  return res.data;
}

// uploadVideo("./video_test.webm");


// Handle request from clients
app.post('/upload', upload.single('file'), function (req, res) {
	uploadVideo(req.file.path);
	return res.end();
});

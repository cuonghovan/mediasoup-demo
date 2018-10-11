'use strict';

const EventEmitter = require('events').EventEmitter;
const Logger = require('./Logger');
const config = require('../config');

const MAX_BITRATE = config.mediasoup.maxBitrate || 1000000;
const MIN_BITRATE = Math.min(50000, MAX_BITRATE);
const BITRATE_FACTOR = 0.75;

const logger = new Logger('Room');

class Room extends EventEmitter
{
	constructor(roomId, mediaServer)
	{
		logger.info('constructor() [roomId:"%s"]', roomId);

		super();
		this.setMaxListeners(Infinity);

		// Room ID.
		this._roomId = roomId;

		// Closed flag.
		this._closed = false;

		// mediasoup Peer instance
		this._mediaPeer = null;
		
		try
		{
			// mediasoup Room instance.
			this._mediaRoom = mediaServer.Room(config.mediasoup.mediaCodecs);
		}
		catch (error)
		{
			this.close();

			throw error;
		}

		// Current max bitrate for all the participants.
		this._maxBitrate = MAX_BITRATE;
	}

	get id()
	{
		return this._roomId;
	}

	close()
	{
		logger.debug('close()');

		this._closed = true;

		// Close the mediasoup Room.
		if (this._mediaRoom)
			this._mediaRoom.close();

		// Emit 'close' event.
		this.emit('close');
	}

	logStatus()
	{
		if (!this._mediaRoom)
			return;

		logger.info(
			'logStatus() [room id:"%s", protoo peers:%s, mediasoup peers:%s]',
			this._roomId);
	}

	handleConnection(socket, peerName)
	{
		// Handle requests from client
		socket.on('mediasoup-request', (request, cb) =>
		{
			switch (request.method) 
			{
				case 'queryRoom':
					this._mediaRoom.receiveRequest(request)
						.then((response) => cb(null, response))
						.catch((error) => cb(error.toString()));
					break;
				
				case 'join':
					this._mediaRoom.receiveRequest(request)
						.then((response) =>
						{
							// Get the newly created mediasoup Peer
							this._mediaPeer = this._mediaRoom.getPeerByName(peerName);

							this._handleMediaPeer(this._mediaPeer);

							// Send response back
							cb(null, response);
						})
						.catch((error) => cb(error.toString()));
					break;

				default:
					if (this._mediaPeer)
					{
						this._mediaPeer.receiveRequest(request)
							.then((response) => cb(null, response))
							.catch((error) => cb(error.toString()));
					}
			}
		});

		// Handle notifications from client
		socket.on('mediasoup-notification', (notification) =>
		{
			logger.debug('Got notification from client peer', notification);
	
			// NOTE: mediasoup-client just sends notifications with target 'peer'
			if (!this._mediaPeer) 
			{
				logger.error('Cannot handle mediaSoup notification, no mediaSoup Peer');
				
				return;
			}
	
			this._mediaPeer.receiveNotification(notification);
		});

		// Invokes when connection lost on a client side
		socket.on('disconnect', () => 
		{
			if (this._mediaPeer && !this._mediaPeer.closed)
				this._mediaPeer.close();

			// If this is the latest peer in the room, close the room.
			// However wait a bit (for reconnections).
			setTimeout(() =>
			{
				if (this._mediaRoom && this._mediaRoom.closed)
					return;

				if (this._mediaRoom.peers.length === 0)
				{
					logger.info(
						'last peer in the room left, closing the room [roomId:"%s"]',
						this._roomId);

					this.close();
				}
			}, 5000);
		});
	}

	_handleMediaPeer(mediaPeer)
	{
		mediaPeer.on('newtransport', (transport) =>
		{
			logger.info(
				'mediaPeer "newtransport" event [id:%s, direction:%s]',
				transport.id, transport.direction);

			// Update peers max sending  bitrate.
			if (transport.direction === 'send')
			{
				this._updateMaxBitrate();

				transport.on('close', () =>
				{
					this._updateMaxBitrate();
				});
			}

			this._handleMediaTransport(transport);
		});

		mediaPeer.on('newproducer', (producer) =>
		{
			logger.info('mediaPeer "newproducer" event [id:%s]', producer.id);

			this._handleMediaProducer(producer);
		});

		mediaPeer.on('newconsumer', (consumer) =>
		{
			logger.info('mediaPeer "newconsumer" event [id:%s]', consumer.id);

			this._handleMediaConsumer(consumer);
		});

		// Also handle already existing Consumers.
		for (const consumer of mediaPeer.consumers)
		{
			logger.info('mediaPeer existing "consumer" [id:%s]', consumer.id);

			this._handleMediaConsumer(consumer);
		}
	}

	_handleMediaTransport(transport)
	{
		transport.on('close', (originator) =>
		{
			logger.info(
				'Transport "close" event [originator:%s]', originator);
		});
	}

	_handleMediaProducer(producer)
	{
		producer.on('close', (originator) =>
		{
			logger.info(
				'Producer "close" event [originator:%s]', originator);
		});

		producer.on('pause', (originator) =>
		{
			logger.info(
				'Producer "pause" event [originator:%s]', originator);
		});

		producer.on('resume', (originator) =>
		{
			logger.info(
				'Producer "resume" event [originator:%s]', originator);
		});
	}

	_handleMediaConsumer(consumer)
	{
		consumer.on('close', (originator) =>
		{
			logger.info(
				'Consumer "close" event [originator:%s]', originator);
		});

		consumer.on('pause', (originator) =>
		{
			logger.info(
				'Consumer "pause" event [originator:%s]', originator);
		});

		consumer.on('resume', (originator) =>
		{
			logger.info(
				'Consumer "resume" event [originator:%s]', originator);
		});

		consumer.on('effectiveprofilechange', (profile) =>
		{
			logger.info(
				'Consumer "effectiveprofilechange" event [profile:%s]', profile);
		});
	}

	_updateMaxBitrate()
	{
		if (this._mediaRoom.closed)
			return;

		const numPeers = this._mediaRoom.peers.length;
		const previousMaxBitrate = this._maxBitrate;
		let newMaxBitrate;

		if (numPeers <= 2)
		{
			newMaxBitrate = MAX_BITRATE;
		}
		else
		{
			newMaxBitrate = Math.round(MAX_BITRATE / ((numPeers - 1) * BITRATE_FACTOR));

			if (newMaxBitrate < MIN_BITRATE)
				newMaxBitrate = MIN_BITRATE;
		}

		this._maxBitrate = newMaxBitrate;

		for (const peer of this._mediaRoom.peers)
		{
			for (const transport of peer.transports)
			{
				if (transport.direction === 'send')
				{
					transport.setMaxBitrate(newMaxBitrate)
						.catch((error) =>
						{
							logger.error('transport.setMaxBitrate() failed: %s', String(error));
						});
				}
			}
		}

		logger.info(
			'_updateMaxBitrate() [num peers:%s, before:%skbps, now:%skbps]',
			numPeers,
			Math.round(previousMaxBitrate / 1000),
			Math.round(newMaxBitrate / 1000));
	}
}

module.exports = Room;

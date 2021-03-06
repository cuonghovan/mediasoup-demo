import * as mediasoupClient from 'mediasoup-client';
import Logger from './Logger';
import * as cookiesManager from './cookiesManager';
import * as stateActions from './redux/stateActions';
import io from 'socket.io-client';

const logger = new Logger('RoomClient');

const serverUrl = 'https://localhost:3443';

const ROOM_OPTIONS =
{
	requestTimeout   : 10000,
	transportOptions :
	{
		tcp : false
	}
};

const VIDEO_CONSTRAINS =
{
	qvga : { width: { ideal: 320 }, height: { ideal: 240 } },
	vga  : { width: { ideal: 640 }, height: { ideal: 480 } },
	hd   : { width: { ideal: 1280 }, height: { ideal: 720 } }
};

export default class RoomClient
{
	constructor(
		{ roomId, peerName, useSimulcast, produce, dispatch, getState })
	{
		this._socket = io.connect(serverUrl, 
			{ secure: true, reconnect: true, rejectUnauthorized: false, query: { roomId, peerName } });

		// Closed flag.
		this._closed = false;

		// Whether we should produce.
		this._produce = produce;

		// Whether simulcast should be used.
		this._useSimulcast = useSimulcast;

		// Redux store dispatch function.
		this._dispatch = dispatch;

		// Redux store getState function.
		this._getState = getState;

		// My peer name.
		this._peerName = peerName;

		// mediasoup-client Room instance.
		this._room = new mediasoupClient.Room(ROOM_OPTIONS);

		// Transport for sending.
		this._sendTransport = null;

		// Transport for receiving.
		this._recvTransport = null;

		// Local mic mediasoup Producer.
		this._micProducer = null;

		// Local webcam mediasoup Producer.
		this._webcamProducer = null;

		// Map of webcam MediaDeviceInfos indexed by deviceId.
		// @type {Map<String, MediaDeviceInfos>}
		this._webcams = new Map();

		// Local Webcam. Object with:
		// - {MediaDeviceInfo} [device]
		// - {String} [resolution] - 'qvga' / 'vga' / 'hd'.
		this._webcam =
		{
			device     : null,
			resolution : 'hd'
		};

		this._joinRoom();
	}

	close()
	{
		if (this._closed)
			return;

		this._closed = true;

		logger.debug('close()');

		// Leave the mediasoup Room.
		this._room.leave();

		// Close protoo Peer (wait a bit so mediasoup-client can send
		// the 'leaveRoom' notification).
		setTimeout(() => this._socket.close(), 250);
	}

	muteMic()
	{
		logger.debug('muteMic()');

		this._micProducer.pause();
	}

	unmuteMic()
	{
		logger.debug('unmuteMic()');

		this._micProducer.resume();
	}

	enableWebcam()
	{
		logger.debug('enableWebcam()');

		// Store in cookie.
		cookiesManager.setDevices({ webcamEnabled: true });

		return Promise.resolve()
			.then(() =>
			{
				return this._updateWebcams();
			})
			.then(() =>
			{
				return this._setWebcamProducer();
			})
			.catch((error) =>
			{
				logger.error('enableWebcam() | failed: %o', error);
			});
	}

	disableWebcam()
	{
		logger.debug('disableWebcam()');

		// Store in cookie.
		cookiesManager.setDevices({ webcamEnabled: false });

		return Promise.resolve()
			.then(() =>
			{
				this._webcamProducer.close();
			})
			.catch((error) =>
			{
				logger.error('disableWebcam() | failed: %o', error);
			});
	}

	_joinRoom()
	{
		logger.debug('_joinRoom()');

		// Handle notifications from server
		this._socket.on('mediasoup-notification', (notification) => 
		{
			logger.debug('New notification came from server:', notification);
			this._room.receiveNotification(notification);
		});

		// NOTE: We allow rejoining (room.join()) the same mediasoup Room when Protoo
		// WebSocket re-connects, so we must clean existing event listeners. Otherwise
		// they will be called twice after the reconnection.
		this._room.removeAllListeners();

		this._room.on('close', (originator, appData) =>
		{
			if (originator === 'remote')
			{
				logger.warn('mediasoup Peer/Room remotely closed [appData:%o]', appData);

				return;
			}
		});

		// Send requests to server
		this._room.on('request', (request, callback, errback) =>
		{
			logger.debug(
				'sending mediasoup request [method:%s]:%o', request.method, request);

			this._socket.emit('mediasoup-request', request, (err, response) => 
			{
				if (!err) 
				{
					// Success response, so pass the mediasoup response to the local Room.
					callback(response);
				} 
				else 
				{
					errback(err);
				}
			});
		});

		// Send notifications to sever
		this._room.on('notify', (notification) =>
		{
			logger.debug(
				'sending mediasoup notification [method:%s]:%o',
				notification.method, notification);

			this._socket.emit('mediasoup-notification', notification);
		});

		this._room.on('newpeer', (peer) =>
		{
			logger.debug(
				'room "newpeer" event [name:"%s", peer:%o]', peer.name, peer);

			this._handlePeer(peer);
		});

		this._room.join(this._peerName)
			.then(() =>
			{
				// Create Transport for receiving.
				this._recvTransport =
				this._room.createTransport('recv', { media: 'RECV' });
				
				this._recvTransport.on('close', (originator) =>
				{
					logger.debug(
						'receiving Transport "close" event [originator:%s]', originator);
				});
					
				// Don't produce if explicitely requested to not to do it.
				if (!this._produce)
					return;
					
				// Create Transport for sending.
				this._sendTransport =
					this._room.createTransport('send', { media: 'SEND_MIC_WEBCAM' });

				this._sendTransport.on('close', (originator) =>
				{
					logger.debug(
						'Transport "close" event [originator:%s]', originator);
				});
			})
			.then(() =>
			{
				// Don't produce if explicitely requested to not to do it.
				if (!this._produce)
					return;
				
				// NOTE: Don't depend on this Promise to continue (so we don't do return).
				Promise.resolve()
					// Add our mic.
					.then(() =>
					{
						if (!this._room.canSend('audio'))
							return;

						this._setMicProducer()
							.catch(() => {});
					})
					// Add our webcam (unless the cookie says no).
					.then(() =>
					{
						if (!this._room.canSend('video'))
							return;

						const devicesCookie = cookiesManager.getDevices();

						if (!devicesCookie || devicesCookie.webcamEnabled)
							this.enableWebcam();
					});
			})
			.then(() =>
			{
				const peers = this._room.peers;

				for (const peer of peers)
				{
					this._handlePeer(peer, { notify: false });
				}
			})
			.catch((error) =>
			{
				logger.error('_joinRoom() failed:%o', error);

				this.close();
			});
	}

	_setMicProducer()
	{
		if (!this._room.canSend('audio'))
		{
			return Promise.reject(
				new Error('cannot send audio'));
		}

		if (this._micProducer)
		{
			return Promise.reject(
				new Error('mic Producer already exists'));
		}

		let producer;

		return Promise.resolve()
			.then(() =>
			{
				logger.debug('_setMicProducer() | calling getUserMedia()');

				return navigator.mediaDevices.getUserMedia({ audio: true });
			})
			.then((stream) =>
			{
				const track = stream.getAudioTracks()[0];

				producer = this._room.createProducer(track, null, { source: 'mic' });

				// No need to keep original track.
				track.stop();

				// Send it.
				return producer.send(this._sendTransport);
			})
			.then(() =>
			{
				this._micProducer = producer;

				this._dispatch(stateActions.addProducer(
					{
						id             : producer.id,
						source         : 'mic',
						locallyPaused  : producer.locallyPaused,
						remotelyPaused : producer.remotelyPaused,
						track          : producer.track,
						codec          : producer.rtpParameters.codecs[0].name
					}));

				producer.on('close', (originator) =>
				{
					logger.debug(
						'mic Producer "close" event [originator:%s]', originator);

					this._micProducer = null;
					this._dispatch(stateActions.removeProducer(producer.id));
				});

				producer.on('pause', (originator) =>
				{
					logger.debug(
						'mic Producer "pause" event [originator:%s]', originator);

					this._dispatch(stateActions.setProducerPaused(producer.id, originator));
				});

				producer.on('resume', (originator) =>
				{
					logger.debug(
						'mic Producer "resume" event [originator:%s]', originator);

					this._dispatch(stateActions.setProducerResumed(producer.id, originator));
				});

				producer.on('handled', () =>
				{
					logger.debug('mic Producer "handled" event');
				});

				producer.on('unhandled', () =>
				{
					logger.debug('mic Producer "unhandled" event');
				});
			})
			.then(() =>
			{
				logger.debug('_setMicProducer() succeeded');
			})
			.catch((error) =>
			{
				logger.error('_setMicProducer() failed:%o', error);

				if (producer)
					producer.close();

				throw error;
			});
	}

	_setWebcamProducer()
	{
		if (!this._room.canSend('video'))
		{
			return Promise.reject(
				new Error('cannot send video'));
		}

		if (this._webcamProducer)
		{
			return Promise.reject(
				new Error('webcam Producer already exists'));
		}

		let producer;

		return Promise.resolve()
			.then(() =>
			{
				const { device, resolution } = this._webcam;

				if (!device)
					throw new Error('no webcam devices');

				logger.debug('_setWebcamProducer() | calling getUserMedia()');

				return navigator.mediaDevices.getUserMedia(
					{
						video :
						{
							deviceId : { exact: device.deviceId },
							...VIDEO_CONSTRAINS[resolution]
						}
					});
			})
			.then((stream) =>
			{
				const track = stream.getVideoTracks()[0];

				producer = this._room.createProducer(
					track, { simulcast: this._useSimulcast }, { source: 'webcam' });

				// No need to keep original track.
				track.stop();

				// Send it.
				return producer.send(this._sendTransport);
			})
			.then(() =>
			{
				this._webcamProducer = producer;

				const { device } = this._webcam;

				this._dispatch(stateActions.addProducer(
					{
						id             : producer.id,
						source         : 'webcam',
						deviceLabel    : device.label,
						type           : this._getWebcamType(device),
						locallyPaused  : producer.locallyPaused,
						remotelyPaused : producer.remotelyPaused,
						track          : producer.track,
						codec          : producer.rtpParameters.codecs[0].name
					}));

				producer.on('close', (originator) =>
				{
					logger.debug(
						'webcam Producer "close" event [originator:%s]', originator);

					this._webcamProducer = null;
					this._dispatch(stateActions.removeProducer(producer.id));
				});

				producer.on('pause', (originator) =>
				{
					logger.debug(
						'webcam Producer "pause" event [originator:%s]', originator);

					this._dispatch(stateActions.setProducerPaused(producer.id, originator));
				});

				producer.on('resume', (originator) =>
				{
					logger.debug(
						'webcam Producer "resume" event [originator:%s]', originator);

					this._dispatch(stateActions.setProducerResumed(producer.id, originator));
				});

				producer.on('handled', () =>
				{
					logger.debug('webcam Producer "handled" event');
				});

				producer.on('unhandled', () =>
				{
					logger.debug('webcam Producer "unhandled" event');
				});
			})
			.then(() =>
			{
				logger.debug('_setWebcamProducer() succeeded');
			})
			.catch((error) =>
			{
				logger.error('_setWebcamProducer() failed:%o', error);

				if (producer)
					producer.close();

				throw error;
			});
	}

	_updateWebcams()
	{
		logger.debug('_updateWebcams()');

		// Reset the list.
		this._webcams = new Map();

		return Promise.resolve()
			.then(() =>
			{
				logger.debug('_updateWebcams() | calling enumerateDevices()');

				return navigator.mediaDevices.enumerateDevices();
			})
			.then((devices) =>
			{
				for (const device of devices)
				{
					if (device.kind !== 'videoinput')
						continue;

					this._webcams.set(device.deviceId, device);
				}
			})
			.then(() =>
			{
				const array = Array.from(this._webcams.values());
				const len = array.length;
				const currentWebcamId =
					this._webcam.device ? this._webcam.device.deviceId : undefined;

				logger.debug('_updateWebcams() [webcams:%o]', array);

				if (len === 0)
					this._webcam.device = null;
				else if (!this._webcams.has(currentWebcamId))
					this._webcam.device = array[0];
			});
	}

	_getWebcamType(device)
	{
		if (/(back|rear)/i.test(device.label))
		{
			logger.debug('_getWebcamType() | it seems to be a back camera');

			return 'back';
		}
		else
		{
			logger.debug('_getWebcamType() | it seems to be a front camera');

			return 'front';
		}
	}

	_handlePeer(peer)
	{
		this._dispatch(stateActions.addPeer(
			{
				name        : peer.name,
				consumers   : []
			}));

		for (const consumer of peer.consumers)
		{
			this._handleConsumer(consumer);
		}

		peer.on('close', (originator) =>
		{
			logger.debug(
				'peer "close" event [name:"%s", originator:%s]',
				peer.name, originator);

			this._dispatch(stateActions.removePeer(peer.name));
		});

		peer.on('newconsumer', (consumer) =>
		{
			logger.debug(
				'peer "newconsumer" event [name:"%s", id:%s, consumer:%o]',
				peer.name, consumer.id, consumer);

			this._handleConsumer(consumer);
		});
	}

	_handleConsumer(consumer)
	{
		const codec = consumer.rtpParameters.codecs[0];

		this._dispatch(stateActions.addConsumer(
			{
				id             : consumer.id,
				peerName       : consumer.peer.name,
				source         : consumer.appData.source,
				supported      : consumer.supported,
				locallyPaused  : consumer.locallyPaused,
				remotelyPaused : consumer.remotelyPaused,
				track          : null,
				codec          : codec ? codec.name : null
			},
			consumer.peer.name));

		consumer.on('close', (originator) =>
		{
			logger.debug(
				'consumer "close" event [id:%s, originator:%s, consumer:%o]',
				consumer.id, originator, consumer);

			this._dispatch(stateActions.removeConsumer(
				consumer.id, consumer.peer.name));
		});

		consumer.on('pause', (originator) =>
		{
			logger.debug(
				'consumer "pause" event [id:%s, originator:%s, consumer:%o]',
				consumer.id, originator, consumer);

			this._dispatch(stateActions.setConsumerPaused(consumer.id, originator));
		});

		consumer.on('resume', (originator) =>
		{
			logger.debug(
				'consumer "resume" event [id:%s, originator:%s, consumer:%o]',
				consumer.id, originator, consumer);

			this._dispatch(stateActions.setConsumerResumed(consumer.id, originator));
		});

		consumer.on('effectiveprofilechange', (profile) =>
		{
			logger.debug(
				'consumer "effectiveprofilechange" event [id:%s, consumer:%o, profile:%s]',
				consumer.id, consumer, profile);

			this._dispatch(stateActions.setConsumerEffectiveProfile(consumer.id, profile));
		});

		// Receive the consumer (if we can).
		if (consumer.supported)
		{
			consumer.receive(this._recvTransport)
				.then((track) =>
				{
					this._dispatch(stateActions.setConsumerTrack(consumer.id, track));
				})
				.catch((error) =>
				{
					logger.error(
						'unexpected error while receiving a new Consumer:%o', error);
				});
		}
	}
}

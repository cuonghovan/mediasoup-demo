import React from 'react';
import { connect } from 'react-redux';
import * as appPropTypes from './appPropTypes';
import Peer from './Peer';
import Me from './Me';
import axios from 'axios';

class Room extends React.Component 
{
	constructor(props) 
	{
		super(props);
		
		this.state = {
			recording : false
		};

		this.multiStreamRecorder= null;
		this.getDownloadlink = this.getDownloadlink.bind(this);
		this.handleStartRecording = this.handleStartRecording.bind(this);
		this.handleStopRecording = this.handleStopRecording.bind(this);
	}

	componentDidUpdate() 
	{
		if (this.props.meMicProducer && this.props.peerMicConsumer)
		{
			this.getDownloadlink();
		}
	}

	getDownloadlink() 
	{
		const { meMicProducer, meWebcamProducer,
			peerMicConsumer, peerWebcamConsumer } = this.props;
		const audioProducerTrack = meMicProducer ? meMicProducer.track : null;
		const videoProducerTrack = meWebcamProducer ? meWebcamProducer.track : null;
		const audioConsumerTrack = peerMicConsumer ? peerMicConsumer.track : null;
		const videoConsumerTrack = peerWebcamConsumer ? peerWebcamConsumer.track : null;

		const producerStream = new MediaStream;
		const consumerStream = new MediaStream;

		if (audioProducerTrack || videoProducerTrack)
		{
			if (audioProducerTrack)
				producerStream.addTrack(audioProducerTrack);

			if (videoProducerTrack)
				producerStream.addTrack(videoProducerTrack);
		}

		if (audioConsumerTrack || videoConsumerTrack)
		{
			if (audioConsumerTrack)
				consumerStream.addTrack(audioConsumerTrack);

			if (videoConsumerTrack)
				consumerStream.addTrack(videoConsumerTrack);
		}

		this.multiStreamRecorder = new MultiStreamRecorder([ producerStream, consumerStream ]);
		
		this.multiStreamRecorder.ondataavailable = function(blob) 
		{
			console.log('blob', blob)
			// POST/PUT "Blob" using FormData/XHR2
			// const blobURL = URL.createObjectURL(blob);

			// document.write(`<a href='${blobURL}'>${blobURL}</a>`);

			// Upload to server
			var formData = new FormData();
			formData.append('fname', 'ABCDEF.webm');
			formData.append('file', blob);

			axios.post('https://192.168.1.110:3443/upload', formData)
				.then(res => console.log(res))
				.catch(err => console.log(err));
		};
	}

	handleStartRecording() 
	{
		console.log('start recording....');
		this.multiStreamRecorder.start(99999999999);
	}

	handleStopRecording() 
	{
		console.log('stop recording....');
		this.multiStreamRecorder.stop();
	}

	render() 
	{
		const { peer, meMicProducer, meWebcamProducer, 
			peerMicConsumer, peerWebcamConsumer } = this.props;

		return (
			<div data-component='Room'>
				<div data-component='Peers'>
					<Me micProducer={meMicProducer} webcamProducer={meWebcamProducer} />
					{peer ? <Peer peer={peer} micConsumer={peerMicConsumer} webcamConsumer={peerWebcamConsumer} /> : null}
				</div>
				<button onClick={this.handleStartRecording}>Start recording</button>
				<button onClick={this.handleStopRecording}>Stop recording</button>
			</div>
		);
	}
}

Room.propTypes =
{
	// peer             	: appPropTypes.Peer,
	meWebcamProducer  : appPropTypes.Producer,
	meMicProducer     : appPropTypes.Producer
};

const mapStateToProps = (state) =>
{
	// Get producers
	const meProducersArray = Object.values(state.producers);
	const meMicProducer =
	meProducersArray.find((producer) => producer.source === 'mic');
	const meWebcamProducer =
	meProducersArray.find((producer) => producer.source === 'webcam');

	// Get peer consumers
	// TODO: This is not OK since it's creating a new array every time, so triggering a
	// component rendering.
	const peersArray = Object.values(state.peers);
	let activePeer = null;
	let peerMicConsumer = null;
	let peerWebcamConsumer = null;

	activePeer = peersArray.find((peer) => 
		peer.consumers && peer.consumers.length > 0);

	if (activePeer) 
	{
		const consumersArray = activePeer.consumers
			.map((consumerId) => state.consumers[consumerId]);

		peerMicConsumer =
		consumersArray.find((consumer) => consumer.source === 'mic');
		peerWebcamConsumer =
		consumersArray.find((consumer) => consumer.source === 'webcam');
	}

	return {
		peer          : activePeer,
		meMicProducer,
		meWebcamProducer,
		peerMicConsumer,
		peerWebcamConsumer
	};
};

const RoomContainer = connect(mapStateToProps)(Room);

export default RoomContainer;

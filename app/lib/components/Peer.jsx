import React from 'react';
import { connect } from 'react-redux';
import * as appPropTypes from './appPropTypes';
import PeerView from './PeerView';

const Peer = (props) =>
{
	const {
		micConsumer,
		webcamConsumer
	} = props;
	
	// New peer is not a producer
	if (!micConsumer && !webcamConsumer) return null;

	const micEnabled = (
		Boolean(micConsumer) &&
		!micConsumer.locallyPaused &&
		!micConsumer.remotelyPaused
	);

	const videoVisible = (
		Boolean(webcamConsumer) &&
		!webcamConsumer.locallyPaused &&
		!webcamConsumer.remotelyPaused
	);

	let videoProfile;

	if (webcamConsumer)
		videoProfile = webcamConsumer.profile;

	return (
		<div data-component='Peer'>
			<div className='indicators'>
				{!micEnabled ?
					<div className='icon mic-off' />
					:null
				}
				{!videoVisible ?
					<div className='icon webcam-off' />
					:null
				}
			</div>

			{videoVisible && !webcamConsumer.supported ?
				<div className='incompatible-video'>
					<p>incompatible video</p>
				</div>
				:null
			}

			<PeerView
				audioTrack={micConsumer ? micConsumer.track : null}
				videoTrack={webcamConsumer ? webcamConsumer.track : null}
				videoVisible={videoVisible}
				videoProfile={videoProfile}
				audioCodec={micConsumer ? micConsumer.codec : null}
				videoCodec={webcamConsumer ? webcamConsumer.codec : null}
			/>
		</div>
	);
};

Peer.propTypes =
{
	micConsumer    : appPropTypes.Consumer,
	webcamConsumer : appPropTypes.Consumer
};

const mapStateToProps = (state, { peer }) =>
{
	const consumersArray = peer.consumers
		.map((consumerId) => state.consumers[consumerId]);
	const micConsumer =
		consumersArray.find((consumer) => consumer.source === 'mic');
	const webcamConsumer =
		consumersArray.find((consumer) => consumer.source === 'webcam');

	return {
		micConsumer,
		webcamConsumer
	};
};

const PeerContainer = connect(mapStateToProps)(Peer);

export default PeerContainer;

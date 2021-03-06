import React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import * as appPropTypes from './appPropTypes';
import * as requestActions from '../redux/requestActions';
import PeerView from './PeerView';

class Me extends React.Component
{
	constructor(props)
	{
		super(props);

		this._rootNode = null;
	}

	render()
	{
		const {
			micProducer,
			webcamProducer,
			onMuteMic,
			onUnmuteMic,
			onEnableWebcam,
			onDisableWebcam,
			leaveRoom
		} = this.props;

		// Not a producer
		if (!micProducer && !webcamProducer) return null;

		const micState = (micProducer && !micProducer.locallyPaused && !micProducer.remotelyPaused) ? 'on' : 'off';
		const webcamState = webcamProducer ? 'on' : 'off';
		const videoVisible = (
			Boolean(webcamProducer) &&
			!webcamProducer.locallyPaused &&
			!webcamProducer.remotelyPaused
		);

		return (
			<div
				data-component='Peer'
				ref={(node) => (this._rootNode = node)}
			>
				<div className='controls'>
					<div
						className={classnames('button', 'mic', micState)}
						onClick={() =>
						{
							micState === 'on' ? onMuteMic() : onUnmuteMic();
						}}
					/>

					<div
						className={classnames('button', 'webcam', webcamState)}
						onClick={() =>
						{
							webcamState === 'on' ? onDisableWebcam() : onEnableWebcam();
						}}
					/>

					<div
						className='button'
						onClick={() => leaveRoom()}
					/>
				</div>

				<PeerView
					isMe
					audioTrack={micProducer ? micProducer.track : null}
					videoTrack={webcamProducer ? webcamProducer.track : null}
					videoVisible={videoVisible}
				/>
			</div>
		);
	}
}

Me.propTypes =
{
	micProducer         : appPropTypes.Producer,
	webcamProducer      : appPropTypes.Producer,
	onMuteMic           : PropTypes.func.isRequired,
	onUnmuteMic         : PropTypes.func.isRequired,
	onEnableWebcam      : PropTypes.func.isRequired,
	onDisableWebcam     : PropTypes.func.isRequired,
	leaveRoom						: PropTypes.func.isRequired
};

const mapStateToProps = (state) =>
{
	const producersArray = Object.values(state.producers);
	const micProducer =
		producersArray.find((producer) => producer.source === 'mic');
	const webcamProducer =
		producersArray.find((producer) => producer.source === 'webcam');

	return {
		micProducer    : micProducer,
		webcamProducer : webcamProducer
	};
};

const mapDispatchToProps = (dispatch) =>
{
	return {
		onMuteMic       : () => dispatch(requestActions.muteMic()),
		onUnmuteMic     : () => dispatch(requestActions.unmuteMic()),
		onEnableWebcam  : () => dispatch(requestActions.enableWebcam()),
		onDisableWebcam : () => dispatch(requestActions.disableWebcam()),
		leaveRoom				: () => dispatch(requestActions.leaveRoom())
	};
};

const MeContainer = connect(
	mapStateToProps,
	mapDispatchToProps
)(Me);

export default MeContainer;

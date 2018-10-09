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
			connected,
			me,
			micProducer,
			webcamProducer,
			onMuteMic,
			onUnmuteMic,
			onEnableWebcam,
			onDisableWebcam
		} = this.props;

		// Not a producer
		if (!micProducer && !webcamProducer) return null;

		let micState;

		if (!me.canSendMic)
			micState = 'unsupported';
		else if (!micProducer)
			micState = 'unsupported';
		else if (!micProducer.locallyPaused && !micProducer.remotelyPaused)
			micState = 'on';
		else
			micState = 'off';

		let webcamState;

		if (!me.canSendWebcam)
			webcamState = 'unsupported';
		else if (webcamProducer)
			webcamState = 'on';
		else
			webcamState = 'off';

		const videoVisible = (
			Boolean(webcamProducer) &&
			!webcamProducer.locallyPaused &&
			!webcamProducer.remotelyPaused
		);

		return (
			<div
				className='me'
				data-component='Peer'
				ref={(node) => (this._rootNode = node)}
			>
				{connected ?
					<div className='controls'>
						<div
							className={classnames('button', 'mic', micState)}
							onClick={() =>
							{
								micState === 'on' ? onMuteMic() : onUnmuteMic();
							}}
						/>

						<div
							className={classnames('button', 'webcam', webcamState, {
								disabled : me.webcamInProgress
							})}
							onClick={() =>
							{
								webcamState === 'on' ? onDisableWebcam() : onEnableWebcam();
							}}
						/>
					</div>
					:null
				}

				<PeerView
					isMe
					peer={me}
					audioTrack={micProducer ? micProducer.track : null}
					videoTrack={webcamProducer ? webcamProducer.track : null}
					videoVisible={videoVisible}
					audioCodec={micProducer ? micProducer.codec : null}
					videoCodec={webcamProducer ? webcamProducer.codec : null}
				/>
			</div>
		);
	}
}

Me.propTypes =
{
	connected           : PropTypes.bool.isRequired,
	me                  : appPropTypes.Me.isRequired,
	micProducer         : appPropTypes.Producer,
	webcamProducer      : appPropTypes.Producer,
	onMuteMic           : PropTypes.func.isRequired,
	onUnmuteMic         : PropTypes.func.isRequired,
	onEnableWebcam      : PropTypes.func.isRequired,
	onDisableWebcam     : PropTypes.func.isRequired
};

const mapStateToProps = (state) =>
{
	const producersArray = Object.values(state.producers);
	const micProducer =
		producersArray.find((producer) => producer.source === 'mic');
	const webcamProducer =
		producersArray.find((producer) => producer.source === 'webcam');

	return {
		connected      : state.room.state === 'connected',
		me             : state.me,
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
	};
};

const MeContainer = connect(
	mapStateToProps,
	mapDispatchToProps
)(Me);

export default MeContainer;

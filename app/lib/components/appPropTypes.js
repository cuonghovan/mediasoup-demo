import PropTypes from 'prop-types';

export const Room = PropTypes.shape(
	{
		state : PropTypes.oneOf(
			[ 'new', 'connecting', 'connected', 'closed' ]).isRequired
	});

export const Me = PropTypes.shape(
	{
		name                 : PropTypes.string.isRequired,
		canChangeWebcam      : PropTypes.bool.isRequired,
		webcamInProgress     : PropTypes.bool.isRequired
	});

export const Producer = PropTypes.shape(
	{
		id             : PropTypes.number.isRequired,
		source         : PropTypes.oneOf([ 'mic', 'webcam' ]).isRequired,
		deviceLabel    : PropTypes.string,
		type           : PropTypes.oneOf([ 'front', 'back' ]),
		locallyPaused  : PropTypes.bool.isRequired,
		remotelyPaused : PropTypes.bool.isRequired,
		track          : PropTypes.any,
		codec          : PropTypes.string.isRequired
	});

export const Peer = PropTypes.shape(
	{
		name        : PropTypes.string.isRequired,
		consumers   : PropTypes.arrayOf(PropTypes.number).isRequired
	});

export const Consumer = PropTypes.shape(
	{
		id             : PropTypes.number.isRequired,
		peerName       : PropTypes.string.isRequired,
		source         : PropTypes.oneOf([ 'mic', 'webcam' ]).isRequired,
		supported      : PropTypes.bool.isRequired,
		locallyPaused  : PropTypes.bool.isRequired,
		remotelyPaused : PropTypes.bool.isRequired,
		profile        : PropTypes.oneOf([ 'none', 'default', 'low', 'medium', 'high' ]),
		track          : PropTypes.any,
		codec          : PropTypes.string
	});

export const Notification = PropTypes.shape(
	{
		id      : PropTypes.string.isRequired,
		type    : PropTypes.oneOf([ 'info', 'error' ]).isRequired,
		timeout : PropTypes.number
	});

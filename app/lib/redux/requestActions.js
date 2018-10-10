export const joinRoom = (
	{ roomId, peerName, useSimulcast, produce }) =>
{
	return {
		type    : 'JOIN_ROOM',
		payload : { roomId, peerName, useSimulcast, produce }
	};
};

export const leaveRoom = () =>
{
	return {
		type : 'LEAVE_ROOM'
	};
};

export const muteMic = () =>
{
	return {
		type : 'MUTE_MIC'
	};
};

export const unmuteMic = () =>
{
	return {
		type : 'UNMUTE_MIC'
	};
};

export const enableWebcam = () =>
{
	return {
		type : 'ENABLE_WEBCAM'
	};
};

export const disableWebcam = () =>
{
	return {
		type : 'DISABLE_WEBCAM'
	};
};

const initialState =
{
	name                 : null,
	canChangeWebcam      : false,
	webcamInProgress     : false
};

const me = (state = initialState, action) =>
{
	switch (action.type)
	{
		case 'SET_ME':
		{
			const { peerName } = action.payload;

			return { ...state, name: peerName };
		}

		case 'SET_CAN_CHANGE_WEBCAM':
		{
			const canChangeWebcam = action.payload;

			return { ...state, canChangeWebcam };
		}

		case 'SET_WEBCAM_IN_PROGRESS':
		{
			const { flag } = action.payload;

			return { ...state, webcamInProgress: flag };
		}

		default:
			return state;
	}
};

export default me;

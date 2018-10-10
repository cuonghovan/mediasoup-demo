import RoomClient from '../RoomClient';

export default ({ dispatch, getState }) => (next) =>
{
	let client;

	return (action) =>
	{
		switch (action.type)
		{
			case 'JOIN_ROOM':
			{
				const {
					roomId,
					peerName,
					useSimulcast,
					produce
				} = action.payload;

				client = new RoomClient(
					{
						roomId,
						peerName,
						useSimulcast,
						produce,
						dispatch,
						getState
					});

				// TODO: TMP
				global.CLIENT = client;

				break;
			}

			case 'LEAVE_ROOM':
			{
				client.close();

				break;
			}

			case 'MUTE_MIC':
			{
				client.muteMic();

				break;
			}

			case 'UNMUTE_MIC':
			{
				client.unmuteMic();

				break;
			}

			case 'ENABLE_WEBCAM':
			{
				client.enableWebcam();

				break;
			}

			case 'DISABLE_WEBCAM':
			{
				client.disableWebcam();

				break;
			}
		}

		return next(action);
	};
};

const initialState =
{
	state             : 'new'
};

const room = (state = initialState, action) =>
{
	switch (action.type)
	{
		case 'SET_ROOM_STATE':
		{
			const roomState = action.payload.state;

			if (roomState == 'connected')
				return { ...state, state: roomState };
			else
				return { ...state, state: roomState };
		}

		default:
			return state;
	}
};

export default room;

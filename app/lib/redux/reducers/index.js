import { combineReducers } from 'redux';
import producers from './producers';
import peers from './peers';
import consumers from './consumers';
import notifications from './notifications';

const reducers = combineReducers(
	{
		producers,
		peers,
		consumers,
		notifications
	});

export default reducers;

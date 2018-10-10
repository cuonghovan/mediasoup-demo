import { combineReducers } from 'redux';
import room from './room';
import producers from './producers';
import peers from './peers';
import consumers from './consumers';
import notifications from './notifications';

const reducers = combineReducers(
	{
		room,
		producers,
		peers,
		consumers,
		notifications
	});

export default reducers;

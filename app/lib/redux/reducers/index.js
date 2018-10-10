import { combineReducers } from 'redux';
import producers from './producers';
import peers from './peers';
import consumers from './consumers';

const reducers = combineReducers(
	{
		producers,
		peers,
		consumers
	});

export default reducers;

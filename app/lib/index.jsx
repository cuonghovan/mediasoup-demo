import domready from 'domready';
import UrlParse from 'url-parse';
import React from 'react';
import { render } from 'react-dom';
import { Provider } from 'react-redux';
import {
	applyMiddleware as applyReduxMiddleware,
	createStore as createReduxStore,
	compose
} from 'redux';
import thunk from 'redux-thunk';
import randomString from 'random-string';
import Logger from './Logger';
import * as utils from './utils';
import * as requestActions from './redux/requestActions';
import * as stateActions from './redux/stateActions';
import reducers from './redux/reducers';
import roomClientMiddleware from './redux/roomClientMiddleware';
import Room from './components/Room';

const logger = new Logger();
const reduxMiddlewares =
[
	thunk,
	roomClientMiddleware
];
let middleware = applyReduxMiddleware(...reduxMiddlewares);

if (process.env.NODE_ENV === 'development') 
{
	const devToolsExtension = window.devToolsExtension;
	
	if (typeof devToolsExtension === 'function') 
	{
		middleware = compose(middleware, devToolsExtension());
	}
}
const store = createReduxStore(
	reducers,
	undefined,
	middleware
);

domready(() =>
{
	logger.debug('DOM ready');

	// Load stuff and run
	utils.initialize()
		.then(run);
});

function run()
{
	logger.debug('run() [environment:%s]', process.env.NODE_ENV);

	// TODO: Use userid (logged in) or random string (guest)
	const peerName = randomString({ length: 8 }).toLowerCase();
	const urlParser = new UrlParse(window.location.href, true);
	let roomId = urlParser.query.roomId;
	const produce = urlParser.query.produce !== 'false';
	const useSimulcast = urlParser.query.simulcast !== 'false';

	if (!roomId)
	{
		roomId = randomString({ length: 8 }).toLowerCase();

		urlParser.query.roomId = roomId;
		window.history.pushState('', '', urlParser.toString());
	}

	// Join joom
	/**
	 * roomId: matchId
	 * peerName: userId or random string (guest)
	 * useSimulcast: currentUser.id === match.affirmative/negative.challengerId esle false
	 * produce: currentUser.id === match.affirmative/negative.challengerId esle false
	 */

	// NOTE: I don't like this.
	store.dispatch(
		requestActions.joinRoom(
			{ roomId, peerName, useSimulcast, produce }));

	render(
		<Provider store={store}>
			<Room />
		</Provider>,
		document.getElementById('mediasoup-demo-app-container')
	);
}

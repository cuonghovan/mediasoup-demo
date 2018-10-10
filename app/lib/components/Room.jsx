import React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import * as appPropTypes from './appPropTypes';
import Peer from './Peer';
import Me from './Me';

const Room = ({ peers }) =>
{
	return (
		<div data-component='Room'>
			<div data-component='Peers'>
				<Me />
				{
					peers.map((peer) => <Peer key={peer.name} peer={peer} />)
				}
			</div>
		</div>
	);
};

Room.propTypes =
{
	peers             : PropTypes.arrayOf(appPropTypes.Peer).isRequired,
};

const mapStateToProps = (state) =>
{
	// TODO: This is not OK since it's creating a new array every time, so triggering a
	// component rendering.
	const peersArray = Object.values(state.peers);

	return {
		peers             : peersArray
	};
};

const RoomContainer = connect(mapStateToProps)(Room);

export default RoomContainer;

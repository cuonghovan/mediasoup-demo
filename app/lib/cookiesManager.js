import jsCookie from 'js-cookie';

const USER_COOKIE = 'mediasoup-demo.user';
const DEVICES_COOKIE = 'mediasoup-demo.devices';

export function getDevices()
{
	return jsCookie.getJSON(DEVICES_COOKIE);
}

export function setDevices({ webcamEnabled })
{
	jsCookie.set(DEVICES_COOKIE, { webcamEnabled });
}

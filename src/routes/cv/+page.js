import { OTHER_PUBS, PUBS } from '$lib/publist';
import yaml from 'js-yaml';

export async function load({ fetch }) {
	let pubs = [];
	for (let pub of PUBS) {
		pubs.push(
			await fetch('/pubs/' + pub + '.yml')
				.then((r) => r.text())
				.then((d) => yaml.load(d))
		);
	}

	let other = [];
	for (let pub of OTHER_PUBS) {
		other.push(
			await fetch('/pubs/' + pub + '.yml')
				.then((r) => r.text())
				.then((d) => yaml.load(d))
		);
	}

	return { pubs, other };
}

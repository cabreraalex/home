import yaml from 'js-yaml';

export async function load({ fetch, params }) {
	const pub = await fetch('/pubs/' + params.slug + '.yml')
		.then((r) => r.text())
		.then((d) => yaml.load(d));
	return { pub };
}

import yaml from 'js-yaml';

export async function load({ fetch }) {
	let news = await fetch('/news.yml')
		.then((r) => r.text())
		.then((d) => yaml.load(d));

	return {
		news
	};
}

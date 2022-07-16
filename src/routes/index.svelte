<script context="module">
	const pubsFeat = [
		'aiffinity',
		'symphony',
		'covidcast',
		'deblinder',
		'expo',
		'confusion',
		'fairvis'
	];
	const otherFeat = ['spotcheck', 'publics', 'subgroup-gen', 'interactive-classification'];

	import yaml from 'js-yaml';

	export async function load({ fetch }) {
		let news = await fetch('/news.yml')
			.then((r) => r.text())
			.then((d) => yaml.load(d));

		let pubs = [];
		for (let pub of pubsFeat) {
			pubs.push(
				await fetch('/pubs/' + pub + '.yml')
					.then((r) => r.text())
					.then((d) => yaml.load(d))
			);
		}

		let other = [];
		for (let pub of otherFeat) {
			other.push(
				await fetch('/pubs/' + pub + '.yml')
					.then((r) => r.text())
					.then((d) => yaml.load(d))
			);
		}

		return {
			props: { pubs, other, news }
		};
	}
</script>

<script>
	import Sidebar from '$lib/Sidebar.svelte';
	import Intro from '$lib/Intro.svelte';
	import Footer from '$lib/Footer.svelte';
	import Links from '$lib/Links.svelte';
	import { onMount } from 'svelte';

	export let pubs;
	export let other;
	export let news;

	let mounted = false;
	onMount(() => (mounted = true));

	// (function (i, s, o, g, r, a, m) {
	// 	i['GoogleAnalyticsObject'] = r;
	// 	(i[r] =
	// 		i[r] ||
	// 		function () {
	// 			(i[r].q = i[r].q || []).push(arguments);
	// 		}),
	// 		(i[r].l = 1 * new Date());
	// 	(a = s.createElement(o)), (m = s.getElementsByTagName(o)[0]);
	// 	a.async = 1;
	// 	a.src = g;
	// 	m.parentNode.insertBefore(a, m);
	// })(window, document, 'script', '//www.google-analytics.com/analytics.js', 'ga');
	// ga('create', 'UA-50459890-1', 'auto');
	// ga('send', 'pageview');
</script>

{#if mounted}
	<div class="pure-g" id="main-container">
		<Sidebar />
		<div id="content" class="pure-u-1 pure-u-md-3-4">
			<div id="padded-content">
				<div id="intro">
					<h2 class="header">Hi! You can call me <span class="name">Alex</span></h2>
					<Intro />
				</div>
				<div id="news" class="sect">
					<div class="inline">
						<h2 class="header">News</h2>
						<p><a class="right-all" href="/news">see all</a></p>
					</div>
					<hr />
					{#each { length: 3 } as _, i}
						<div class="news-item pure-g">
							<p class="pure-u-1 pure-u-md-1-5 date">{news[i].date}</p>
							<p class="item pure-u-1 pure-u-md-4-5">
								{@html news[i].news}
							</p>
						</div>
					{/each}
				</div>
				<div id="pubs" class="sect">
					<div class="inline">
						<h2 class="header">Refereed Publications</h2>
						<!-- <a class="right-all" href="#/pubs">see all</a> -->
					</div>
					<hr />
					{#each pubs as pub}
						<div class="pure-g pub">
							<div class="thumb-box pure-u-1 pure-u-md-1-3">
								<a href={'/paper/' + pub.id}>
									<div
										style="background-image: url({'images/' + pub.teaser})"
										class="thumb"
										alt="teaser"
									/>
								</a>
								<div>
									<p class="venue">{pub.venue}</p>
								</div>
							</div>
							<div class="pure-u-1 pure-u-md-2-3">
								<div class="padded">
									<a href={'/paper/' + pub.id}>
										<h4 class="paper-title">{pub.title}</h4>
									</a>
									<p class="authors">
										{@html pub.authors
											.map(
												(p) =>
													`<a class='${
														p.name.includes('Ángel Alexander Cabrera') ? 'me' : ''
													} author' href='${p.website ? p.website : 'javascript:void(0);'}'>${
														p.name
													}</a>`
											)
											.join(', ')}
									</p>
									<!-- <p class="desc">{pub.desc}</p> -->
								</div>
								<Links {pub} />
							</div>
						</div>
					{/each}
				</div>
				<div id="pubs" class="sect">
					<div class="inline">
						<h2 class="header">Workshops, Demos, Posters, and Preprints</h2>
					</div>
					<hr />
					{#each other as pub}
						<div class="pure-g pub">
							<div class="thumb-box pure-u-1 pure-u-md-1-3">
								<a href={'/paper/' + pub.id}>
									<div
										style="background-image: url({'images/' + pub.teaser})"
										class="thumb"
										alt="teaser"
									/>
								</a>
								<p class="venue">{pub.venue}</p>
							</div>
							<div class="pure-u-1 pure-u-md-2-3">
								<div class="padded">
									<a href={'/paper/' + pub.id}>
										<h4 class="paper-title">{pub.title}</h4>
									</a>
									<p class="author">
										{@html pub.authors
											.map(
												(p) =>
													`<a class='${
														p.name === 'Ángel Alexander Cabrera' ? 'me' : ''
													} author' href='${p.website}'>${p.name}</a>`
											)
											.join(', ')}
									</p>
									<!-- <p class="desc">{pub.desc}</p> -->
								</div>
								<Links {pub} />
							</div>
						</div>
					{/each}
				</div>
			</div>
			<Footer />
		</div>
	</div>
{/if}

<style>
	.thumb-box {
		height: 100%;
	}
	.inline {
		display: inline-flex;
		align-items: center;
	}
	.header {
		margin-right: 30px;
		padding-bottom: 0px;
		margin-bottom: 5px;
		margin-top: 5px;
		font-weight: 400;
	}
</style>

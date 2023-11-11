<script>
	import Intro from '$lib/Intro.svelte';
	import Links from '$lib/Links.svelte';

	export let data;
</script>

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
				<p class="pure-u-1 pure-u-md-1-5 date">{data.news[i].date}</p>
				<p class="item pure-u-1 pure-u-md-4-5">
					{@html data.news[i].news}
				</p>
			</div>
		{/each}
	</div>
	<div id="pubs" class="sect">
		<div class="inline">
			<h2 class="header">Refereed Publications</h2>
		</div>
		<hr />
		{#each data.pubs as pub}
			<div class="pure-g pub">
				<div class="thumb-box pure-u-1 pure-u-md-1-4">
					<a href={'/paper/' + pub.id}>
						<div
							style="background-image: url({'images/' + pub.teaser})"
							class="thumb"
							alt="teaser"
						/>
					</a>
					<div class="image-caption">
						<p>{pub.venue}</p>
					</div>
				</div>
				<div class="pure-u-1 pure-u-md-3-4">
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
										} author' href='${p.website ? p.website : 'javascript:void(0);'}'>${p.name}</a>`
								)
								.join(', ')}
						</p>
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
		{#each data.other as pub}
			<div class="pure-g pub">
				<div class="thumb-box pure-u-1 pure-u-md-1-4">
					<a href={'/paper/' + pub.id}>
						<div
							style="background-image: url({'images/' + pub.teaser})"
							class="thumb"
							alt="teaser"
						/>
					</a>
					<p class="venue">{pub.venue}</p>
				</div>
				<div class="pure-u-1 pure-u-md-3-4">
					<div class="padded">
						<a href={'/paper/' + pub.id}>
							<h4 class="paper-title">{pub.title}</h4>
						</a>
						<p class="author">
							{@html pub.authors
								.map(
									(p) =>
										`<a class='${p.name === 'Ángel Alexander Cabrera' ? 'me' : ''} author' href='${
											p.website
										}'>${p.name}</a>`
								)
								.join(', ')}
						</p>
					</div>
					<Links {pub} />
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.image-caption {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-right: 20px;
	}
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

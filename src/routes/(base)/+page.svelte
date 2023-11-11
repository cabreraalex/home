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
				<div class="thumb-box pure-u-1 pure-u-md-7-24">
					<a href={'/paper/' + pub.id}>
						<div
							style="background-image: url({'images/' + pub.teaser})"
							class="thumb"
							alt="teaser"
						/>
					</a>
					<div class="image-caption">
						<p>{pub.venue}</p>
						{#if pub.award}
							<div class="award-container">
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20px"
									><title>trophy</title><path
										d="M18 2C17.1 2 16 3 16 4H8C8 3 6.9 2 6 2H2V11C2 12 3 13 4 13H6.2C6.6 15 7.9 16.7 11 17V19.08C8 19.54 8 22 8 22H16C16 22 16 19.54 13 19.08V17C16.1 16.7 17.4 15 17.8 13H20C21 13 22 12 22 11V2H18M6 11H4V4H6V11M20 11H18V4H20V11Z"
									/></svg
								>
								<p class="award">{pub.award}</p>
							</div>
						{/if}
					</div>
				</div>
				<div class="pure-u-1 pure-u-md-17-24">
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
				<div class="thumb-box pure-u-1 pure-u-md-7-24">
					<a href={'/paper/' + pub.id}>
						<div
							style="background-image: url({'images/' + pub.teaser})"
							class="thumb"
							alt="teaser"
						/>
					</a>
					<p class="venue">{pub.venue}</p>
				</div>
				<div class="pure-u-1 pure-u-md-17-24">
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
	.award {
		color: #b59410;
		margin-left: 5px;
	}
	.award-container {
		fill: #b59410;
		display: flex;
		align-items: center;
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

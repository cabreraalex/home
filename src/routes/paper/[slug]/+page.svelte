<script>
	import Footer from '$lib/Footer.svelte';
	import Links from '$lib/Links.svelte';

	export let data;
</script>

<div id="body">
	<a href="/" class="home">
		<i class="fas fa-home" id="home" />
		<h4 id="home-link">
			<span class="color">Ángel&nbsp;</span>
			<span class="color red">Alex</span>
			<span class="color">ander&nbsp;</span>
			<span class="color red">Cabrera</span>
		</h4>
	</a>
	<hr />
	<h1>{data.pub.title}</h1>
	<div id="info">
		<h3>
			{@html data.pub.authors
				.map(
					(p) =>
						`<a class='${p.name.includes('Ángel Alexander Cabrera') ? 'me' : 'author'}' href='${
							p.website ? p.website : ''
						}'>${p.name}</a>`
				)
				.join(', ')}
		</h3>
	</div>
	<div id="preview">
		<img src={'/images/' + data.pub.teaser} class="teaser" alt="teaser" />
		<p class="desc">
			{data.pub.abstract}
		</p>
	</div>

	<h2 class="sec-title">Citation</h2>
	<a href={'/paper/' + data.pub.id} class="paper-title">
		{data.pub.title}
	</a>

	<h5>
		{@html data.pub.authors
			.map(
				(p) =>
					`<a class='${p.name.includes('Ángel Alexander Cabrera') ? 'me' : ''}' href='${
						p.website ? p.website : 'javascript:void(0);'
					}'>${p.name}</a>`
			)
			.join(', ')}
	</h5>

	<h5>
		<i>{data.pub.venuelong}. {data.pub.location ? data.pub.location + ',' : ''} {data.pub.year}.</i>
	</h5>

	<Links pub={data.pub} />
	{#if data.pub.bibtex}
		<h2 class="sec-title">BibTex</h2>
		<div class="code">
			<code class="bibtex">{data.pub.bibtex}</code>
		</div>
	{/if}
	<Footer />
</div>

<style>
	.paper-title {
		margin-bottom: 5px;
	}
	#body {
		max-width: 900px;
		margin: 0px auto;
		padding-left: 20px;
		padding-right: 20px;
	}
	#preview {
		margin-top: 30px;
	}
	.color {
		font-size: 16px;
	}
	.red {
		color: #e53935;
	}
	h1 {
		font-size: 24px;
		font-weight: 500;
		margin: 0px;
		margin-top: 30px;
		margin-bottom: 5px;
	}

	h3 {
		font-size: 16px;
		margin: 0px;
	}

	h5 {
		font-size: 16px;
		font-weight: 300;
	}

	#home {
		font-size: 18px;
		margin-right: 15px;
	}

	#home-link {
		font-size: 0px;
		display: flex;
		margin-top: 5px;
		align-items: center;
	}

	.home {
		font-size: 20px;
		/* line-height: 25px; */
		text-align: center;
		display: inline-flex;
		align-items: center;
		color: var(--black);
	}

	.sec-title {
		margin-top: 30px;
		margin-bottom: 10px;
		font-weight: 400;
		font-size: 20px;
	}

	.code {
		font-family: monospace;
		font-size: 13px;
		padding: 10px;
		background: rgba(0, 0, 0, 0.05);
	}

	.teaser {
		width: 40%;
		float: right;
		margin-left: 15px;
		border: 1px solid rgba(0, 0, 0, 0.25);
	}

	#info {
		padding-right: 20px;
	}

	.desc {
		text-align: justify;
	}

	@media only screen and (max-width: 769px) {
		.teaser {
			width: 100%;
			float: top;
			margin-left: 0px;
		}
	}
</style>

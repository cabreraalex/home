<script>
	export let pub;
</script>

<div class="buttons">
	{#if pub.pdf}
		<a href={pub.pdf} rel="external">
			<button class="entry-link">
				<i class="fas fa-file-pdf" />
				<p>PDF</p>
			</button>
		</a>
	{/if}
	{#if pub.citation}
		<a href={pub.citation}>
			<button class="entry-link">
				<i class="fas fa-book" />
				<p>BibTex</p>
			</button>
		</a>
	{/if}
	{#if pub.web}
		<a href={pub.web}>
			<button class="entry-link">
				<i class="fas fa-globe" />
				<p>Website</p>
			</button>
		</a>
	{/if}
	{#if pub.blog}
		<a href={pub.blog}>
			<button class="entry-link">
				<i class="fab fa-medium" />
				<p>Blog</p>
			</button>
		</a>
	{/if}
	{#if pub.workshop}
		<a href={pub.workshop}>
			<button class="entry-link">
				<i class="fas fa-globe" />
				<p>Workshop</p>
			</button>
		</a>
	{/if}
	{#if pub.video}
		<a href={pub.video}>
			<button class="entry-link">
				<i class="fab fa-youtube" />
				<p>Video</p>
			</button>
		</a>
	{/if}
	{#if pub.code}
		<a href={pub.code}>
			<button class="entry-link">
				<i class="fab fa-github" />
				<p>Code</p>
			</button>
		</a>
	{/if}
	{#if pub.slides}
		<a href={pub.slides} rel="external">
			<button class="entry-link">
				<i class="fas fa-file-powerpoint" />
				<p>Slides</p>
			</button>
		</a>
	{/if}
	<a href={'/paper/' + pub.id}>
		<button class="entry-link">
			<i class="fas fa-info-circle" />
			<p>Details</p>
		</button>
	</a>
	{#if pub.award}
		<div class="award-container">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15px"
				><title>trophy</title><path
					d="M18 2C17.1 2 16 3 16 4H8C8 3 6.9 2 6 2H2V11C2 12 3 13 4 13H6.2C6.6 15 7.9 16.7 11 17V19.08C8 19.54 8 22 8 22H16C16 22 16 19.54 13 19.08V17C16.1 16.7 17.4 15 17.8 13H20C21 13 22 12 22 11V2H18M6 11H4V4H6V11M20 11H18V4H20V11Z"
				/></svg
			>
			<p class="award">{pub.award}</p>
		</div>
	{/if}
</div>

<style>
	.award {
		color: #b59410;
		margin-left: 5px;
		font-size: 13px;
	}
	.award-container {
		margin-top: 3px;
		margin-left: 5px;
		fill: #b59410;
		display: flex;
		align-items: center;
	}
</style>

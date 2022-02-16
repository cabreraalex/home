<script>
	export let pub;
</script>

<div class="buttons">
	{#if pub.pdf}
		<a href={pub.pdf}>
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
	{#if pub.demo}
		<a href={pub.demo}>
			<button class="entry-link">
				<i class="fas fa-globe" />
				<p>Demo</p>
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
		<a href={pub.slides}>
			<button class="entry-link">
				<i class="fas fa-file-powerpoint" />
				<p>Slides</p>
			</button>
		</a>
	{/if}
	<a href={'/paper/' + pub.id}>
		<button class="entry-link">
			<i class="fas fa-globe" />
			<p>Website</p>
		</button>
	</a>
</div>

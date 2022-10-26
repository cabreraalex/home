<script>
	export let data;
</script>

<div id="padded-content">
	<h2>News</h2>
	<hr />
	{#each data.news as n}
		<div class="news-item pure-g">
			<p class="pure-u-1 pure-u-md-1-5 date">{n.date}</p>
			<p class="item pure-u-1 pure-u-md-4-5">
				{@html n.news}
			</p>
		</div>
	{/each}
</div>

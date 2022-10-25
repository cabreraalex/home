<script>
	import Social from './Social.svelte';
</script>

<div id="sidebar" class="pure-u-1 pure-u-md-1-4">
	<div id="padded-sidebar">
		<a href="/">
			<img width="180px" src="images/profile.png" alt="profile" />
		</a>
		<h1 id="name">
			<span class="color">Ángel&nbsp;</span>
			<br />
			<span class="color red">Alex</span>
			<span class="color">ander</span>
			<br />
			<span class="color red">Cabrera</span>
		</h1>
		<Social home={true} />
		<a href="/cv"> <button class="cv">CV (web)</button> </a>
		<a href="/cv.pdf" rel="external"> <button class="cv">CV (pdf)</button> </a>
	</div>
</div>

<style>
	.color {
		font-size: 30px;
	}
	.red {
		color: #e53935;
	}
	#name {
		font-size: 0px;
	}
	#padded-sidebar {
		padding-right: 30px;
	}
	@media only screen and (max-width: 769px) {
		#padded-sidebar {
			text-align: center;
		}
	}
	img {
		border-radius: 3px;
		margin-top: 8px;
	}
</style>

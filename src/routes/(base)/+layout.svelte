<script>
	import Sidebar from '$lib/Sidebar.svelte';
	import Footer from '$lib/Footer.svelte';
</script>

<div class="pure-g" id="main-container">
	<Sidebar />
	<div id="content" class="pure-u-1 pure-u-md-3-4">
		<slot />
		<Footer />
	</div>
</div>

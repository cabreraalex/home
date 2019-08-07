<script>
  import Sidebar from "./Sidebar.svelte";
  import Footer from "./Footer.svelte";
  import news from "./news.js";
</script>

<div class="pure-g" id="main-container">
  <Sidebar />
  <div id="content" class="pure-u-1 pure-u-md-3-4">
    <div id="padded-content">
      <h1>News</h1>
      {#each news as n}
        <div class="news-item pure-g">
          <p class="pure-u-1 pure-u-md-1-4 date">{n.date}</p>
          <p class="item pure-u-1 pure-u-md-3-4">
            {@html n.news}
          </p>
        </div>
      {/each}
    </div>
  <Footer />
  </div>
</div>

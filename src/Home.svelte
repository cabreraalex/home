<script>
  import { link } from "svelte-spa-router";
  import news from "./data/news.js";
  import pubs from "./data/pubs.js";
  import Sidebar from "./components/Sidebar.svelte";
  import Intro from "./components/Intro.svelte";
  import Footer from "./components/Footer.svelte";
  import Links from "./components/Links.svelte";
  import { onMount } from "svelte";

  onMount(() => window.scrollTo(0, 0));
</script>

<style>
  .inline {
    display: inline-flex;
    align-items: center;
  }
  .header {
    margin-right: 30px;
  }
  @media only screen and (max-width: 769px) {
    #hello {
      margin-top: 20px;
      text-align: center;
    }
  }
</style>

<div class="pure-g" id="main-container">
  <Sidebar />
  <div id="content" class="pure-u-1 pure-u-md-3-4">
    <div id="padded-content">
      <div id="intro">
        <h2 id="hello">
          Hi! You can call me
          <span class="name">Alex</span>
        </h2>
        <Intro />
      </div>
      <div id="news" class="sect">
        <div class="inline">
          <h2 class="header">News</h2>
          <a class="right-all" href="#/news">all news</a>
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
          <h2 class="header">Selected Publications</h2>
          <a class="right-all" href="#/pubs">all publications</a>
        </div>
        <hr />
        {#each pubs as pub}
          <div class="pure-g pub">
            <div class="thumb-box pure-u-1 pure-u-md-1-3">
              <div class="thumb">
                <a href={'#/paper/' + pub.id}>
                  <img
                    src={'images/' + pub.teaser}
                    class="thumb"
                    alt="teaser" />
                </a>
                <h6 class="venue">{pub.venue}</h6>
              </div>
            </div>
            <div class="pure-u-1 pure-u-md-2-3">
              <div class="padded">
                <a href={'#/paper/' + pub.id} class="paper-title">
                  <h4>{pub.title}</h4>
                </a>
                <h5 class="authors">
                  {@html pub.authors
                    .map(p => "<a href='" + p.website + "'>" + p.name + '</a>')
                    .join(', ')}
                </h5>
                <p class="desc">{pub.desc}</p>
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

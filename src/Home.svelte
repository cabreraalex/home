<script>
  import { link } from "svelte-spa-router";
  import news from "./data/news.js";
  import pubs from "./data/pubs.js";
  import other from "./data/other.js";
  import Sidebar from "./components/Sidebar.svelte";
  import Intro from "./components/Intro.svelte";
  import Footer from "./components/Footer.svelte";
  import Links from "./components/Links.svelte";
  import { onMount } from "svelte";

  onMount(() => window.scrollTo(0, 0));
</script>

<div class="pure-g" id="main-container">
  <Sidebar />
  <div id="content" class="pure-u-1 pure-u-md-3-4">
    <div id="padded-content">
      <div id="intro">
        <h2 id="hello">Hi! You can call me <span class="name">Alex</span></h2>
        <Intro />
      </div>
      <div id="news" class="sect">
        <div class="inline">
          <h2 class="header">News</h2>
          <p><a class="right-all" href="#/news">see all</a></p>
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
          <h2 class="header">Refereed Publications</h2>
          <!-- <a class="right-all" href="#/pubs">see all</a> -->
        </div>
        <hr />
        {#each pubs as pub}
          <div class="pure-g pub">
            <div class="thumb-box pure-u-1 pure-u-md-1-3">
              <a href={"#/paper/" + pub.id}>
                <div
                  style="background-image: url({'images/' + pub.teaser})"
                  class="thumb"
                  alt="teaser"
                />
              </a>
              <div>
                <p class="venue">{pub.venue}</p>
              </div>
            </div>
            <div class="pure-u-1 pure-u-md-2-3">
              <div class="padded">
                <a href={"#/paper/" + pub.id}>
                  <h4 class="paper-title">{pub.title}</h4>
                </a>
                <p class="authors">
                  {@html pub.authors
                    .map(
                      (p) =>
                        `<a class='${
                          p.name === "Ángel Alexander Cabrera" ? "me" : ""
                        } author' href='${p.website}'>${p.name}</a>`
                    )
                    .join(", ")}
                </p>
                <!-- <p class="desc">{pub.desc}</p> -->
              </div>
              <Links {pub} />
            </div>
          </div>
        {/each}
      </div>
      <div id="pubs" class="sect">
        <div class="inline">
          <h2 class="header">Workshops, Demos, Posters, and Preprints</h2>
          <!-- <a class="right-all" href="#/pubs">see all</a> -->
        </div>
        <hr />
        {#each other as pub}
          <div class="pure-g pub">
            <div class="thumb-box pure-u-1 pure-u-md-1-3">
              <a href={"#/paper/" + pub.id}>
                <div
                  style="background-image: url({'images/' + pub.teaser})"
                  class="thumb"
                  alt="teaser"
                />
              </a>
              <p class="venue">{pub.venue}</p>
            </div>
            <div class="pure-u-1 pure-u-md-2-3">
              <div class="padded">
                <a href={"#/paper/" + pub.id}>
                  <h4 class="paper-title">{pub.title}</h4>
                </a>
                <p class="author">
                  {@html pub.authors
                    .map(
                      (p) =>
                        `<a class='${
                          p.name === "Ángel Alexander Cabrera" ? "me" : ""
                        } author' href='${p.website}'>${p.name}</a>`
                    )
                    .join(", ")}
                </p>
                <!-- <p class="desc">{pub.desc}</p> -->
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

<style>
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
  @media only screen and (max-width: 769px) {
    #hello {
      margin-top: 20px;
      text-align: center;
    }
  }
</style>

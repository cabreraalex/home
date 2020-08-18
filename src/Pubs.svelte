<script>
  import Sidebar from "./components/Sidebar.svelte";
  import Footer from "./components/Footer.svelte";
  import Links from "./components/Links.svelte";
  import pubs from "./data/pubs.js";
  import { onMount } from "svelte";

  onMount(() => window.scrollTo(0, 0));
</script>

<style>
  h1 {
    margin: 0px;
  }
</style>

<div class="pure-g" id="main-container">
  <Sidebar />
  <div id="content" class="pure-u-1 pure-u-md-3-4">
    <div id="padded-content">
      <h1>Publications</h1>
      <hr />
      {#each pubs as pub}
        <div class="pure-g pub">
          <div class="pure-u-1 pure-u-md-1-3 thumb-box">
            <div class="thumb">
              <a href={'#/paper/' + pub.id}>
                <img src={'images/' + pub.teaser} class="thumb" alt="teaser" />
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
                  .map(
                    p =>
                      `<a class='${
                        p.name === 'Ángel Alexander Cabrera' ? 'me' : ''
                      }' href='${p.website}'>${p.name}</a>`
                  )
                  .join(', ')}
              </h5>
              <p class="desc">{pub.desc}</p>
            </div>
            <Links {pub} />
          </div>
        </div>
      {/each}
    </div>
    <Footer />
  </div>
</div>

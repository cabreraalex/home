<script>
  import Footer from "./components/Footer.svelte";
  import pubs from "./data/pubs.js";
  import Links from "./components/Links.svelte";
  import { onMount } from "svelte";
  export let params = {};

  let pub = pubs.find(e => e.id === params.id);
  onMount(() => window.scrollTo(0, 0));
</script>

<style>
  #body {
    max-width: 900px;
    margin: 0px auto;
    padding-left: 20px;
    padding-right: 20px;
  }
  .color {
    font-size: 22px;
  }
  .red {
    color: #e53935;
  }
  p {
    font-size: 18px;
  }

  h1 {
    font-size: 1.75em;
    margin: 0px;
    margin-bottom: 10px;
  }

  h3 {
    font-size: 20px;
    margin: 0px;
  }

  h4 {
    font-size: 20px;
    margin: 0px;
  }

  h5 {
    margin-top: 4px;
    margin-bottom: 4px;
    font-weight: 100;
    font-size: 16px;
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
    line-height: 25px;
    text-align: center;
    display: inline-flex;
    align-items: center;
    color: var(--black);
  }

  .sec-title {
    margin-top: 40px;
    margin-bottom: 10px;
  }

  .code {
    padding: 10px;
    background: rgba(0, 0, 0, 0.05);
  }

  .flex {
    display: flex;
    align-items: center;
    font-size: 20px;
    margin-top: 30px;
  }

  .teaser {
    width: calc(100% - 20px);
    padding: 10px;
    border: 1px solid rgba(0, 0, 0, 0.25);
  }

  #info {
    padding-right: 20px;
  }
  .desc {
    font-size: 20px;
    line-height: 25px;
    padding: 15px;
    text-align: center;
  }
</style>

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
  <h1>{pub.title}</h1>
  <div id="info">
    <h3>
      {@html pub.authors
        .map(p => "<a href='" + p.website + "'>" + p.name + '</a>')
        .join(', ')}
    </h3>
  </div>
  <div class="flex pure-g">
    <div class="pure-u-1 pure-u-md-1-2">
      <img src={'images/' + pub.teaser} class="teaser" alt="teaser" />
    </div>
    <div class="pure-u-1 pure-u-md-1-2">
      <p class="desc">{pub.desc}</p>
    </div>
  </div>

  <h2 class="sec-title">Abstract</h2>
  <p>{pub.abstract}</p>

  <h2 class="sec-title">Citation</h2>
  <a href={'#/paper/' + pub.id} class="paper-title">
    <h4>{pub.title}</h4>
  </a>

  <h5>
    {@html pub.authors
      .map(p => "<a href='" + p.website + "'>" + p.name + '</a>')
      .join(', ')}
  </h5>

  <h5>
    <i>{pub.venuelong}. {pub.location}, {pub.year}</i>
  </h5>

  <Links {pub} />
  <h2 class="sec-title">BibTex</h2>
  <div class="code">
    <code class="bibtex">{pub.bibtex}</code>
  </div>
  <Footer />
</div>

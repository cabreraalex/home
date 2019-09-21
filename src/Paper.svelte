<script>
  import Footer from "./components/Footer.svelte";
  import pubs from "./data/pubs.js";
  import Links from "./components/Links.svelte";
  export let params = {};

  let pub = pubs.find(e => e.id === params.id);
</script>

<style>
  .color {
    font-size: 22px;
  }
  .red {
    color: #e53935;
  }
  #name {
    font-size: 0px;
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

  #body {
    margin-right: 20px;
    margin-left: 20px;
  }

  #home {
    font-size: 18px;
    margin-right: 15px;
  }

  #home-link {
    color: var(--black);
    border-bottom: 1px solid rgba(0, 0, 0, 0.3);
    margin-bottom: 30px;
    padding-bottom: 10px;
    font-size: 0px;
    display: flex;
    align-items: center;
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
    font-size: 25px;
    padding-left: 40px;
    text-align: center;
  }
</style>

<div id="body">
  <a href="/">
    <h4 id="home-link">
      <i class="fas fa-home" id="home" />
      <span class="color">Ángel&nbsp;</span>
      <span class="color red">Alex</span>
      <span class="color">ander&nbsp;</span>
      <span class="color red">Cabrera</span>
    </h4>
  </a>
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

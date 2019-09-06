<script>
  import Footer from "./components/Footer.svelte";
  import pubs from "./data/pubs.js";
  import Links from "./components/Links.svelte";
  export let params = {};

  let pub = pubs.find(e => e.id === params.id);
</script>

<style>
  p {
    font-size: 18px;
  }
  
  h1 {font-size: 1.75em}

  h3 {
    font-size: 20px;
    margin: 0px;
  }

  h4 {
    font-size: 20px;
    margin: 0px;
  }

  h5 {
    margin-top: 2px;
  }

  #body {
    margin-right: 20px;
    margin-left: 20px;
  }

  #home {
    font-size: 16px;
    margin-right: 10px;
  }

  #home-link {
    color: var(--black);
    border-bottom: 1px solid rgba(0, 0, 0, 0.3);
    margin-bottom: 20px;
    padding-bottom: 5px;
  }

  .sec-title {
    margin-top: 20px;
    margin-bottom: 10px;
  }

  .code {
    padding: 10px;
    background: rgba(0, 0, 0, 0.05);
  }

  .flex {
    display: flex;
    align-items: center;
  }

  .teaser {
    width: calc(100% - 20px);
    padding: 10px;
    border: 1px solid rgba(0, 0, 0, 0.25)
  }

  #info {padding-right:20px}
</style>

<link
  rel="stylesheet"
  href="https://use.fontawesome.com/releases/v5.0.12/css/all.css"
  integrity="sha384-G0fIWCsCzJIMAVNQPfjH08cyYaUtMwjJwqiRKxxE/rx96Uroj1BtIQ6MLJuheaO9"
  crossorigin="anonymous" />

<div id="body">
  <a href="/">
    <h4 id="home-link">
      <i class="fas fa-home" id="home" />
      &Aacute;ngel
      <span class="name">Alex</span>
      ander
      <span class="name">Cabrera</span>
    </h4>
  </a>
  <div class="flex">
    <div class="pure-u-1-2" id="info">
      <h1>{pub.title}</h1>
      <h3>
        {@html pub.authors
          .map(p => "<a href='" + p.website + "'>" + p.name + '</a>')
          .join(', ')}
      </h3>
    </div>
    <div class="pure-u-1-2">
      <img src={'images/' + pub.teaser} class="teaser" alt="teaser" />
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

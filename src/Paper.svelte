<script>
  import Footer from "./components/Footer.svelte";
  import pubs from "./data/pubs.js";
  export let params = {};

  let pub = pubs.find(e => e.id === params.id);
</script>

<style>
  p {
    font-size: 18px;
  }

  h3 {
    font-size: 20px;
  }

  h4 {
    font-size: 20px;
    margin: 0px;
  }

  h5 {
    margin-top: 2px;
  }

  .buttons {
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

  #teaser {
    width: 100%;
  }

  .half {
    width: 50%;
  }

  #header {
    display: inline-flex;
    margin-top: 20px;
  }

  .code {
    padding: 10px;
    background: rgba(0, 0, 0, 0.05);
  }
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
  <h1>{pub.title}</h1>
  <h3>
    {@html pub.authors
      .map(p => "<a href='" + p.website + "'>" + p.name + '</a>')
      .join(', ')}
  </h3>

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

  <div class="buttons">
    {#if pub.pdf}
      <a href={pub.pdf}>
        <button>
          <i class="fas fa-file-pdf" />
          PDF
        </button>
      </a>
    {/if}
    {#if pub.code}
      <a href={pub.code}>
        <button>
          <i class="fab fa-github" />
          Code
        </button>
      </a>
    {/if}
    {#if pub.workshop}
      <a href={pub.workshop}>
        <button>
          <i class="fas fa-globe" />
          Workshop
        </button>
      </a>
    {/if}
    {#if pub.video}
      <a href={pub.video}>
        <button>
          <i class="fab fa-youtube" />
          Video
        </button>
      </a>
    {/if}
    {#if pub.demo}
      <a href={pub.demo}>
        <button>
          <i class="fas fa-globe" />
          Demo
        </button>
      </a>
    {/if}
    <a href={'#/paper/' + pub.id}>
      <button>
        <i class="fas fa-globe" />
        Website
      </button>
    </a>
  </div>
  <h2 class="sec-title">BibTex</h2>
  <div class="code">
    <code class="bibtex">
      {pub.bibtex}
    </code>
  </div>
  <Footer />
</div>

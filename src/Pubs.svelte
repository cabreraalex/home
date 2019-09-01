<script>
  import Sidebar from "./components/Sidebar.svelte";
  import Footer from "./components/Footer.svelte";
  import pubs from "./data/pubs.js";
</script>

<div class="pure-g" id="main-container">
  <Sidebar />
  <div id="content" class="pure-u-1 pure-u-md-3-4">
    <div id="padded-content">
      <h1>Publications</h1>
        {#each pubs as pub}
          <div class="pure-g pub">
            <div class="pure-u-1 pure-u-md-1-4">
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
            <div class="pure-u-1 pure-u-md-3-4">
              <div class="padded">
                <a href={'#/paper/' + pub.id} class="paper-title">
                  <h4>{pub.title}</h4>
                </a>
                <h5>
                  {@html pub.authors
                    .map(p => "<a href='" + p.website + "'>" + p.name + '</a>')
                    .join(', ')}
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
              </div>
            </div>
          </div>
        {/each}
    </div>
    <Footer />
  </div>
</div>

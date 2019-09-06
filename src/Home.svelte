<script>
  import { link } from "svelte-spa-router";
  import news from "./data/news.js";
  import pubs from "./data/pubs.js";
  import Sidebar from "./components/Sidebar.svelte";
  import Intro from "./components/Intro.svelte";
  import Footer from "./components/Footer.svelte";
  import Links from "./components/Links.svelte";

  (function(i, s, o, g, r, a, m) {
    i["GoogleAnalyticsObject"] = r;
    (i[r] =
      i[r] ||
      function() {
        (i[r].q = i[r].q || []).push(arguments);
      }),
      (i[r].l = 1 * new Date());
    (a = s.createElement(o)), (m = s.getElementsByTagName(o)[0]);
    a.async = 1;
    a.src = g;
    m.parentNode.insertBefore(a, m);
  })(
    window,
    document,
    "script",
    "//www.google-analytics.com/analytics.js",
    "ga"
  );

  ga("create", "UA-50459890-1", "auto");
  ga("send", "pageview");
</script>

<div class="pure-g" id="main-container">
  <Sidebar />
  <div id="content" class="pure-u-1 pure-u-md-3-4">
    <div id="padded-content">
      <div id="intro">
        <h2>
          Hi! You can call me <span class="name">Alex</span>.
        </h2>
        <Intro />
      </div>
      <div id="news" class="sect">
        <h2>
          News
          <a class="right-all" href="#/news">all news</a>
        </h2>
        {#each {length: 3} as _, i}
          <div class="news-item pure-g">
            <p class="pure-u-1 pure-u-md-1-5 date">{news[i].date}</p>
            <p class="item pure-u-1 pure-u-md-4-5">
              {@html news[i].news}
            </p>
          </div>
        {/each}
      </div>
      <div id="pubs" class="sect">
        <h2>
          Selected Publications
          <a class="right-all" href="#/pubs">all publications</a>
        </h2>
        {#each pubs as pub}
          <div class="pure-g pub">
            <div class="pure-u-1 pure-u-md-1-3">
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
                <h5>
                  {@html pub.authors
                    .map(p => "<a href='" + p.website + "'>" + p.name + '</a>')
                    .join(', ')}
                </h5>
              </div>
            <Links pub={pub} />
            </div>
          </div>
        {/each}
      </div>
    </div>
    <Footer />
  </div>
</div>

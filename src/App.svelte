<script>
  import Router from "svelte-spa-router";
  import { link } from "svelte-spa-router";
  import routes from "./routes";
  import news from "./data/news.js";
  import pubs from "./data/pubs.js";

  document.title = "Alex Cabrera";

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

<Router {routes} />

<script>
  import Router from "svelte-spa-router";
  import { link } from "svelte-spa-router";
  import routes from "./routes";
  import news from "./data/news.js";
  import pubs from "./data/pubs.js";

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

<svelte:head>
  <title>Alex Cabrera</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link
    rel="stylesheet"
    href="https://unpkg.com/purecss@1.0.1/build/pure-min.css"
    integrity="sha384-oAOxQR6DkCoMliIh8yFnu25d7Eq/PHS21PClpwjOTeU2jRSq11vu66rf90/cZr47"
    crossorigin="anonymous" />
  <link
    rel="stylesheet"
    href="https://unpkg.com/purecss@1.0.1/build/grids-responsive-min.css" />

  <link
    rel="stylesheet"
    href="https://use.fontawesome.com/releases/v5.0.12/css/all.css"
    integrity="sha384-G0fIWCsCzJIMAVNQPfjH08cyYaUtMwjJwqiRKxxE/rx96Uroj1BtIQ6MLJuheaO9"
    crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css?family=Open+Sans:400|Roboto:900,400"
    rel="stylesheet" />
</svelte:head>

<Router {routes} />

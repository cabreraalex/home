<script>
import Social from "./Social.svelte"</script>
<link
    rel="stylesheet"
    href="https://use.fontawesome.com/releases/v5.0.12/css/all.css"
    integrity="sha384-G0fIWCsCzJIMAVNQPfjH08cyYaUtMwjJwqiRKxxE/rx96Uroj1BtIQ6MLJuheaO9"
    crossorigin="anonymous"
/>

<div id="sidebar" class="pure-u-1 pure-u-md-1-4">
  <div id="padded-sidebar">
    <a href="/"><img width="170px" src="images/profile.jpg" alt="profile picture" /></a>
    <h1 id="name">
      &Aacute;ngel
      <span class="name">Alex</span>ander
      <span class="name">Cabrera</span>
    </h1>
    <Social />
    <a href="/#/cv">
      <button class="cv">CV (web)</button>
    </a>
    <a href="/cv.pdf">
      <button class="cv">CV (pdf)</button>
    </a>
  </div>
</div>

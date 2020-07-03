<script>
  import Social from "./Social.svelte";
</script>

<style>
  .color {
    font-size: 30px;
  }
  .red {
    color: #e53935;
  }
  #name {
    font-size: 0px;
  }
  #padded-sidebar {
    padding-right: 30px;
  }
  @media only screen and (max-width: 769px) {
    #padded-sidebar {
      text-align: center;
    }
  }
</style>

<div id="sidebar" class="pure-u-1 pure-u-md-1-4">
  <div id="padded-sidebar">
    <a href="/">
      <img width="170px" src="images/profile.jpg" alt="profile" />
    </a>
    <h1 id="name">
      <span class="color">Ángel&nbsp;</span>
      <br />
      <span class="color red">Alex</span>
      <span class="color">ander</span>
      <br />
      <span class="color red">Cabrera</span>
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

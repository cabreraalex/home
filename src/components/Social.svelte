<script>
  export let home;
  $: console.log(home);
</script>

<style>
  h3 {
    margin-bottom: 0px;
  }
</style>

<div id="social">
  {#if !home}
    <a href="https://cabreraalex.com">
      <h3><i class="fas fa-home" /> &nbsp;cabreraalex.com</h3>
    </a>
  {/if}
  <a href="mailto:cabrera@cmu.edu">
    <h3><i class="fas fa-envelope" /> &nbsp;&nbsp;cabrera@cmu.edu</h3>
  </a>
  {#if home}
    <a href="https://twitter.com/a_a_cabrera">
      <h3><i class="fab fa-twitter social-icon" /> &nbsp;&nbsp;@a_a_cabrera</h3>
    </a>
    <a href="https://cabreraalex.medium.com/">
      <h3><i class="fab fa-medium-m" /> &nbsp;&nbsp;Blog</h3>
    </a>
  {/if}
  <a href="https://github.com/cabreraalex">
    <h3><i class="fab fa-github" /> &nbsp;&nbsp;GitHub</h3>
  </a>
  <a href="https://scholar.google.com/citations?user=r89SDm0AAAAJ&hl=en">
    <h3><i class="fas fa-graduation-cap" /> &nbsp;Google Scholar</h3>
  </a>
</div>

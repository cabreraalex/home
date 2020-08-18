<script>
  export let pub;
</script>

<style>
  button p {
    font-size: 13px;
    margin-right: 1px;
  }

  .button-link {
    padding: 3px;
    display: inline-flex;
    align-items: center;
    padding-bottom: 0px;
    padding-top: 0px;
  }
</style>

<div class="buttons">
  {#if pub.pdf}
    <a href={pub.pdf}>
      <button class="button-link">
        <i class="fas fa-file-pdf" />
        <p>PDF</p>
      </button>
    </a>
  {/if}
  {#if pub.blog}
    <a href={pub.blog}>
      <button class="button-link">
        <i class="fab fa-medium" />
        <p>Blog</p>
      </button>
    </a>
  {/if}
  {#if pub.workshop}
    <a href={pub.workshop}>
      <button class="button-link">
        <i class="fas fa-globe" />
        <p>Workshop</p>
      </button>
    </a>
  {/if}
  {#if pub.video}
    <a href={pub.video}>
      <button class="button-link">
        <i class="fab fa-youtube" />
        <p>Video</p>
      </button>
    </a>
  {/if}
  {#if pub.demo}
    <a href={pub.demo}>
      <button class="button-link">
        <i class="fas fa-globe" />
        <p>Demo</p>
      </button>
    </a>
  {/if}
  {#if pub.code}
    <a href={pub.code}>
      <button class="button-link">
        <i class="fab fa-github" />
        <p>Code</p>
      </button>
    </a>
  {/if}
  {#if pub.slides}
    <a href={pub.slides}>
      <button class="button-link">
        <i class="fas fa-file-powerpoint" />
        <p>Slides</p>
      </button>
    </a>
  {/if}
  <a href={'#/paper/' + pub.id}>
    <button class="button-link">
      <i class="fas fa-globe" />
      <p>Website</p>
    </button>
  </a>
</div>

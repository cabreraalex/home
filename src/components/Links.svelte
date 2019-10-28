<script>
  export let pub;
</script>

<style>
  button p {
    font-size: 13px;
    line-height: 22px;
    margin-right: 1px;
  }
  .fas {
    font-size: 19px;
    line-height: 1.1;
  }
  .fab {
    font-size: 19px;
    line-height: 1.1;
  }
  .button-link {
    padding: 3px;
    display: inline-flex;
    justify-items: center;
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

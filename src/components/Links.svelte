<script>
    export let pub;
</script>

<div class="buttons">
  {#if pub.pdf}
    <a href={pub.pdf}>
      <button>
        <i class="fas fa-file-pdf" />
        PDF
      </button>
    </a>
  {/if}
  {#if pub.blog}
    <a href={pub.blog}>
      <button>
        <i class="fab fa-medium" />
        Blog
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
  {#if pub.code}
    <a href={pub.code}>
      <button>
        <i class="fab fa-github" />
        Code
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

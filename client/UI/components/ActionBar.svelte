<script lang="ts">
  const { id = "", class: classList = "", actions = [] } = $props();
</script>

<div class="actionbar {classList}" {id}>
  {#each actions as action (action.id)}
    {#if !action.disabled}
      <button
        type="button"
        class="action"
        data-action-id={action.id}
        onclick={() => action.callback?.()}
        title={action.label}
      >
        <img src={action.icon} alt={action.label} />
      </button>
    {/if}
  {/each}
</div>

<style>
  .actionbar {
    display: flex;
    position: relative;
    flex-direction: column;
    padding: var(--padding-sm);
    gap: var(--gap-lg);
    transition: all 0.3s ease;
  }

  :global(.actionbar.hidden) {
    opacity: 0;
    transform: translateX(-100%);
  }

  .action {
    border: none;
    cursor: pointer;
    background-color: transparent;
    position: relative;
    padding: 0;
    margin: 0;
  }

  .action > img {
    height: 4.5dvmin;
    width: 4.5dvmin;
    transition: transform 0.3s ease;
    object-fit: contain;
    object-position: center;
  }

  .action:hover > img {
    transform: scale(1.1);
  }
</style>

<script lang="ts">
  /**
   * Pill toggle switch — the sliding on/off control shared across settings and
   * account privacy. Renders a styled checkbox so it stays keyboard- and
   * label-accessible (wrap it in a <label> to make the whole row clickable).
   * Green when on, dark when off; the white knob slides between.
   */
  let {
    checked = false,
    disabled = false,
    ariaLabel,
    onChange,
  }: {
    checked?: boolean;
    disabled?: boolean;
    ariaLabel?: string;
    onChange?: (checked: boolean) => void;
  } = $props();
</script>

<input
  type="checkbox"
  class="toggleSwitch"
  role="switch"
  aria-label={ariaLabel}
  aria-checked={checked}
  {checked}
  {disabled}
  onchange={(e) => onChange?.((e.currentTarget as HTMLInputElement).checked)}
/>

<style>
  .toggleSwitch {
    /* Defaults (account privacy, etc.); settings overrides these via the
       --settings-toggle-* tokens so the switch matches its taller controls. */
    --tg-w: var(--settings-toggle-w, clamp(40px, 4.2dvmin, 56px));
    --tg-h: var(--settings-toggle-h, clamp(22px, 2.3dvmin, 30px));
    --tg-knob: var(--settings-toggle-knob, clamp(16px, 1.7dvmin, 22px));
    appearance: none;
    -webkit-appearance: none;
    flex-shrink: 0;
    width: var(--tg-w);
    height: var(--tg-h);
    background: rgba(0, 0, 0, 0.45);
    border: 0.16dvmin solid rgba(255, 255, 255, 0.25);
    border-radius: 999px;
    position: relative;
    cursor: pointer;
    transition:
      background 0.16s ease,
      border-color 0.16s ease;
  }

  .toggleSwitch::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 0.25dvmin;
    width: var(--tg-knob);
    height: var(--tg-knob);
    background: #fff;
    border-radius: 50%;
    transform: translateY(-50%);
    transition: left 0.16s ease;
  }

  .toggleSwitch:checked {
    background: #09992f;
    border-color: #1a5f18;
  }

  .toggleSwitch:checked::before {
    left: calc(100% - var(--tg-knob) - 0.25dvmin);
  }

  .toggleSwitch:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .toggleSwitch:focus-visible {
    outline: 0.16dvmin solid rgba(46, 204, 64, 0.6);
    outline-offset: 0.16dvmin;
  }
</style>

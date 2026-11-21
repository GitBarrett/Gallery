<script setup lang="ts">
// Quest marker drawn in-house (07-design.md § Codes visuels WoW, never the game's sprites): "!" = news or contest,
// "?" = action to do; yellow gradient with a blurred halo, white once read or done.
withDefaults(defineProps<{ kind: 'exclamation' | 'question'; label: string; done?: boolean }>(), { done: false })
const id = useId()
</script>

<template>
  <svg class="quest-marker" :class="{ done }" viewBox="-2 -1 24 30" role="img" :aria-label="label">
    <defs>
      <linearGradient :id="`${id}-fill`" gradientUnits="userSpaceOnUse" x1="0" y1="1" x2="0" y2="27">
        <stop class="top" offset="0" />
        <stop class="mid" offset="0.4" />
        <stop class="low" offset="0.8" />
        <stop class="bottom" offset="1" />
      </linearGradient>
      <filter :id="`${id}-glow`" x="-80%" y="-40%" width="260%" height="180%">
        <feGaussianBlur stdDeviation="1.8" />
      </filter>
    </defs>
    <!-- The same glyph twice: blurred underneath for the halo, sharp on top -->
    <g
      v-for="layer in ['halo', 'glyph']"
      :key="layer"
      :class="layer"
      :filter="layer === 'halo' ? `url(#${id}-glow)` : undefined"
    >
      <template v-if="kind === 'exclamation'">
        <path
          d="M6.3 3.4C6.1 1.6 7.6 1 10 1s3.9.6 3.7 2.4L12.1 17c-.2 1.3-.9 1.7-2.1 1.7s-1.9-.4-2.1-1.7Z"
          :fill="`url(#${id}-fill)`"
        />
        <circle cx="10" cy="23.4" r="3.1" :fill="`url(#${id}-fill)`" />
      </template>
      <template v-else>
        <path
          d="M5.4 8.3C5.4 4.6 7.5 3 10 3s4.6 1.6 4.6 4.4c0 2.4-1.5 3.4-2.9 4.4-1.3.9-1.7 1.8-1.7 4"
          :stroke="`url(#${id}-fill)`"
          stroke-width="3.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          fill="none"
        />
        <circle cx="10" cy="22.9" r="2.7" :fill="`url(#${id}-fill)`" />
      </template>
    </g>
  </svg>
</template>

<style scoped>
.quest-marker {
  width: 1.5em;
  height: 2.1em;
  overflow: visible;
}

.halo {
  opacity: 0.75;
}

.top {
  stop-color: var(--marker-yellow-top);
}

.mid {
  stop-color: var(--marker-yellow-mid);
}

.low {
  stop-color: var(--marker-yellow-low);
}

.bottom {
  stop-color: var(--marker-yellow-bottom);
}

.done .top {
  stop-color: var(--marker-white-top);
}

.done .mid,
.done .low {
  stop-color: var(--marker-white-mid);
}

.done .bottom {
  stop-color: var(--marker-white-bottom);
}
</style>

<script setup lang="ts">
import { useSourcesStore } from '@/stores/sources'
import { storeToRefs } from 'pinia'

const sourcesStore = useSourcesStore()
const { sources } = storeToRefs(sourcesStore)
</script>

<template>
  <ol>
    <li v-for="(source, i) in sources" :key="i">
      <router-link :to="{name: 'source', params: { id: source.id }}">{{ source.title }}</router-link>
    </li>
  </ol>
</template>

<style lang="scss" scoped>
  ol {
    max-width: 100%;
    word-wrap: break-word;
    // list-style: none;
    // padding: 0;
    // margin: 0;
    li {
      cursor: pointer;
      padding: 4px 12px;
      font-size: 0.8rem;
      line-height: 1rem;
      &:has(> a.router-link-active) {
        background-color: rgb(243,243,255);
      }
      a {
        text-decoration: none;
        color: #8232eb;
      }
    }
  }
</style>

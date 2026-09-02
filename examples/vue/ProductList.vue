<script setup lang="ts">
import { defineProps } from 'vue';

const props = defineProps<{
  items: Array<{ id: string; name: string }>;
  loading?: boolean;
}>();

// Destructuring props breaks Vue 3 reactivity tracking!
// Triggers reactivity loss warning/error
const { items } = props;
</script>

<template>
  <div class="product-list">
    <h2>Products</h2>
    <ul>
      <li v-for="item in items" :key="item.id">{{ item.name }}</li>
    </ul>
  </div>
</template>

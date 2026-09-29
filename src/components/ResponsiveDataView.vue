<template>
  <div class="responsive-data-view">
    <div class="responsive-data-table">
      <slot name="table" />
    </div>
    <ul class="responsive-data-list">
      <slot name="mobile" />
    </ul>
  </div>
</template>

<style scoped>
.responsive-data-list {
  display: none;
  list-style: none;
  margin: 0;
  padding: 0;
}

@media (max-width: 640px) {
  .responsive-data-table {
    display: none;
  }

  .responsive-data-list {
    display: flex;
    flex-direction: column;
  }
}
</style>

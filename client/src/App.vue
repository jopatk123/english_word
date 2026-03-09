<template>
  <div class="app-container">
    <el-header class="app-header">
      <div class="header-content" @click="$router.push('/')">
        <h1 class="app-title">📖 词根背单词</h1>
      </div>
    </el-header>
    <el-main class="app-main">
      <router-view />
    </el-main>
  </div>
</template>

<script setup>
</script>

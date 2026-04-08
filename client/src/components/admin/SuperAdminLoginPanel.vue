<template>
  <div class="sa-login-page">
    <div class="sa-login-bg">
      <div class="sa-login-blob sa-blob-1"></div>
      <div class="sa-login-blob sa-blob-2"></div>
    </div>
    <div class="sa-login-card">
      <div class="sa-brand">
        <div class="sa-brand-icon">🛡️</div>
        <div class="sa-brand-text">
          <h1>管理控制台</h1>
          <p>词根背单词 · Super Admin</p>
        </div>
      </div>
      <div class="sa-divider"></div>
      <el-form label-position="top" class="sa-login-form">
        <el-form-item>
          <label class="sa-label">管理员密码</label>
          <el-input
            :model-value="password"
            type="password"
            show-password
            size="large"
            placeholder="请输入管理员密码"
            :prefix-icon="lockIcon"
            @update:model-value="$emit('update:password', $event)"
            @keyup.enter="$emit('submit')"
          />
        </el-form-item>
        <p class="sa-login-hint">默认密码 asd123123123，生产环境请通过 ADMIN_PASSWORD 环境变量覆盖</p>
        <el-button
          type="primary"
          size="large"
          class="sa-login-btn"
          :loading="loading"
          @click="$emit('submit')"
        >
          登录管理后台
        </el-button>
      </el-form>
    </div>
  </div>
</template>

<script setup>
  import { Lock } from '@element-plus/icons-vue';

  defineProps({
    password: {
      type: String,
      default: '',
    },
    loading: {
      type: Boolean,
      default: false,
    },
  });

  defineEmits(['update:password', 'submit']);

  const lockIcon = Lock;
</script>

<style scoped>
  .sa-login-page {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0a0f1e;
    z-index: 0;
    overflow: hidden;
  }

  .sa-login-bg {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
  }

  .sa-login-blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(100px);
    opacity: 0.35;
  }

  .sa-blob-1 {
    width: 620px;
    height: 620px;
    background: radial-gradient(circle, #1e40af, transparent 70%);
    top: -180px;
    left: -120px;
  }

  .sa-blob-2 {
    width: 480px;
    height: 480px;
    background: radial-gradient(circle, #7c3aed, transparent 70%);
    bottom: -140px;
    right: -80px;
  }

  .sa-login-card {
    position: relative;
    z-index: 1;
    width: 420px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 20px;
    padding: 40px 36px;
    backdrop-filter: blur(18px);
    box-shadow: 0 32px 80px rgba(0, 0, 0, 0.5);
  }

  .sa-brand {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 28px;
  }

  .sa-brand-icon {
    font-size: 36px;
    line-height: 1;
    filter: drop-shadow(0 0 12px rgba(99, 102, 241, 0.7));
  }

  .sa-brand-text h1 {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    color: #f1f5f9;
    letter-spacing: -0.01em;
  }

  .sa-brand-text p {
    margin: 3px 0 0;
    font-size: 13px;
    color: #94a3b8;
  }

  .sa-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
    margin-bottom: 24px;
  }

  .sa-login-form {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .sa-label {
    display: block;
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 500;
    color: #94a3b8;
    letter-spacing: 0.03em;
  }

  .sa-login-hint {
    font-size: 12px;
    color: #64748b;
    line-height: 1.65;
    margin: 4px 0 16px;
  }

  .sa-login-btn {
    width: 100%;
    height: 46px;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.02em;
    background: linear-gradient(135deg, #4f46e5, #7c3aed);
    border: none;
    border-radius: 10px;
  }

  .sa-login-btn:hover {
    background: linear-gradient(135deg, #4338ca, #6d28d9);
  }

  @media (max-width: 900px) {
    .sa-login-card {
      width: calc(100vw - 40px);
      padding: 32px 24px;
    }
  }
</style>
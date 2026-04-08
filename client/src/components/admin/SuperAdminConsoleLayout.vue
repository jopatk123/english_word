<template>
  <div class="sa-console">
    <aside class="sa-sidebar">
      <div class="sa-sidebar-brand">
        <span class="sa-sidebar-icon">🛡️</span>
        <div>
          <strong>管理控制台</strong>
          <span class="sa-sidebar-sub">Super Admin</span>
        </div>
      </div>

      <nav class="sa-nav">
        <div class="sa-nav-section-label">用户管理</div>
        <button class="sa-nav-item sa-nav-active">
          <span class="sa-nav-dot"></span>
          全部用户
        </button>
      </nav>

      <div class="sa-sidebar-footer">
        <div class="sa-admin-badge">
          <span>●</span> 管理员已登录
        </div>
        <button class="sa-logout-btn" @click="$emit('logout')">退出管理</button>
      </div>
    </aside>

    <div class="sa-main">
      <header class="sa-topbar">
        <div class="sa-topbar-breadcrumb">
          <span class="sa-topbar-title">全部用户</span>
          <span class="sa-topbar-sub">共 {{ total }} 名用户</span>
        </div>
        <div class="sa-topbar-right">
          <div class="sa-stats-pills">
            <div class="sa-pill sa-pill-total">
              <span>总用户</span><strong>{{ total }}</strong>
            </div>
            <div class="sa-pill sa-pill-disabled">
              <span>已禁用</span><strong>{{ disabledCount }}</strong>
            </div>
            <div class="sa-pill sa-pill-active">
              <span>可登录</span><strong>{{ total - disabledCount }}</strong>
            </div>
          </div>
        </div>
      </header>

      <div class="sa-content">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup>
  defineProps({
    total: {
      type: Number,
      default: 0,
    },
    disabledCount: {
      type: Number,
      default: 0,
    },
  });

  defineEmits(['logout']);
</script>

<style scoped>
  .sa-console {
    position: fixed;
    inset: 0;
    display: flex;
    background: #f1f5f9;
    overflow: hidden;
  }

  .sa-sidebar {
    width: 240px;
    flex-shrink: 0;
    background: #0f172a;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .sa-sidebar-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 22px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .sa-sidebar-icon {
    font-size: 26px;
    filter: drop-shadow(0 0 8px rgba(129, 140, 248, 0.6));
  }

  .sa-sidebar-brand strong {
    display: block;
    color: #f1f5f9;
    font-size: 14px;
    font-weight: 700;
  }

  .sa-sidebar-sub {
    font-size: 11px;
    color: #475569;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .sa-nav {
    flex: 1;
    padding: 18px 12px;
    overflow-y: auto;
  }

  .sa-nav-section-label {
    font-size: 10px;
    font-weight: 600;
    color: #475569;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 0 8px 8px;
  }

  .sa-nav-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 10px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: #94a3b8;
    font-size: 13px;
    font-weight: 500;
    text-align: left;
  }

  .sa-nav-active {
    background: rgba(99, 102, 241, 0.18);
    color: #a5b4fc;
  }

  .sa-nav-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #6366f1;
    flex-shrink: 0;
  }

  .sa-sidebar-footer {
    padding: 16px 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .sa-admin-badge {
    font-size: 11px;
    color: #4ade80;
    font-weight: 500;
    letter-spacing: 0.02em;
  }

  .sa-admin-badge span {
    font-size: 8px;
    animation: sa-pulse 2s ease-in-out infinite;
  }

  @keyframes sa-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .sa-logout-btn {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    background: transparent;
    color: #94a3b8;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    text-align: center;
  }

  .sa-logout-btn:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }

  .sa-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .sa-topbar {
    height: 64px;
    flex-shrink: 0;
    background: #fff;
    border-bottom: 1px solid #e2e8f0;
    padding: 0 28px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }

  .sa-topbar-breadcrumb {
    display: flex;
    align-items: baseline;
    gap: 10px;
  }

  .sa-topbar-title {
    font-size: 16px;
    font-weight: 700;
    color: #0f172a;
  }

  .sa-topbar-sub {
    font-size: 13px;
    color: #64748b;
  }

  .sa-topbar-right {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .sa-stats-pills {
    display: flex;
    gap: 8px;
  }

  .sa-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 500;
  }

  .sa-pill span {
    opacity: 0.7;
  }

  .sa-pill strong {
    font-size: 14px;
    font-weight: 700;
  }

  .sa-pill-total {
    background: #eff6ff;
    color: #1e40af;
  }

  .sa-pill-disabled {
    background: #fef2f2;
    color: #991b1b;
  }

  .sa-pill-active {
    background: #f0fdf4;
    color: #14532d;
  }

  .sa-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px 28px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  @media (max-width: 900px) {
    .sa-console {
      flex-direction: column;
    }

    .sa-sidebar {
      width: 100%;
      flex-direction: row;
      align-items: center;
      height: 56px;
      padding: 0 12px;
    }

    .sa-sidebar-brand {
      padding: 0;
      border-bottom: none;
      flex: 1;
    }

    .sa-nav,
    .sa-admin-badge {
      display: none;
    }

    .sa-sidebar-footer {
      border: none;
      padding: 0;
      flex-direction: row;
    }

    .sa-logout-btn {
      width: auto;
      white-space: nowrap;
    }

    .sa-stats-pills,
    .sa-topbar-sub {
      display: none;
    }
  }
</style>
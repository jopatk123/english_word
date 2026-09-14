#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLIENT_DIR="$ROOT_DIR/client"
SERVER_DIR="$ROOT_DIR/server"
PID_FILE="$ROOT_DIR/.start-server.pid"
PORT="${PORT:-3010}"
CLIENT_PORT="${CLIENT_PORT:-5173}"
HOST="${HOST:-127.0.0.1}"

require_command() {
  local command_name="$1"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "缺少命令: $command_name"
    exit 1
  fi
}

ensure_dependencies() {
  local project_dir="$1"

  if [ ! -d "$project_dir/node_modules" ]; then
    echo "安装依赖: $project_dir"
    npm --prefix "$project_dir" install
  fi
}

ensure_port_available() {
  local port="$1"
  local pids
  pids="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)"

  if [ -n "$pids" ]; then
    echo "端口 $port 已被进程占用: $pids"
    echo "本地开发模式：主动结束占用进程并释放端口..."
    for pid in $pids; do
      kill "$pid" >/dev/null 2>&1 || true
    done

    # 等待进程退出、端口真正释放（最多约 5 秒）
    local remaining
    for _ in 1 2 3 4 5; do
      if ! lsof -ti tcp:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
        echo "端口 $port 已释放"
        return 0
      fi
      sleep 1
    done

    remaining="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null | tr '\n' ' ')"
    echo "端口 $port 仍有进程未退出: $remaining，请手动处理。"
    exit 1
  fi
}

stop_existing_process() {
  if [ -f "$PID_FILE" ]; then
    local existing_pids
    existing_pids="$(cat "$PID_FILE")"

    for existing_pid in $existing_pids; do
      if kill -0 "$existing_pid" >/dev/null 2>&1; then
        echo "停止旧服务进程: $existing_pid"
        kill "$existing_pid"
        wait "$existing_pid" 2>/dev/null || true
      fi
    done

    rm -f "$PID_FILE"
  fi

  ensure_port_available "$PORT"
  ensure_port_available "$CLIENT_PORT"
}

require_command node
require_command npm
require_command lsof

ensure_dependencies "$CLIENT_DIR"
ensure_dependencies "$SERVER_DIR"

# 启动后端 & 前端开发服务器（支持热重载）
stop_existing_process

echo "启动后端服务（dev 模式，支持热重载）..."
(
  cd "$SERVER_DIR"
  PORT="$PORT" HOST="$HOST" npm run dev
) &

server_pid=$!

echo "启动前端服务（Vite dev server）..."
(
  cd "$CLIENT_DIR"
  PORT="$CLIENT_PORT" npm run dev
) &

client_pid=$!

echo "$server_pid $client_pid" > "$PID_FILE"

cleanup() {
  for pid in $server_pid $client_pid; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
      wait "$pid" 2>/dev/null || true
    fi
  done
  rm -f "$PID_FILE"
}

trap cleanup INT TERM

# wait for the server to respond; no hard timeout
# the loop will only exit if the process dies or the endpoint becomes available
while ! curl -fsS "http://$HOST:$PORT/api/health" >/dev/null 2>&1; do
  if ! kill -0 "$server_pid" >/dev/null 2>&1; then
    echo "服务启动失败。"
    rm -f "$PID_FILE"
    exit 1
  fi
  sleep 1
done

echo "后端已启动: http://$HOST:$PORT"
echo "前端已启动 (Vite dev server): http://localhost:$CLIENT_PORT"

wait "$server_pid" "$client_pid"
exit 0

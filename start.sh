#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLIENT_DIR="$ROOT_DIR/client"
SERVER_DIR="$ROOT_DIR/server"
PID_FILE="$ROOT_DIR/.start-server.pid"
PORT="${PORT:-3010}"
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

stop_existing_process() {
  if [ -f "$PID_FILE" ]; then
    local existing_pid
    existing_pid="$(cat "$PID_FILE")"

    if kill -0 "$existing_pid" >/dev/null 2>&1; then
      echo "停止旧服务进程: $existing_pid"
      kill "$existing_pid"
      wait "$existing_pid" 2>/dev/null || true
    fi

    rm -f "$PID_FILE"
  fi

  local port_pid
  port_pid="$(lsof -ti tcp:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "$port_pid" ]; then
    echo "端口 $PORT 已被占用，尝试清理进程 $port_pid..."
    # 尝试终止监听该端口的进程
    if kill "$port_pid" >/dev/null 2>&1; then
      echo "已发送终止信号给进程 $port_pid，等待端口释放..."
      # 等待端口关闭，最多 5 秒
      for i in {1..5}; do
        sleep 1
        if ! lsof -ti tcp:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
          break
        fi
      done
    else
      echo "无法终止进程 $port_pid，请手动释放端口 $PORT 并重试。"
      exit 1
    fi
    # 如果在尝试后端口仍然被占用，则直接报错
    if lsof -ti tcp:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "端口 $PORT 仍被占用，无法启动。请手动处理。"
      exit 1
    fi
  fi
}

require_command node
require_command npm
require_command lsof

ensure_dependencies "$CLIENT_DIR"
ensure_dependencies "$SERVER_DIR"

echo "构建前端..."
npm --prefix "$CLIENT_DIR" run build

stop_existing_process

echo "启动后端服务..."
(
  cd "$SERVER_DIR"
  PORT="$PORT" HOST="$HOST" node index.js
) &

server_pid=$!
echo "$server_pid" > "$PID_FILE"

cleanup() {
  if kill -0 "$server_pid" >/dev/null 2>&1; then
    kill "$server_pid" >/dev/null 2>&1 || true
    wait "$server_pid" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
}

trap cleanup INT TERM

# wait for the server to respond; no hard timeout
# the loop will only exit if the process dies or the endpoint becomes available
while ! curl -fsS "http://$HOST:$PORT/api/roots" >/dev/null 2>&1; do
  if ! kill -0 "$server_pid" >/dev/null 2>&1; then
    echo "服务启动失败。"
    rm -f "$PID_FILE"
    exit 1
  fi
  sleep 1
done

echo "服务已启动: http://$HOST:$PORT"
wait "$server_pid"
exit 0
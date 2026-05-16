/**
 * 结构化日志工具
 *
 * 输出 JSON 格式日志，便于日志系统解析和聚合。
 * 每条日志包含 level、timestamp、msg 和可选的上下文字段。
 */

function log(level, msg, meta = {}) {
  const entry = { level, timestamp: new Date().toISOString(), msg, ...meta };
  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

const logger = {
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
};

export default logger;

/**
 * Express 请求日志中间件。
 * 记录每个请求的方法、URL、状态码和耗时（毫秒）。
 */
export function requestLogger(req, res, next) {
  const startMs = Date.now();
  res.on('finish', () => {
    logger.info('http', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - startMs,
    });
  });
  next();
}

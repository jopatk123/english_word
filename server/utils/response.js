import logger from './logger.js';

const response = (res, code, data, msg) => {
  res.status(code).json({ code, data, msg });
};

export const success = (res, data = null, msg = 'success') => {
  response(res, 200, data, msg);
};

/**
 * 分页列表响应：在响应体中额外携带 total 字段供前端分页使用。
 * 当 limit=0（不限量）时 total 仍会返回，前端可忽略。
 */
export const successList = (res, data, total, msg = 'success') => {
  res.status(200).json({ code: 200, data, total, msg });
};

export const error = (res, msg = '服务器内部错误', code = 500) => {
  response(res, code, null, msg);
};

/**
 * 从异常对象上解析出「可安全回传」的客户端错误状态码（4xx）。
 *
 * 兼容项目内三种写法：
 * - err.statusCode：自定义业务错误（ApiTokenError / AiConfigError 等）；
 * - err.status：http-errors 约定；
 * - err.code：路由内临时抛出的普通 Error（如 404 词根不存在）。
 */
const resolveClientErrorStatus = (e) => {
  const candidates = [e?.statusCode, e?.status, e?.code];
  return candidates.find((value) => Number.isInteger(value) && value >= 400 && value <= 499);
};

/**
 * 路由层 catch 分支的统一错误响应。
 *
 * 业务校验类错误（4xx）回传原始 message，方便前端提示；
 * 其余异常（5xx、数据库/运行时错误）折叠为兜底文案并记录日志，
 * 避免把 SQL 语句、堆栈、环境变量名等内部细节泄露给客户端。
 */
export const handleRouteError = (res, e, fallbackMsg = '服务器内部错误') => {
  const clientStatus = resolveClientErrorStatus(e);
  if (clientStatus && e?.message) {
    return error(res, e.message, clientStatus);
  }

  logger.error('route-error', {
    message: e?.message,
    stack: e?.stack,
    code: e?.code,
  });
  return error(res, fallbackMsg);
};

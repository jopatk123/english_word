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

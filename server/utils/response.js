const response = (res, code, data, msg) => {
  res.status(code === 200 ? 200 : 500).json({ code, data, msg });
};

export const success = (res, data = null, msg = 'success') => {
  response(res, 200, data, msg);
};

export const error = (res, msg = '服务器内部错误', code = 500) => {
  response(res, code, null, msg);
};

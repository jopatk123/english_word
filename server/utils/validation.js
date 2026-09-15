/**
 * 请求入参类型校验工具。
 *
 * 背景：写接口的文本字段会被 `.trim()` 消费，密码字段会被 bcrypt 消费。
 * 若客户端传入对象/数组/数字，这些调用会抛出 TypeError 变成 500，
 * 并把内部错误信息（如 "name.trim is not a function"）回传给客户端。
 * 因此在路由入口处先做类型校验，不合法时统一返回 400。
 */

/** 必填字符串字段：只接受字符串类型（空串由业务规则另行判断） */
export const isString = (value) => typeof value === 'string';

/** 可选字符串字段：未填写（undefined / null）视为合法 */
export const isOptionalString = (value) =>
  value === undefined || value === null || typeof value === 'string';

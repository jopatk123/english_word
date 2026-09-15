import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';
import { success, error, handleRouteError } from '../utils/response.js';
import { isString } from '../utils/validation.js';
import { generateToken, authMiddleware } from '../middleware/auth.js';
import { loginAccountRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// 注册
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return error(res, '用户名和密码为必填项', 400);
    if (!isString(username) || !isString(password)) {
      return error(res, '用户名和密码必须为字符串', 400);
    }

    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 2 || trimmedUsername.length > 30) {
      return error(res, '用户名长度需在 2-30 个字符之间', 400);
    }
    if (password.length < 6 || password.length > 100) {
      return error(res, '密码长度需在 6-100 个字符之间', 400);
    }

    const existingUser = await User.findOne({ where: { username: trimmedUsername } });
    // 中性提示：不直接确认用户名是否已存在，避免被用来批量枚举已注册账号
    if (existingUser) return error(res, '用户名不可用，请更换后重试', 400);

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ username: trimmedUsername, password: hashedPassword });
    const token = generateToken(user);

    success(res, { token, user: { id: user.id, username: user.username } }, '注册成功');
  } catch (e) {
    handleRouteError(res, e);
  }
});

// 登录（账号级失败限流 + 全局 IP 限流双重保护）
router.post('/login', loginAccountRateLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return error(res, '用户名和密码为必填项', 400);
    if (!isString(username) || !isString(password)) {
      return error(res, '用户名和密码必须为字符串', 400);
    }

    const user = await User.findOne({ where: { username: username.trim() } });
    if (!user) return error(res, '用户名或密码错误', 401);
    if (user.isDisabled) return error(res, '账号已被禁用，请联系管理员', 401);

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return error(res, '用户名或密码错误', 401);

    const token = generateToken(user);
    success(res, { token, user: { id: user.id, username: user.username } }, '登录成功');
  } catch (e) {
    handleRouteError(res, e);
  }
});

// 获取当前用户信息
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId, { attributes: ['id', 'username'] });
    if (!user) return error(res, '用户不存在', 404);
    success(res, { id: user.id, username: user.username });
  } catch (e) {
    handleRouteError(res, e);
  }
});

export default router;

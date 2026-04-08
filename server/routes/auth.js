import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';
import { success, error } from '../utils/response.js';
import { generateToken, authMiddleware } from '../middleware/auth.js';

const router = Router();

// 注册
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return error(res, '用户名和密码为必填项', 400);

    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 2 || trimmedUsername.length > 30) {
      return error(res, '用户名长度需在 2-30 个字符之间', 400);
    }
    if (password.length < 6 || password.length > 100) {
      return error(res, '密码长度需在 6-100 个字符之间', 400);
    }

    const existingUser = await User.findOne({ where: { username: trimmedUsername } });
    if (existingUser) return error(res, '用户名已存在', 400);

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ username: trimmedUsername, password: hashedPassword });
    const token = generateToken(user.id);

    success(res, { token, user: { id: user.id, username: user.username } }, '注册成功');
  } catch (e) {
    error(res, e.message);
  }
});

// 登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return error(res, '用户名和密码为必填项', 400);

    const user = await User.findOne({ where: { username: username.trim() } });
    if (!user) return error(res, '用户名或密码错误', 401);
    if (user.isDisabled) return error(res, '账号已被禁用，请联系管理员', 401);

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return error(res, '用户名或密码错误', 401);

    const token = generateToken(user.id);
    success(res, { token, user: { id: user.id, username: user.username } }, '登录成功');
  } catch (e) {
    error(res, e.message);
  }
});

// 获取当前用户信息
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId, { attributes: ['id', 'username'] });
    if (!user) return error(res, '用户不存在', 404);
    success(res, { id: user.id, username: user.username });
  } catch (e) {
    error(res, e.message);
  }
});

export default router;

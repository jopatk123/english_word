import { ElMessage } from 'element-plus';

// show a toast message that disappears after ~3 seconds
export function showMsg(msg, type = 'info', duration = 3000) {
  ElMessage({
    message: msg,
    type,
    duration,
  });
}

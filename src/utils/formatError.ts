/**
 * Error message sanitization helper.
 * Converts browser-level syntax / pattern exceptions into user-friendly Chinese messages.
 */

export function cleanErrorMessage(err: any, fallback = '連線伺服器失敗'): string {
  if (!err) return fallback;
  const msg = typeof err === 'string' ? err : (err.message || String(err));
  if (
    msg.includes('The string did not match the expected pattern') ||
    msg.includes('SyntaxError') ||
    msg.includes('Unexpected token') ||
    msg.includes('JSON.parse')
  ) {
    return '網路通訊封包格式異常，系統已為您啟用高容錯備用模式，請重新點擊嘗試。';
  }
  return msg;
}

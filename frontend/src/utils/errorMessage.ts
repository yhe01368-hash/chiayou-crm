/**
 * 從 Axios / FastAPI error 抽出使用者看得懂的訊息。
 *
 * 為什麼需要這個：
 * 後端 FastAPI 失敗時會回 { "detail": ... }，但前端如果沒有處理，
 * 按了「儲存」畫面就完全沒反應，使用者以為當機。
 * 所有表單的 onError 都應該呼叫這個函式把訊息顯示出來。
 */
export function extractErrorMessage(err: any, fallback = '操作失敗，請稍後再試'): string {
  const detail = err?.response?.data?.detail;

  // 純字串：後端直接給的訊息，例如「商品編號已存在」
  if (typeof detail === 'string') return detail;

  // 陣列：FastAPI 422 驗證錯誤
  if (Array.isArray(detail)) {
    const parts = detail.map((d: any) => {
      const field = (d.loc || []).slice(1).join('.');
      return field ? `${field}: ${d.msg}` : d.msg;
    });
    return parts.join('；') || fallback;
  }

  // 網路層錯誤（斷線、CORS、逾時）
  if (err?.message) return err.message;
  return fallback;
}
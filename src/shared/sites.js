// Pure metadata; paths are relative to Vite BASE_URL, not the current document.
export const sites = Object.freeze([
  Object.freeze({ id: 'explorer', label: '資料探索地圖', status: 'available', statusLabel: '可使用', path: 'explorer/index.html', description: '完整保留點位、密度、區里、人行道與樹種分析，從官方開放資料開始探索。' }),
  Object.freeze({ id: 'stories', label: '樹木故事', status: 'prototype', statusLabel: '試作・內容待補', path: 'stories/index.html', description: '樹木與城市記憶的故事版型試作。尚無正式故事，也沒有投稿或儲存功能。' }),
  Object.freeze({ id: '02', label: '工作區 02', status: 'provisional', statusLabel: '功能待定', path: 'workspaces/02/index.html', description: '獨立開發入口。尚未定義功能，目前僅為預留頁面。' }),
  Object.freeze({ id: '03', label: '工作區 03', status: 'provisional', statusLabel: '功能待定', path: 'workspaces/03/index.html', description: '獨立開發入口。尚未定義功能，目前僅為預留頁面。' }),
]);
export const siteHref = site => import.meta.env.BASE_URL + site.path;

// Pure metadata; paths are relative to Vite BASE_URL, not the current document.
export const sites = Object.freeze([
  Object.freeze({ id: 'explorer', label: '資料探索地圖', status: 'available', statusLabel: '可使用', path: 'explorer/index.html', description: '完整保留點位、密度、區里、人行道與樹種分析，從官方開放資料開始探索。' }),
  Object.freeze({ id: 'stories', label: '樹木故事', status: 'prototype', statusLabel: '文化資料表・試作', path: 'stories/index.html', description: '查閱樹木與城市記憶的歷史文化資料表，保留來源、年代與查證限制；另有故事互動試作。' }),
  Object.freeze({ id: '02', label: 'Social Game 公園', status: 'prototype', statusLabel: '里環境護照・試作', path: 'workspaces/02/index.html', description: '探索臺北456里：管理樹木、受保護樹木、名稱豐富度與清潔箱的資料護照；原生與鳥蟲指標待資料。' }),
  Object.freeze({ id: '03', label: '工作區 03', status: 'provisional', statusLabel: '功能待定', path: 'workspaces/03/index.html', description: '獨立開發入口。尚未定義功能，目前僅為預留頁面。' }),
]);
export const siteHref = site => import.meta.env.BASE_URL + site.path;

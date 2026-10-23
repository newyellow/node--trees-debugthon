import './portal.css';
import { sites, siteHref } from '../shared/sites.js';
const list = document.querySelector('#site-list');
for (const [index, site] of sites.entries()) {
  const item = document.createElement('li');
  const link = document.createElement('a');
  link.className = 'site-card ' + site.status; link.href = siteHref(site);
  const number = document.createElement('span'); number.className = 'card-number'; number.textContent = String(index + 1).padStart(2, '0'); number.setAttribute('aria-hidden', 'true');
  const status = document.createElement('span'); status.className = 'status'; status.textContent = site.statusLabel;
  const title = document.createElement('h3'); title.textContent = site.label;
  const description = document.createElement('p'); description.textContent = site.description;
  const action = document.createElement('span'); action.className = 'card-action'; action.textContent = site.status === 'available' ? '進入地圖 →' : site.status === 'prototype' ? '查看試作頁面 →' : '查看預留頁面 →';
  link.append(number, status, title, description, action); item.append(link); list.append(item);
}

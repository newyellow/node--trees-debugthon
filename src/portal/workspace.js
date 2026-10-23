import './portal.css';
import { sites, siteHref } from '../shared/sites.js';
const site = sites.find(site => site.id === document.querySelector('[data-workspace]').dataset.workspace);
document.querySelector('#workspace-title').textContent = site.label;
document.querySelector('#explorer-link').href = siteHref(sites.find(site => site.id === 'explorer'));

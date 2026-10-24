/** One standard GA4 snippet per production HTML entry; no development traffic. */
export const MEASUREMENT_ID = 'G-DVFB0184YR';
export const GTAG_SOURCE = 'https://www.googletagmanager.com/gtag/js?id=' + MEASUREMENT_ID;
export const GTAG_INITIALIZER = 'window.dataLayer ||= [];\nfunction gtag(){dataLayer.push(arguments);}\ngtag("js", new Date());\ngtag("config", "' + MEASUREMENT_ID + '");';
export function googleAnalyticsPlugin() {
  return {
    name: 'production-google-analytics',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (/googletagmanager\.com|google-analytics\.com|\bgtag\s*\(/i.test(html)) throw new Error('Analytics already exists in this HTML entry; refusing duplicate injection');
        return [
          {tag:'script',attrs:{async:true,src:GTAG_SOURCE},injectTo:'head-prepend'},
          {tag:'script',children:GTAG_INITIALIZER,injectTo:'head-prepend'},
        ];
      },
    },
  };
}

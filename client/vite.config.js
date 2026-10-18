import { defineConfig, createLogger, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { purgeCSSPlugin as purgeCSS } from '@fullhuman/postcss-purgecss';

/**
 * Saat build produksi, kelas CSS Bootstrap & Bootstrap Icons yang tidak dipakai dibuang (PurgeCSS).
 * Ikon dipanggil dinamis (`bi-${icon}`), jadi setiap kata di kode juga dianggap calon nama ikon.
 */
const purge = purgeCSS({
  content: ['./index.html', './src/**/*.{js,jsx}'],
  defaultExtractor: (text) => {
    const words = text.match(/[\w-/:%.]+(?<!:)/g) || [];
    return [...words, ...words.map((w) => `bi-${w}`)];
  },
  safelist: {
    standard: [/^bi-toggle-/, 'show', 'fade', 'active', 'disabled'],
    greedy: [/^was-validated/],
  },
});

/**
 * Saat API di-restart (node --watch menyala ulang setiap file server diubah), request yang sedang
 * berjalan terputus dan Vite mencetak "http proxy error ... ECONNRESET" lengkap dengan stack trace.
 * Pesan itu diringkas menjadi satu baris, maksimal sekali per 3 detik.
 */
const logger = createLogger();
const logError = logger.error;
let lastProxyLog = 0;
logger.error = (msg, opts) => {
  const code = opts?.error?.code;
  if (msg.includes('http proxy error') && ['ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'ECONNABORTED'].includes(code)) {
    if (Date.now() - lastProxyLog > 3000) logger.warn(`API belum siap (${code}), menunggu server menyala kembali…`, { timestamp: true });
    lastProxyLog = Date.now();
    return;
  }
  logError(msg, opts);
};

/**
 * Pratinjau tautan (WhatsApp, Facebook, dll.) butuh alamat lengkap aplikasi untuk og:url & og:image.
 * Sumber: SITE_URL / VITE_SITE_URL saat build (npm run pack:cpanel -- https://domain), atau domain produksi Vercel.
 * Tanpa alamat, kedua tag itu dibuang dan pratinjau tetap tampil tanpa gambar.
 */
function siteUrl(mode) {
  const env = loadEnv(mode, process.cwd(), '');
  const url = env.SITE_URL || env.VITE_SITE_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
  return url.trim().replace(/\/+$/, '');
}
const ogTags = (mode) => ({
  name: 'og-site-url',
  transformIndexHtml(html) {
    const url = siteUrl(mode);
    return url ? html.replaceAll('%SITE_URL%', url) : html.replace(/^\s*<meta property="og:(url|image)" content="%SITE_URL%[^>]*>\n/gm, '');
  },
});

export default defineConfig(({ command, mode }) => ({
  customLogger: logger,
  // mode penyimpanan file untuk client: 'blob' jika build di Vercel dengan Blob store terhubung (token tidak ikut ke browser)
  define: { __UPLOAD_MODE__: JSON.stringify(process.env.BLOB_READ_WRITE_TOKEN ? 'blob' : 'local') },
  plugins: [react(), ogTags(mode)],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        // API sedang restart (mis. setelah file server diubah): balas 503 singkat, bukan stack trace di terminal
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            if (res && !res.headersSent && typeof res.writeHead === 'function') {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ message: 'Server sedang dimuat ulang. Coba lagi sebentar.' }));
            }
          });
        },
      },
    },
  },
  css: { postcss: { plugins: command === 'build' ? [purge] : [] } },
  build: {
    rollupOptions: {
      output: {
        // pustaka pihak ketiga dipisah agar tetap tersimpan di cache browser saat kode aplikasi berubah
        manualChunks: { vendor: ['react', 'react-dom', 'react-router', 'react-router-dom', 'axios'] },
      },
    },
  },
}));

/**
 * Mode Vercel: izin unggah langsung dari browser ke Vercel Blob (privat).
 * Browser meminta token di sini (wajib login), lalu mengirim file langsung ke Blob tanpa melewati fungsi Vercel,
 * sehingga batas ukuran request fungsi (±4,5 MB) tidak berlaku. Kunci file yang didapat dikirim ke route biasa.
 */
const router = require('express').Router();
const path = require('path');
const { requireAuth } = require('../middleware/auth');
const storage = require('../utils/storage');
const { DOC_EXT } = require('../utils/upload');

router.post('/blob', requireAuth, async (req, res, next) => {
  try {
    if (!storage.IS_BLOB) return res.status(404).json({ message: 'Unggah langsung hanya untuk hosting Vercel.' });
    const { handleUpload } = require('@vercel/blob/client');
    const out = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!storage.validBlobKey(pathname) || !DOC_EXT.includes(path.extname(pathname).toLowerCase())) {
          throw Object.assign(new Error('Format file harus PDF, Word, ZIP, JPG, atau PNG.'), { status: 400 });
        }
        return { addRandomSuffix: true, maximumSizeInBytes: storage.MAX_MB * 1024 * 1024, tokenPayload: String(req.user.id) };
      },
    });
    res.json(out);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
});

module.exports = router;

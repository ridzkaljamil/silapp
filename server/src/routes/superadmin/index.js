/** Khusus Super Admin: pengguna, master layanan, daftar harga lab, ruang lingkup, form pengajuan, survei, log email. */
const router = require('express').Router();
const { requireAuth, allow } = require('../../middleware/auth');

router.use(requireAuth, allow('superadmin'));
for (const part of ['users', 'services', 'prices', 'scope', 'forms', 'survey', 'emails']) router.use(require(`./${part}`));

module.exports = router;

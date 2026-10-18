/** Template dokumen Word untuk diunduh pelanggan; Super Admin dapat mengganti filenya. */
import { useCallback, useEffect, useState } from 'react';
import api, { errMsg, download } from '../../api';
import { useAuth } from '../../AuthContext';
import { PageHead, Loading, useToast, useConfirm, fmtDate, MAX_FILE_MB } from '../../components/ui';

export default function TemplateDokumen() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(null);
  const load = useCallback(() => api.get('/templates').then((r) => setRows(r.data)), []);
  useEffect(() => { load(); }, [load]);
  if (!rows) return <Loading />;
  const sa = user.role === 'superadmin';

  const replace = async (t, file) => {
    if (!file) return;
    if (file.size > MAX_FILE_MB * 1024 * 1024) return toast(`${file.name} melebihi ${MAX_FILE_MB} MB.`, 'danger');
    if (!(await confirm({ title: 'Ganti Template?', body: <>Template <b>{t.name}</b> diganti dengan <b>{file.name}</b>. Pelanggan langsung mengunduh file baru ini.</>, ok: 'Ya, Ganti', icon: 'file-earmark-arrow-up' }))) return;
    const fd = new FormData();
    fd.append('file', file);
    setBusy(t.id);
    try { await api.put(`/templates/${t.id}`, fd); toast(`Template ${t.name} diganti.`); load(); } catch (e) { toast(errMsg(e), 'danger'); } finally { setBusy(null); }
  };

  return (
    <>
      <PageHead eyebrow="Dokumen" title="Template Dokumen"
        sub={sa ? 'Template Word yang diunduh pelanggan saat mengajukan Sertifikasi Produk. Ganti file jika ada format baru.' : 'Unduh, isi, lalu tanda tangani template berikut. Unggah hasilnya di Langkah 3 saat mengajukan Sertifikasi Produk.'} />
      <section className="panel">
        <ul className="tpl-list">
          {rows.map((t) => (
            <li key={t.id}>
              <span className="tpl-ic" aria-hidden="true"><i className="bi bi-file-earmark-word" /></span>
              <span className="tpl-tx">
                <b>{t.name}</b>
                {t.description && <span>{t.description}</span>}
                <span className="small text-muted2">{t.original_name} · diperbarui {fmtDate(t.updated_at)}</span>
              </span>
              <span className="tpl-acts">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => download(`/templates/${t.id}/download`, t.original_name)}><i className="bi bi-download" />Unduh</button>
                {sa && (
                  <>
                    <input type="file" id={`tpl-${t.id}`} className="visually-hidden" accept=".doc,.docx" onChange={(e) => { replace(t, e.target.files[0]); e.target.value = ''; }} />
                    <label htmlFor={`tpl-${t.id}`} className={`btn btn-outline-secondary btn-sm ${busy === t.id ? 'disabled' : ''}`}><i className="bi bi-arrow-repeat" />{busy === t.id ? 'Mengunggah…' : 'Ganti File'}</label>
                  </>
                )}
              </span>
            </li>
          ))}
          {!rows.length && <li className="text-muted2 justify-content-center">Belum ada template.</li>}
        </ul>
      </section>
    </>
  );
}

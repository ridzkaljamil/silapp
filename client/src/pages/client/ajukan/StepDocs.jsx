/** Langkah 3: unggah berkas persyaratan dan dokumen pendukung lain. */
import { download } from '../../../api';
import { FILE_ACCEPT, FILE_HINT } from '../../../components/ui';

export default function StepDocs({ x }) {
  const { code, docList, docs, extraDocs, guard, needDoc, setDocs, setExtra, setExtraDocs, sp, templateOf } = x;
  return (
    <div className="d-flex flex-column gap-2">
      {docList.map((d) => {
        const byAdmin = !!d.admin_if_package && sp.is_package && code === 'SP';
        const file = docs[d.name];
        const tpl = templateOf(d.name);
        const id = `doc-${d.id}`;
        return (
          <div key={d.id} className={`doc-row ${file ? 'has-file' : ''}`}>
            <div className="flex-grow-1 min-w-0"><b>{d.name}</b>{needDoc(d) && <span className="text-danger"> *</span>}
              <div className="small text-muted2">{byAdmin ? 'Paket LSPro + Lab: disiapkan oleh Admin PSU (opsional bagi Anda)' : file ? <span style={{ color: 'var(--ok)' }}><i className="bi bi-check-circle-fill me-1" />{file.name}</span> : FILE_HINT}</div>
              {tpl && <button type="button" className="btn btn-link btn-sm p-0 mt-1" onClick={() => download(`/templates/${tpl.id}/download`, tpl.original_name)}><i className="bi bi-file-earmark-word" />Unduh Template</button>}
            </div>
            <input type="file" id={id} className="visually-hidden" accept={FILE_ACCEPT} onChange={(e) => { const [f0] = guard(e.target.files); if (f0) setDocs({ ...docs, [d.name]: f0 }); e.target.value = ''; }} />
            <label htmlFor={id} className={`btn btn-sm ${file ? 'btn-outline-secondary' : 'btn-primary'}`}><i className={`bi bi-${file ? 'arrow-repeat' : 'upload'}`} />{file ? 'Ganti File' : 'Pilih File'}</label>
            {file && <button type="button" className="btn btn-sm btn-outline-danger" aria-label={`Hapus ${d.name}`} onClick={() => setDocs({ ...docs, [d.name]: null })}><i className="bi bi-x-lg" /></button>}
          </div>
        );
      })}
      <div className="extra-docs">
        <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
          <span><b>Dokumen Pendukung Lainnya</b> <span className="small text-muted2">(opsional)</span></span>
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={extraDocs.length >= 8} onClick={() => setExtraDocs([...extraDocs, { name: '', file: null }])}><i className="bi bi-plus-lg" />Tambah Dokumen</button>
        </div>
        {extraDocs.map((x, i) => (
          <div key={i} className={`doc-row mt-2 ${x.file ? 'has-file' : ''}`}>
            <input className="form-control flex-grow-1" style={{ minWidth: 180, flexBasis: 220 }} placeholder="Nama dokumen, mis. Brosur Produk" aria-label={`Nama dokumen pendukung ${i + 1}`} value={x.name} onChange={(e) => setExtra(i, 'name', e.target.value)} />
            <input type="file" id={`xd-${i}`} className="visually-hidden" accept={FILE_ACCEPT} onChange={(e) => { const [f0] = guard(e.target.files); if (f0) setExtra(i, 'file', f0); e.target.value = ''; }} />
            <label htmlFor={`xd-${i}`} className={`btn btn-sm ${x.file ? 'btn-outline-secondary' : 'btn-primary'} text-truncate`} style={{ maxWidth: 220 }}><i className={`bi bi-${x.file ? 'arrow-repeat' : 'upload'}`} />{x.file ? x.file.name : 'Pilih File'}</label>
            <button type="button" className="btn btn-sm btn-outline-danger" aria-label={`Hapus dokumen pendukung ${i + 1}`} onClick={() => setExtraDocs(extraDocs.filter((_, n) => n !== i))}><i className="bi bi-trash" /></button>
          </div>
        ))}
      </div>
      <div className="small text-muted2"><span className="text-danger">*</span> wajib. Template surat dapat diunduh di menu Template Dokumen.</div>
    </div>
  );
}

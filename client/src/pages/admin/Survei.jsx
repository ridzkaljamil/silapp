/** Survei kepuasan pelanggan: hasil & pengaturan (Super Admin). */
import { useEffect, useState, useCallback } from 'react';
import api, { errMsg } from '../../api';
import { PageHead, Loading, useToast, fmtDate } from '../../components/ui';

export default function Survei() {
  const toast = useToast();
  const [d, setD] = useState(null);
  const [qs, setQs] = useState([]);
  const [thanks, setThanks] = useState('');
  const load = useCallback(() => api.get('/superadmin/survey').then((r) => { setD(r.data); setQs(r.data.questions.filter((x) => x.is_active)); setThanks(r.data.thank_you_text); }), []);
  useEffect(() => { load(); }, [load]);
  if (!d) return <Loading />;
  const save = async () => {
    const removed = d.questions.filter((x) => x.is_active && !qs.some((y) => y.id === x.id)).map((x) => ({ ...x, deleted: true }));
    try { await api.put('/superadmin/survey', { questions: [...qs, ...removed], thank_you_text: thanks }); toast('Pengaturan survei disimpan.'); load(); } catch (ex) { toast(errMsg(ex), 'danger'); }
  };
  const avgAll = d.summary.length ? (d.summary.reduce((t, x) => t + +x.avg, 0) / d.summary.length).toFixed(2) : '—';
  return (
    <>
      <PageHead eyebrow="Super Admin" title="Survei kepuasan pelanggan" sub="Survei wajib diisi pelanggan sebelum mengunduh sertifikat atau LHU, untuk setiap penerbitan dokumen." />
      <div className="row g-3 mb-3">
        {[['Responden', d.total], ['Rata-rata keseluruhan', avgAll], ['Pertanyaan aktif', qs.length]].map(([k, v]) => <div className="col-6 col-md-4" key={k}><div className="stat"><div className="v num">{v}</div><div className="k">{k}</div></div></div>)}
      </div>
      <div className="row g-3">
        <div className="col-lg-6">
          <section className="panel h-100">
            <div className="panel-h"><h2 className="mb-0">Hasil per pertanyaan</h2><span className="small text-muted2">skala 1–5</span></div>
            <div className="panel-b small">
              {d.summary.length ? d.summary.map((x) => (
                <div key={x.question} className="mb-2">
                  <div className="d-flex justify-content-between gap-2"><span>{x.question}</span><b className="num">{x.avg}</b></div>
                  <div className="pbar"><i style={{ width: `${(x.avg / 5) * 100}%` }} /></div>
                </div>
              )) : <p className="text-muted2 mb-0">Belum ada survei yang diisi.</p>}
              {d.per_service.length > 0 && <><div className="eyebrow mt-3 mb-1">Per layanan</div>{d.per_service.map((x) => <div key={x.service} className="d-flex justify-content-between"><span>{x.service} ({x.n} responden)</span><b className="num">{x.avg}</b></div>)}</>}
            </div>
          </section>
        </div>
        <div className="col-lg-6">
          <section className="panel h-100">
            <div className="panel-h"><h2 className="mb-0">Saran terbaru</h2></div>
            <ul className="list-group list-group-flush small">
              {d.recent.filter((x) => x.suggestion).map((x, i) => <li key={i} className="list-group-item"><div className="text-muted2">{x.company_name} · {x.application_no} · {fmtDate(x.created_at)} · rata-rata {x.avg}</div>{x.suggestion}</li>)}
              {!d.recent.some((x) => x.suggestion) && <li className="list-group-item text-muted2">Belum ada saran.</li>}
            </ul>
          </section>
        </div>
        <div className="col-12">
          <section className="panel">
            <div className="panel-h"><h2 className="mb-0">Pengaturan survei</h2></div>
            <div className="panel-b d-flex flex-column gap-2">
              <span className="form-label mb-0">Pertanyaan (skala 1–5)</span>
              {qs.map((x, i) => (
                <div key={x.id || `n${i}`} className="input-group input-group-sm">
                  <span className="input-group-text num">{i + 1}</span>
                  <input className="form-control" aria-label={`Pertanyaan ${i + 1}`} value={x.question} onChange={(e) => setQs(qs.map((y, j) => (j === i ? { ...y, question: e.target.value } : y)))} />
                  <button className="btn btn-outline-danger" aria-label="Hapus pertanyaan" onClick={() => setQs(qs.filter((_, j) => j !== i))}><i className="bi bi-x-lg" /></button>
                </div>
              ))}
              <button className="btn btn-sm btn-outline-secondary align-self-start" onClick={() => setQs([...qs, { question: '' }])}>+ Tambah pertanyaan</button>
              <label className="form-label mb-0 mt-2" htmlFor="ty">Ucapan terima kasih setelah survei</label>
              <textarea id="ty" className="form-control" rows={3} value={thanks} onChange={(e) => setThanks(e.target.value)} />
              <div><button className="btn btn-primary" onClick={save}>Simpan pengaturan</button></div>
              <span className="small text-muted2">Pertanyaan yang dihapus tidak memengaruhi jawaban yang sudah masuk (teks pertanyaan disimpan bersama jawaban).</span>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

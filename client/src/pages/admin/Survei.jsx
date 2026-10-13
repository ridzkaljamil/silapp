/** Survei kepuasan pelanggan per layanan: rekap, tindak lanjut, ekspor, pengaturan (Super Admin). */
import { useEffect, useState, useCallback } from 'react';
import api, { errMsg, download } from '../../api';
import { PageHead, Loading, useToast, fmtDate, fmtDateTime, MobileList, Sheet, DataToolbar, matchText } from '../../components/ui';

const TABS = [['SP', 'LSPro'], ['LAB', 'Lab Pengujian'], ['KAL', 'Lab Kalibrasi']];
const avgText = (v) => (v === null || v === undefined ? '—' : String((+v).toFixed(2)).replace('.', ','));
const contactText = (r) => (r.contact_ok === 1 ? `Ya${r.contact_info ? ` · ${r.contact_info}` : ''}` : r.contact_ok === 0 ? 'Tidak' : '—');

/** Detail satu responden + riwayat tindak lanjut. */
function ResponseSheet({ id, onClose, onChanged }) {
  const toast = useToast();
  const [r, setR] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => (id ? api.get(`/superadmin/survey/responses/${id}`).then((x) => setR(x.data)) : setR(null)), [id]);
  useEffect(() => { setNote(''); load(); }, [load]);
  const add = async () => {
    if (!note.trim()) return toast('Isi catatan tindak lanjut.', 'danger');
    setBusy(true);
    try { await api.post(`/superadmin/survey/responses/${id}/followups`, { note }); setNote(''); toast('Tindak lanjut dicatat.'); load(); onChanged(); } catch (e) { toast(errMsg(e), 'danger'); } finally { setBusy(false); }
  };
  return (
    <Sheet open={!!id} onClose={onClose} wide icon="clipboard-check" title={r ? r.company_name : 'Memuat…'} sub={r && `${r.respondent_name} · ${fmtDate(r.created_at)} · rata-rata ${avgText(r.avg_score)}`}>
      {!r ? <Loading /> : (
        <div className="d-flex flex-column gap-3 small">
          <dl className="dl-grid mb-0">
            <dt>No. layanan</dt><dd className="mono">{r.reference_no || '—'}</dd>
            <dt>Pengajuan</dt><dd><span className="mono">{r.application_no}</span> · {r.service_name}</dd>
            <dt>Bersedia dihubungi</dt><dd>{contactText(r)}</dd>
          </dl>
          <table className="table table-sm mb-0"><tbody>{r.answers.map((a, i) => <tr key={i}><td><span className="text-muted2 num">{i + 1}.</span> {a.question}</td><td className="text-end num fw-semibold">{a.score}</td></tr>)}</tbody></table>
          <div><b className="d-block mb-1">Saran dan Masukan</b>{r.suggestion || <span className="text-muted2">Tidak ada.</span>}</div>
          <div>
            <b className="d-block mb-1">Riwayat Tindak Lanjut</b>
            {r.followup_list.length ? (
              <ul className="list-unstyled mb-2 d-flex flex-column gap-2">{r.followup_list.map((f) => <li key={f.id} className="border rounded p-2"><div className="text-muted2">{fmtDateTime(f.created_at)} · {f.user_name || '—'}</div>{f.note}</li>)}</ul>
            ) : <p className="text-muted2 mb-2">Belum ada tindak lanjut.</p>}
            <label className="form-label" htmlFor="fu">Catat Tindak Lanjut</label>
            <textarea id="fu" className="form-control" rows={2} placeholder="Mis. sudah menghubungi pelanggan, perbaikan yang dilakukan" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn btn-primary btn-sm mt-2" disabled={busy} onClick={add}>{busy ? 'Menyimpan…' : 'Simpan Tindak Lanjut'}</button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

export default function Survei() {
  const toast = useToast();
  const [bidang, setBidang] = useState('SP');
  const [d, setD] = useState(null);
  const [qs, setQs] = useState([]);
  const [intro, setIntro] = useState('');
  const [thanks, setThanks] = useState('');
  const [open, setOpen] = useState(null);
  const [q, setQ] = useState('');
  const [flt, setFlt] = useState({ contact: '', followup: '', score: '' });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState('');
  const fill = (x) => { setQs(x.questions.filter((y) => y.is_active)); setIntro(x.intro); setThanks(x.thank_you_text); };
  const load = useCallback(() => api.get('/superadmin/survey', { params: { bidang } }).then((r) => {
    setD(r.data); fill(r.data);
  }), [bidang]);
  useEffect(() => { load(); }, [load]);
  // data tab lama tidak ditampilkan saat tab baru masih dimuat
  const ready = d && d.bidang === bidang;

  const save = async () => {
    const removed = d.questions.filter((x) => x.is_active && !qs.some((y) => y.id === x.id)).map((x) => ({ ...x, deleted: true }));
    setSaving(true);
    try {
      const r = await api.put('/superadmin/survey', { bidang, questions: [...qs, ...removed], intro, thank_you_text: thanks });
      setD({ ...d, ...r.data }); fill(r.data); setEditing(false); toast('Pengaturan survei disimpan.');
    } catch (ex) { toast(errMsg(ex), 'danger'); } finally { setSaving(false); }
  };
  const cancelEdit = () => { fill(d); setEditing(false); };
  const exp = async (format) => {
    setExporting(format);
    try { await download(`/superadmin/survey/export?bidang=${bidang}&format=${format}`, `rekap-survei-${bidang.toLowerCase()}.${format}`); } catch (e) { toast(errMsg(e), 'danger'); } finally { setExporting(''); }
  };
  if (!d) return <Loading />;
  const cnt = Object.fromEntries(d.counts.map((c) => [c.bidang, c]));
  const cur = cnt[bidang] || { n: 0, avg: null };
  const contactable = d.responses.filter((r) => r.contact_ok === 1).length;
  const resp = d.responses.filter((r) => matchText(q, r.company_name, r.respondent_name, r.reference_no, r.application_no, r.suggestion)
    && (!flt.contact || (flt.contact === 'ya') === (r.contact_ok === 1))
    && (!flt.followup || (flt.followup === 'sudah') === !!r.followups)
    && (!flt.score || (flt.score === 'rendah' ? +r.avg_score < 3 : +r.avg_score >= 3)));
  const respEmpty = d.responses.length ? 'Tidak ada responden yang cocok dengan pencarian atau filter.' : 'Belum ada survei yang diisi untuk layanan ini.';
  const filters = [
    { key: 'score', label: 'Rata-rata Nilai', options: [['rendah', 'Di Bawah 3'], ['baik', '3 ke Atas']] },
    { key: 'contact', label: 'Bersedia Dihubungi', options: [['ya', 'Ya'], ['tidak', 'Tidak']] },
    { key: 'followup', label: 'Tindak Lanjut', options: [['belum', 'Belum Ada'], ['sudah', 'Sudah Dicatat']] },
  ];
  const switchTab = (k) => { if (k === bidang) return; setBidang(k); setQ(''); setFlt({ contact: '', followup: '', score: '' }); setEditing(false); };

  return (
    <>
      <PageHead eyebrow="Pengaturan" title="Survei Kepuasan Pelanggan" sub="Hasil survei yang diisi pelanggan sebelum mengunduh sertifikat atau LHU, dipisah per layanan. Catat tindak lanjut atas masukan, dan atur pertanyaannya di bagian bawah.">
        <button className="btn btn-outline-secondary" onClick={() => exp('xlsx')} disabled={!ready || !d.responses.length || !!exporting}><i className="bi bi-file-earmark-spreadsheet" />{exporting === 'xlsx' ? 'Mengekspor…' : 'Ekspor Excel'}</button>
        <button className="btn btn-outline-secondary" onClick={() => exp('csv')} disabled={!ready || !d.responses.length || !!exporting}>{exporting === 'csv' ? 'Mengekspor…' : 'CSV'}</button>
      </PageHead>
      <div className="segmented mb-3">
        {TABS.map(([k, l]) => <button key={k} type="button" aria-pressed={bidang === k} onClick={() => switchTab(k)}>{l}{cnt[k] ? ` · ${cnt[k].n}` : ''}</button>)}
      </div>
      {!ready ? <Loading /> : <div className="swap d-flex flex-column gap-3" key={bidang}>
        <div className="row g-3">
          {[['Responden', cur.n], ['Rata-rata keseluruhan', avgText(cur.avg)], ['Bersedia dihubungi', contactable], ['Pertanyaan aktif', qs.length]].map(([k, v]) => <div className="col-6 col-md-3" key={k}><div className="stat"><div className="v num">{v}</div><div className="k">{k}</div></div></div>)}
        </div>

        <section className="panel">
          <div className="panel-h"><h2 className="mb-0">Rekap Responden</h2><span className="small text-muted2">ketuk untuk melihat nilai & mencatat tindak lanjut</span></div>
          {d.responses.length > 0 && <DataToolbar q={q} onQ={setQ} placeholder="Cari responden" filters={filters} values={flt} onFilter={setFlt} shown={resp.length} total={d.responses.length} unit="responden" />}
          <MobileList items={resp} empty={respEmpty} row={(r) => ({
            key: r.id, title: r.company_name, sub: `${r.respondent_name} · ${fmtDate(r.created_at)}`, right: avgText(r.avg_score),
            pills: [...(r.contact_ok === 1 ? [['pill-progress', 'Bersedia Dihubungi']] : []), ...(r.followups ? [['pill-done', `${r.followups} tindak lanjut`]] : [])],
            detail: { rows: [['No. Layanan', r.reference_no || '—'], ['Pengajuan', r.application_no], ['Saran', r.suggestion || '—']], actions: [{ label: 'Lihat & Tindak Lanjut', icon: 'clipboard-check', primary: true, onClick: () => setOpen(r.id) }] },
          })} />
          <div className="table-responsive d-only">
            <table className="table mb-0 align-middle small">
              <thead><tr><th>Tanggal</th><th>Perusahaan / Responden</th><th>No. Layanan</th><th className="text-end">Rata-rata</th><th>Saran</th><th>Dihubungi</th><th>Tindak Lanjut</th><th></th></tr></thead>
              <tbody>
                {resp.map((r) => (
                  <tr key={r.id}>
                    <td className="text-nowrap">{fmtDate(r.created_at)}</td>
                    <td><b>{r.company_name}</b><div className="text-muted2">{r.respondent_name}</div></td>
                    <td className="mono">{r.reference_no || '—'}</td>
                    <td className="text-end num fw-semibold">{avgText(r.avg_score)}</td>
                    <td style={{ maxWidth: 260 }}><span className="text-truncate d-block">{r.suggestion || <span className="text-muted2">—</span>}</span></td>
                    <td>{contactText(r)}</td>
                    <td>{r.followups ? <span className="pill pill-done">{r.followups} catatan</span> : <span className="text-muted2">—</span>}</td>
                    <td className="text-end"><button className="btn btn-sm btn-outline-secondary" onClick={() => setOpen(r.id)}>Detail</button></td>
                  </tr>
                ))}
                {!resp.length && <tr><td colSpan={8} className="text-center text-muted2 py-4">{respEmpty}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-h"><h2 className="mb-0">Hasil per Pertanyaan</h2><span className="small text-muted2">skala 1–5</span></div>
          <div className="panel-b small">
            {d.summary.length ? d.summary.map((x, i) => (
              <div key={x.question} className="mb-2">
                <div className="d-flex justify-content-between gap-3"><span><span className="text-muted2 num">{i + 1}.</span> {x.question}</span><b className="num">{avgText(x.avg)}</b></div>
                <div className="pbar"><i style={{ width: `${(x.avg / 5) * 100}%` }} /></div>
              </div>
            )) : <p className="text-muted2 mb-0">Belum ada survei yang diisi.</p>}
          </div>
        </section>

        <section className="panel">
          <div className="panel-h">
            <h2 className="mb-0">Pengaturan Kuesioner · {TABS.find((t) => t[0] === bidang)[1]}</h2>
            {!editing && <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditing(true)}><i className="bi bi-pencil" />Ubah</button>}
          </div>
          {!editing ? (
            <div className="panel-b d-flex flex-column gap-3 small">
              <div><div className="eyebrow mb-1">Pengantar Survei</div>{d.intro || <span className="text-muted2">Belum diisi.</span>}</div>
              <div>
                <div className="eyebrow mb-1">Pertanyaan Penilaian (Skala 1–5)</div>
                <ol className="mb-0 ps-3 d-flex flex-column gap-1">{qs.map((x) => <li key={x.id}>{x.question}</li>)}</ol>
              </div>
              <div><div className="eyebrow mb-1">Ucapan Terima Kasih (semua layanan)</div>{d.thank_you_text || <span className="text-muted2">Belum diisi.</span>}</div>
            </div>
          ) : (
            <div className="panel-b d-flex flex-column gap-2">
              <label className="form-label mb-0" htmlFor="intro">Pengantar Survei</label>
              <textarea id="intro" className="form-control" rows={2} value={intro} onChange={(e) => setIntro(e.target.value)} />
              <span className="form-label mb-0 mt-2">Pertanyaan Penilaian (Skala 1–5, Wajib Dijawab)</span>
              {qs.map((x, i) => (
                <div key={x.id || `n${i}`} className="input-group input-group-sm">
                  <span className="input-group-text num">{i + 1}</span>
                  <input className="form-control" aria-label={`Pertanyaan ${i + 1}`} value={x.question} onChange={(e) => setQs(qs.map((y, j) => (j === i ? { ...y, question: e.target.value } : y)))} />
                  <button className="btn btn-outline-danger" aria-label="Hapus Pertanyaan" onClick={() => setQs(qs.filter((_, j) => j !== i))}><i className="bi bi-x-lg" /></button>
                </div>
              ))}
              <button className="btn btn-sm btn-outline-secondary align-self-start" onClick={() => setQs([...qs, { question: '' }])}><i className="bi bi-plus-lg" />Tambah Pertanyaan</button>
              <label className="form-label mb-0 mt-2" htmlFor="ty">Ucapan Terima Kasih Setelah Survei <span className="fw-normal text-muted2">(sama untuk semua layanan)</span></label>
              <textarea id="ty" className="form-control" rows={2} value={thanks} onChange={(e) => setThanks(e.target.value)} />
              <span className="small text-muted2">Pertanyaan yang dihapus tidak memengaruhi jawaban yang sudah masuk (teks pertanyaan disimpan bersama jawaban).</span>
              <div className="d-flex gap-2"><button className="btn btn-outline-secondary" disabled={saving} onClick={cancelEdit}>Batal</button><button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Menyimpan…' : 'Simpan Pengaturan'}</button></div>
            </div>
          )}
        </section>
      </div>}
      <ResponseSheet id={open} onClose={() => setOpen(null)} onChanged={load} />
    </>
  );
}

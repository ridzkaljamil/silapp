/** Survei kepuasan pelanggan per layanan (LSPro / Lab Pengujian / Lab Kalibrasi): wajib sebelum unduh sertifikat/LHU. */
import { useEffect, useState } from 'react';
import { useLocalDraft } from '../../hooks/useLocalDraft';
import api, { errMsg } from '../../api';
import { Loading, useToast, useConfirm } from '../../components/ui';
import { docWord } from '../../lib/constants';

const SCALE = ['Sangat Tidak Puas', 'Tidak Puas', 'Cukup Puas', 'Puas', 'Sangat Puas'];

export default function Survey({ app, onDone }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState(null);
  // isian survei tersimpan otomatis di browser sampai terkirim
  const [scores, setScores, clearScores] = useLocalDraft(`silapp_survei_${app.id}_nilai`, {});
  const [f, setF, clearF] = useLocalDraft(`silapp_survei_${app.id}_data`, { company_name: '', respondent_name: '', reference_no: '', suggestion: '', contact_ok: null, contact_info: '' });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get(`/applications/${app.id}/survey`).then((r) => { setData(r.data); setF((x) => ({ ...x, ...Object.fromEntries(Object.entries(r.data.defaults || {}).filter(([k]) => !String(x[k] ?? '').trim())) })); });
  }, [app.id, setF]);
  if (!data) return <Loading />;
  const answered = data.questions.filter((q) => scores[q.id]).length;
  const complete = answered === data.questions.length && f.company_name.trim() && f.respondent_name.trim();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async () => {
    setTried(true);
    if (!complete) {
      const first = data.questions.find((q) => !scores[q.id]);
      if (first) document.getElementById(`sq-${first.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return toast(answered < data.questions.length ? 'Mohon beri nilai untuk semua pertanyaan penilaian.' : 'Isi nama perusahaan/instansi dan nama responden.', 'danger');
    }
    if (!(await confirm({ title: 'Kirim Survei?', body: 'Jawaban survei tidak dapat diubah setelah dikirim. Dokumen dapat diunduh setelah survei terkirim.', ok: 'Ya, Kirim', icon: 'clipboard-check' }))) return;
    setBusy(true);
    try { const r = await api.post(`/applications/${app.id}/survey`, { ...f, scores }); clearScores(); clearF(); onDone(r.data); } catch (e) { toast(errMsg(e), 'danger'); } finally { setBusy(false); }
  };

  return (
    <section className="panel survey" aria-labelledby="sv-title">
      <div className="panel-h">
        <div><h2 className="mb-0" id="sv-title">{data.title}</h2><span className="small text-muted2">Wajib diisi sebelum mengunduh {docWord(app.service_code)}, untuk setiap penerbitan dokumen</span></div>
      </div>
      <div className="panel-b d-flex flex-column gap-4">
        {data.intro && <div className="alert alert-light border small mb-0">{data.intro}</div>}

        <fieldset>
          <legend className="sv-h">A. Identitas Pelanggan</legend>
          <div className="row g-3">
            <div className="col-md-6"><label className="form-label" htmlFor="sv-co">Nama Perusahaan/Instansi <span className="text-danger">*</span></label><input id="sv-co" className={`form-control ${tried && !f.company_name.trim() ? 'is-invalid' : ''}`} value={f.company_name} onChange={set('company_name')} /></div>
            <div className="col-md-6"><label className="form-label" htmlFor="sv-nm">Nama Responden <span className="text-danger">*</span></label><input id="sv-nm" className={`form-control ${tried && !f.respondent_name.trim() ? 'is-invalid' : ''}`} value={f.respondent_name} onChange={set('respondent_name')} /></div>
            <div className="col-md-6"><label className="form-label" htmlFor="sv-ref">Nomor Layanan/Order/Sertifikat <span className="fw-normal text-muted2">(opsional)</span></label><input id="sv-ref" className="form-control" value={f.reference_no} onChange={set('reference_no')} /></div>
            <div className="col-md-6"><span className="form-label d-block">Tanggal Pengisian</span><div className="form-control bg-light">{new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</div></div>
          </div>
          <div className="form-text">Informasi responden digunakan untuk evaluasi dan peningkatan mutu layanan PSU.</div>
        </fieldset>

        <fieldset>
          <legend className="sv-h">B. Penilaian Layanan</legend>
          <div className="sv-scale small" aria-hidden="true">{SCALE.map((s, i) => <span key={s}><b>{i + 1}</b> {s}</span>)}</div>
          <div className="d-flex flex-column">
            {data.questions.map((q, i) => (
              <div key={q.id} id={`sq-${q.id}`} role="radiogroup" aria-labelledby={`sql-${q.id}`} className={`sv-q ${tried && !scores[q.id] ? 'miss' : ''}`}>
                <span id={`sql-${q.id}`} className="sv-qt"><span className="num text-muted2">{i + 1}.</span> {q.question}</span>
                <div className="score">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <span key={v}><input type="radio" id={`q${q.id}-${v}`} name={`q${q.id}`} checked={scores[q.id] === v} onChange={() => setScores({ ...scores, [q.id]: v })} /><label htmlFor={`q${q.id}-${v}`} title={SCALE[v - 1]}>{v}<span className="visually-hidden"> · {SCALE[v - 1]}</span></label></span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="sv-h">C. Saran dan Masukan</legend>
          <label className="form-label" htmlFor="sg">Apa yang paling perlu kami pertahankan atau tingkatkan dari layanan ini? <span className="fw-normal text-muted2">(opsional)</span></label>
          <textarea id="sg" className="form-control" rows={3} value={f.suggestion} onChange={set('suggestion')} />
        </fieldset>

        <fieldset>
          <legend className="sv-h">D. Kesediaan Dihubungi Kembali <span className="fw-normal text-muted2">(opsional)</span></legend>
          <div className="d-flex flex-wrap gap-2">
            {[[true, 'Ya, saya bersedia dihubungi untuk klarifikasi atas masukan saya.'], [false, 'Tidak']].map(([v, l]) => (
              <label key={l} className={`choice ${f.contact_ok === v ? 'on' : ''}`}>
                <input type="radio" name="contact_ok" checked={f.contact_ok === v} onChange={() => setF({ ...f, contact_ok: v })} /><span>{l}</span>
              </label>
            ))}
          </div>
          {f.contact_ok === true && (
            <div className="mt-2 swap" style={{ maxWidth: 420 }}><label className="form-label" htmlFor="sv-ct">Email/No. HP</label><input id="sv-ct" className="form-control" value={f.contact_info} onChange={set('contact_info')} /></div>
          )}
        </fieldset>

        <div className="d-flex flex-wrap align-items-center gap-3 border-top pt-3">
          <button className="btn btn-gold" disabled={busy} aria-disabled={!complete} onClick={submit}>{busy ? 'Mengirim…' : 'Kirim Survei'}</button>
          <span className={`small ${answered === data.questions.length ? 'text-success' : 'text-muted2'}`}>{answered} dari {data.questions.length} pertanyaan penilaian sudah dinilai</span>
        </div>
      </div>
    </section>
  );
}

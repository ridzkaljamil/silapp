/**
 * Survei kepuasan pelanggan per layanan (LSPro / Lab Pengujian / Lab Kalibrasi): wajib sebelum unduh sertifikat/LHU.
 * Diisi lewat pop-up (SurveySheet). Di halaman detail cukup tampil kartu ajakan (SurveyCard).
 * Jawaban tersimpan otomatis di perangkat, jadi pop-up boleh ditutup lalu dilanjutkan kapan saja.
 */
import { useEffect, useState } from 'react';
import { useLocalDraft, peekLocalDraft } from '../../hooks/useLocalDraft';
import api, { errMsg } from '../../api';
import { Loading, useToast, useConfirm, Sheet } from '../../components/ui';
import { docWord } from '../../lib/constants';

const SCALE = ['Sangat Tidak Puas', 'Tidak Puas', 'Cukup Puas', 'Puas', 'Sangat Puas'];
const scoreKey = (id) => `silapp_survei_${id}_nilai`;
/** Jumlah pertanyaan yang sudah dinilai di draft perangkat ini. */
export const surveyDraftCount = (id) => Object.keys(peekLocalDraft(scoreKey(id), {}) || {}).length;

/** Kartu di Ringkasan: ajakan mengisi survei, atau melanjutkan bila sudah sebagian diisi. */
export function SurveyCard({ app, answered, onOpen }) {
  const dw = docWord(app.service_code);
  return (
    <section className="panel sv-card">
      <div className="panel-b d-flex align-items-center gap-3 flex-wrap">
        <span className="sv-card-ic" aria-hidden="true"><i className="bi bi-clipboard-check" /></span>
        <div className="flex-grow-1 min-w-0">
          <b className="d-block">Survei Kepuasan Pelanggan</b>
          <span className="small text-muted2">
            {answered > 0 ? `${answered} pertanyaan sudah dinilai. Lanjutkan dan kirim survei untuk mengunduh ${dw}.` : `Wajib diisi sebelum mengunduh ${dw}. Sekitar 3 menit.`}
          </span>
        </div>
        <button type="button" className="btn btn-gold" onClick={onOpen}>{answered > 0 ? 'Lanjutkan Survei' : 'Isi Survei'}</button>
      </div>
    </section>
  );
}

/** Pop-up form survei. onClose(answered): ditutup tanpa mengirim (jawaban tetap tersimpan). */
export default function SurveySheet({ app, open, onClose, onDone }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState(null);
  const [scores, setScores, clearScores] = useLocalDraft(scoreKey(app.id), {});
  const [f, setF, clearF] = useLocalDraft(`silapp_survei_${app.id}_data`, { company_name: '', respondent_name: '', reference_no: '', suggestion: '', contact_ok: null, contact_info: '' });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open || data) return;
    api.get(`/applications/${app.id}/survey`)
      .then((r) => { setData(r.data); setF((x) => ({ ...x, ...Object.fromEntries(Object.entries(r.data.defaults || {}).filter(([k]) => !String(x[k] ?? '').trim())) })); })
      .catch((e) => { toast(errMsg(e), 'danger'); onClose(0); });
  }, [open, data, app.id, setF]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = data?.questions.length || 0;
  const answered = data ? data.questions.filter((q) => scores[q.id]).length : Object.keys(scores).length;
  const complete = data && answered === total && f.company_name.trim() && f.respondent_name.trim();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  // judul survei "Survei Kepuasan Pelanggan – Lembaga Sertifikasi Produk (LSPro)": nama unit masuk ke subjudul agar judul pop-up ringkas di HP
  const [head, unit] = (() => { const t = data?.title || 'Survei Kepuasan Pelanggan'; const i = t.search(/\s[–-]\s/); return i > 0 ? [t.slice(0, i), t.slice(i + 3)] : [t, '']; })();

  const close = () => {
    if (busy) return;
    if (answered > 0 || f.suggestion.trim()) toast('Jawaban survei tersimpan di perangkat ini. Anda bisa melanjutkannya nanti.');
    onClose(answered);
  };
  const submit = async () => {
    if (!data) return null;
    setTried(true);
    if (!complete) {
      const first = data.questions.find((q) => !scores[q.id]);
      const target = !f.company_name.trim() ? 'sv-co' : !f.respondent_name.trim() ? 'sv-nm' : first && `sq-${first.id}`;
      if (target) document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return toast(answered < total ? 'Mohon beri nilai untuk semua pertanyaan penilaian.' : 'Isi nama perusahaan/instansi dan nama responden.', 'danger');
    }
    if (!(await confirm({ title: 'Kirim Survei?', body: `Jawaban survei tidak dapat diubah setelah dikirim. ${docWord(app.service_code, true)} dapat diunduh setelah survei terkirim.`, ok: 'Ya, Kirim', icon: 'clipboard-check' }))) return null;
    setBusy(true);
    try { const r = await api.post(`/applications/${app.id}/survey`, { ...f, scores }); clearScores(); clearF(); onDone(r.data); } catch (e) { toast(errMsg(e), 'danger'); } finally { setBusy(false); }
    return null;
  };

  return (
    <Sheet open={open} onClose={close} wide icon="clipboard-check" title={head}
      sub={`${unit ? `${unit} · ` : ''}Wajib diisi sebelum mengunduh ${docWord(app.service_code)}`}
      footer={<><button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={close}>Tutup</button><button type="button" className="btn btn-gold" disabled={busy || !data} aria-disabled={!complete} onClick={submit}>{busy ? 'Mengirim…' : 'Kirim Survei'}</button></>}>
      {!data ? <Loading /> : (
        <div className="survey d-flex flex-column gap-4">
          <div className="sv-progress" aria-live="polite">
            <div className="d-flex justify-content-between small"><span className={answered === total ? 'text-success fw-semibold' : 'text-muted2'}>{answered} dari {total} pertanyaan penilaian sudah dinilai</span><span className="text-muted2 hide-sm">Tersimpan otomatis</span></div>
            <div className="sv-bar"><span style={{ width: `${total ? (answered / total) * 100 : 0}%` }} /></div>
          </div>
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
        </div>
      )}
    </Sheet>
  );
}

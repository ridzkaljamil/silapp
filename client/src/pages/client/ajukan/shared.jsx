/** Konstanta, isian, dan fungsi bantu form Ajukan Layanan. */
import { Select } from '../../../components/ui';

const stepNames = (code) => ['Pilih Layanan', code === 'SP' ? 'Data Permohonan' : 'Data & Parameter', 'Unggah Dokumen', 'Konfirmasi'];
const APP_TYPES = ['Sertifikasi Awal', 'Surveillance', 'Re-sertifikasi', 'Perluasan Ruang Lingkup', 'Perubahan Data/Merek', 'Transfer Sertifikasi'];
/** Sertifikasi Awal dan Surveillance boleh dicentang bersamaan; jenis lain hanya satu. */
const PAIR = ['Sertifikasi Awal', 'Surveillance'];
const pickType = (cur, t) => {
  if (!PAIR.includes(t)) return [t];
  const base = cur.filter((x) => PAIR.includes(x));
  return base.includes(t) ? base.filter((x) => x !== t) : [...base, t];
};
const SURV_TEXT = 'Kami bersedia dilakukan surveilan oleh PT Penilai Standar Uji selama masa berlaku sertifikat.';
const ORIGINS = [['dn', 'Dalam Negeri'], ['ln', 'Luar Negeri']];
const EMPTY_SP = { category: '', product_id: '', scheme: '', types: ['Sertifikasi Awal'], origin: '', brands: [{ merek: '', jenis: '' }], is_package: false };
const EMPTY_LAB = { product_id: '', quantity: 1, params: [], full_sni: false, custom: [''], option: 'std', custom_product: '', specs: [{ brand: '', spec: '' }] };
const EMPTY_KAL = { name: '', brand_model: '', serial_number: '', range_capacity: '', resolution: '', calibration_points: '', accessories: '', quantity: 1, location: 'lab' };
const validQty = (v) => Number.isInteger(+v) && +v >= 1 && +v <= 999 && String(v).trim() !== '';
const fmtSaved = (d) => new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Pembungkus label + field (di luar komponen agar input tidak kehilangan fokus saat mengetik). */
const F = ({ label, children, id, full, req }) => <div className={full ? 'col-12' : 'col-md-6'}><label className="form-label" htmlFor={id}>{label}{req ? <span className="text-danger"> *</span> : null}</label>{children}</div>;

/** Isian Nomor + Tanggal (mis. Nomor Bill of Lading + tanggalnya); multiple: bisa lebih dari satu baris. */
const PAIR_MAX = 10;
const pairsOf = (v) => (Array.isArray(v) && v.length ? v : [{ no: '', date: '' }]);
function PairField({ f, value, onChange }) {
  const rows = pairsOf(value);
  const set = (i, k, v) => onChange(f.key, rows.map((r, n) => (n === i ? { ...r, [k]: v } : r)));
  const id = `fx-${f.key}`;
  return (
    <div className="col-12">
      <span className="form-label d-block" id={`${id}-l`}>{f.label}{f.required ? <span className="text-danger"> *</span> : null}</span>
      <div className="d-flex flex-column gap-2" role="group" aria-labelledby={`${id}-l`}>
        {rows.map((r, i) => (
          <div key={i} className="pair-row pair-date">
            <input id={i === 0 ? id : undefined} className="form-control" placeholder="Nomor" aria-label={`${f.label} – nomor ${i + 1}`} value={r.no} maxLength={80} onChange={(e) => set(i, 'no', e.target.value)} />
            <input type="date" className="form-control" aria-label={`${f.label} – tanggal ${i + 1}`} value={r.date} onChange={(e) => set(i, 'date', e.target.value)} />
            <button type="button" className="btn btn-outline-danger" aria-label={`Hapus ${f.label} ${i + 1}`} disabled={rows.length === 1 && !r.no && !r.date}
              onClick={() => onChange(f.key, rows.length === 1 ? [{ no: '', date: '' }] : rows.filter((_, n) => n !== i))}><i className="bi bi-x-lg" /></button>
          </div>
        ))}
      </div>
      {!!f.multiple && <button type="button" className="btn btn-outline-secondary btn-sm mt-2" disabled={rows.length >= PAIR_MAX} onClick={() => onChange(f.key, [...rows, { no: '', date: '' }])}><i className="bi bi-plus-lg" />Tambah {f.label.replace(/^Nomor\s+/i, '')}</button>}
    </div>
  );
}
/** Baris Nomor + Tanggal yang terisi lengkap / setengah. */
const filledPairs = (v) => (Array.isArray(v) ? v.filter((r) => r.no?.trim() || r.date) : []);
const pairText = (v) => filledPairs(v).map((r) => `${r.no}${r.date ? ` · ${new Date(`${r.date}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}`).join('; ');

/** Isian dari form builder (diatur Super Admin). */
function DynField({ f, value, onChange }) {
  if (f.type === 'nomor_tanggal') return <PairField f={f} value={value} onChange={onChange} />;
  const id = `fx-${f.key}`;
  const common = { id, className: f.type === 'select' ? 'form-select' : 'form-control', value: value || '', onChange: (e) => onChange(f.key, e.target.value), required: !!f.required };
  let input;
  if (f.type === 'textarea') input = <textarea rows={2} {...common} />;
  else if (f.type === 'select') input = <Select {...common}><option value="">— Pilih —</option>{(f.options || '').split(',').map((o) => o.trim()).filter(Boolean).map((o) => <option key={o}>{o}</option>)}</Select>;
  else input = <input type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} {...common} />;
  return <F label={f.label} id={id} req={f.required} full={f.type === 'textarea'}>{input}</F>;
}

/** Baris ringkasan di langkah Konfirmasi. */
const Row = ({ k, v }) => <><dt className="col-sm-3 text-muted2 fw-normal">{k}</dt><dd className="col-sm-9">{v}</dd></>;

export { stepNames, APP_TYPES, PAIR, pickType, SURV_TEXT, ORIGINS, EMPTY_SP, EMPTY_LAB, EMPTY_KAL, validQty, fmtSaved, F, PAIR_MAX, pairsOf, PairField, filledPairs, pairText, DynField, Row };

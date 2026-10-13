/**
 * Kelola Layanan (Super Admin): satu menu untuk semua pengaturan layanan.
 * Tab: Detail Layanan, Form Pengajuan, Ruang Lingkup & Harga, Pengaturan Umum.
 * Tab yang sudah dibuka tetap tersimpan di halaman, jadi berpindah tab tidak memuat ulang data.
 */
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageTabsContext } from '../../../components/ui';
import DetailLayanan from './DetailLayanan';
import FormBuilder from './FormBuilder';
import RuangLingkup from './RuangLingkup';
import PengaturanUmum from './PengaturanUmum';

const TABS = [['tahapan', 'Detail Layanan', DetailLayanan], ['form', 'Form Pengajuan', FormBuilder], ['ruang-lingkup', 'Ruang Lingkup & Harga', RuangLingkup],
  ['umum', 'Pengaturan Umum', PengaturanUmum]];
const ALIAS = { harga: 'ruang-lingkup' };

export default function KelolaLayanan() {
  const [sp, setSp] = useSearchParams();
  const want = ALIAS[sp.get('tab')] || sp.get('tab');
  const tab = TABS.find((t) => t[0] === want)?.[0] || TABS[0][0];
  const [seen, setSeen] = useState(() => new Set([tab]));
  if (!seen.has(tab)) setSeen(new Set([...seen, tab]));
  const ctx = { eyebrow: 'Pengaturan', title: 'Kelola Layanan', items: TABS, value: tab, onChange: (k) => setSp({ tab: k }, { replace: true }) };
  return (
    <PageTabsContext.Provider value={ctx}>
      {TABS.filter(([k]) => seen.has(k)).map(([k, , Page]) => (
        <div key={k} hidden={k !== tab}><Page /></div>
      ))}
    </PageTabsContext.Provider>
  );
}

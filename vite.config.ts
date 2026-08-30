import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function persistencePatch() {
  return {
    name: 'mataram76-persistence-patch',
    transform(code: string, id: string) {
      if (!id.endsWith('/src/App.tsx')) return null

      let out = code

      // Login tetap persisten per perangkat/browser.
      out = out.replace(
        "const [isLoggedIn, setIsLoggedIn] = useState(false);",
        "const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('mataram76_admin_session') === 'true');"
      )

      out = out.replace(
        `const [adminCredentials, setAdminCredentials] = useState({
    username: 'admin',
    password: 'mataram76'
  });`,
        `const [adminCredentials, setAdminCredentials] = useState(() => {
    try {
      const saved = localStorage.getItem('mataram76_admin_credentials');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          username: parsed.username || 'admin',
          password: parsed.password || 'mataram76'
        };
      }
    } catch (error) {
      console.warn('Gagal membaca kredensial admin tersimpan:', error);
    }
    return { username: 'admin', password: 'mataram76' };
  });`
      )

      out = out.replace(
        `const [settings, setSettings] = useState({
    autoCalculate: true,
    zones: [
      { city: 'Yogyakarta', price: 30000 },
      { city: 'Semarang', price: 25000 },
      { city: 'Solo', price: 30000 },
      { city: 'Purwokerto', price: 40000 },
      { city: 'Magelang', price: 35000 }
    ],
    pricePerKg: 5000,
    standardWeight: 3,
    dimensionThreshold: 5000,
    dimensionSurcharge: 15000
  });`,
        `const [settings, setSettings] = useState(() => {
    const defaults = {
      autoCalculate: true,
      zones: [
        { city: 'Yogyakarta', price: 30000 },
        { city: 'Semarang', price: 25000 },
        { city: 'Solo', price: 30000 },
        { city: 'Purwokerto', price: 40000 },
        { city: 'Magelang', price: 35000 }
      ],
      pricePerKg: 5000,
      standardWeight: 3,
      dimensionThreshold: 5000,
      dimensionSurcharge: 15000
    };
    try {
      const saved = localStorage.getItem('mataram76_shipping_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.zones)) {
          return { ...defaults, ...parsed, zones: parsed.zones };
        }
      }
    } catch (error) {
      console.warn('Gagal membaca pengaturan ongkir tersimpan:', error);
    }
    return defaults;
  });`
      )

      // Sinkronisasi Settings Ongkir terpusat di Firestore. Data transaksi tidak disentuh.
      out = out.replace(
        `  const [selectedReceipt, setSelectedReceipt] = useState(null);\n`,
        `  const [selectedReceipt, setSelectedReceipt] = useState(null);\n  const [settingsCloudLoaded, setSettingsCloudLoaded] = useState(false);\n\n  useEffect(() => {\n    const shippingRef = doc(db, 'settings', 'shipping');\n    const unsubscribe = onSnapshot(shippingRef, (snapshot) => {\n      if (snapshot.exists()) {\n        const cloudSettings = snapshot.data();\n        if (Array.isArray(cloudSettings.zones)) {\n          setSettings(prev => ({ ...prev, ...cloudSettings, zones: cloudSettings.zones }));\n        }\n      } else {\n        setDoc(shippingRef, settings, { merge: true }).catch((error) => {\n          console.error('Gagal membuat pengaturan ongkir Cloud:', error);\n        });\n      }\n      setSettingsCloudLoaded(true);\n    }, (error) => {\n      console.error('Firestore shipping settings error:', error);\n      setSettingsCloudLoaded(true);\n    });\n\n    return () => unsubscribe();\n  }, []);\n\n  useEffect(() => {\n    if (!settingsCloudLoaded) return;\n    setDoc(doc(db, 'settings', 'shipping'), settings, { merge: true }).catch((error) => {\n      console.error('Gagal menyimpan pengaturan ongkir ke Cloud:', error);\n    });\n  }, [settings, settingsCloudLoaded]);\n`
      )

      // Local fallback tetap dipertahankan sebagai cache perangkat, sedangkan sumber utama sudah Cloud.
      out = out.replace(
        `  // Persistensi lokal hanya untuk konfigurasi aplikasi dan sesi admin.\n  // Tidak menyentuh data transaksi/Firebase shipments/customers.`,
        `  // Cache lokal hanya sebagai fallback/offline; Settings Ongkir utama tersimpan di Firestore.`
      )

      out = out.replace(
        `      setIsLoggedIn(true);\n      setLoginError('');`,
        `      setIsLoggedIn(true);\n      localStorage.setItem('mataram76_admin_session', 'true');\n      setLoginError('');`
      )

      out = out.replace(
        `    setIsLoggedIn(false);\n    setUsernameInput('');`,
        `    setIsLoggedIn(false);\n    localStorage.removeItem('mataram76_admin_session');\n    setUsernameInput('');`
      )

      // SettingsView: state untuk mode edit kota/harga dasar.
      out = out.replace(
        `  const [newCity, setNewCity] = useState('');\n  const [newPrice, setNewPrice] = useState('');\n  const [localSettings, setLocalSettings] = useState(settings);`,
        `  const [newCity, setNewCity] = useState('');\n  const [newPrice, setNewPrice] = useState('');\n  const [editingZoneIndex, setEditingZoneIndex] = useState(null);\n  const [editCity, setEditCity] = useState('');\n  const [editPrice, setEditPrice] = useState('');\n  const [localSettings, setLocalSettings] = useState(settings);\n\n  useEffect(() => {\n    setLocalSettings(settings);\n  }, [settings]);`
      )

      // Tambahkan handler edit tepat sebelum handler hapus.
      out = out.replace(
        `  const handleRemoveZone = (index) => {`,
        `  const handleStartEditZone = (index) => {\n    const zone = localSettings.zones[index];\n    setEditingZoneIndex(index);\n    setEditCity(zone.city);\n    setEditPrice(String(zone.price));\n  };\n\n  const handleCancelEditZone = () => {\n    setEditingZoneIndex(null);\n    setEditCity('');\n    setEditPrice('');\n  };\n\n  const handleSaveEditZone = (e) => {\n    e.preventDefault();\n    if (editingZoneIndex === null || !editCity.trim() || !editPrice) return;\n    const updatedZones = localSettings.zones.map((zone, idx) => (\n      idx === editingZoneIndex\n        ? { city: formatEYD(editCity.trim()), price: Number(editPrice) }\n        : zone\n    ));\n    const updated = { ...localSettings, zones: updatedZones };\n    setLocalSettings(updated);\n    setSettings(updated);\n    handleCancelEditZone();\n    showToast('Kota dan harga dasar berhasil diperbarui!');\n  };\n\n  const handleRemoveZone = (index) => {`
      )

      // Ganti daftar kartu kota dengan versi yang mempunyai Edit + Hapus.
      const oldZoneList = `              {localSettings.zones.map((zone, idx) => (\n                <div key={idx} className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3.5 flex items-center justify-between">\n                  <div>\n                    <div className="font-semibold text-white text-sm">{zone.city}</div>\n                    <div className="text-xs text-indigo-400 font-mono mt-0.5">Rp {zone.price.toLocaleString('id-ID')}</div>\n                  </div>\n                  <button\n                    type="button"\n                    onClick={() => handleRemoveZone(idx)}\n                    className="p-1.5 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white rounded-lg transition-all"\n                  >\n                    <Trash2 className="w-4 h-4" />\n                  </button>\n                </div>\n              ))}`
      const newZoneList = `              {localSettings.zones.map((zone, idx) => (\n                <div key={idx} className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3.5">\n                  {editingZoneIndex === idx ? (\n                    <form onSubmit={handleSaveEditZone} className="space-y-2">\n                      <input\n                        type="text"\n                        value={editCity}\n                        onChange={(e) => setEditCity(formatEYD(e.target.value))}\n                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"\n                        placeholder="Nama kota/zona"\n                      />\n                      <input\n                        type="number"\n                        value={editPrice}\n                        onChange={(e) => setEditPrice(e.target.value)}\n                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"\n                        placeholder="Harga dasar"\n                      />\n                      <div className="flex justify-end gap-2">\n                        <button type="button" onClick={handleCancelEditZone} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs">Batal</button>\n                        <button type="submit" className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium">Simpan</button>\n                      </div>\n                    </form>\n                  ) : (\n                    <div className="flex items-center justify-between gap-3">\n                      <div>\n                        <div className="font-semibold text-white text-sm">{zone.city}</div>\n                        <div className="text-xs text-indigo-400 font-mono mt-0.5">Rp {zone.price.toLocaleString('id-ID')}</div>\n                      </div>\n                      <div className="flex items-center gap-1.5">\n                        <button\n                          type="button"\n                          onClick={() => handleStartEditZone(idx)}\n                          className="p-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-lg transition-all"\n                          title="Edit kota dan harga dasar"\n                        >\n                          <Edit3 className="w-4 h-4" />\n                        </button>\n                        <button\n                          type="button"\n                          onClick={() => handleRemoveZone(idx)}\n                          className="p-1.5 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white rounded-lg transition-all"\n                          title="Hapus kota"\n                        >\n                          <Trash2 className="w-4 h-4" />\n                        </button>\n                      </div>\n                    </div>\n                  )}\n                </div>\n              ))}`
      out = out.replace(oldZoneList, newZoneList)

      // Dropdown Kota/Zona Tujuan di Input Pengiriman ditampilkan A-Z tanpa mengubah data sumber.
      out = out.replace(
        `{settings.zones.map((z, idx) => (\n                  <option key={idx} value={z.city}>{z.city} (Base: Rp {z.price.toLocaleString('id-ID')})</option>\n                ))}`,
        `{[...settings.zones].sort((a, b) => a.city.localeCompare(b.city, 'id', { sensitivity: 'base' })).map((z, idx) => (\n                  <option key={idx} value={z.city}>{z.city} (Base: Rp {z.price.toLocaleString('id-ID')})</option>\n                ))}`
      )

      return { code: out, map: null }
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [persistencePatch(), react()],
})

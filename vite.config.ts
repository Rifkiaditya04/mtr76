import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function appFixes() {
  return {
    name: 'mataram76-app-fixes',
    transform(code: string, id: string) {
      if (!id.endsWith('/src/App.tsx')) return null

      let out = code

      // Settings Ongkir: Firestore menjadi sumber utama agar seluruh komputer sinkron.
      const selectedReceiptMarker = `  const [selectedReceipt, setSelectedReceipt] = useState(null);`
      if (!out.includes('mataram76_shipping_settings_cloud_loaded')) {
        out = out.replace(
          selectedReceiptMarker,
          `${selectedReceiptMarker}\n  const [settingsCloudLoaded, setSettingsCloudLoaded] = useState(false);\n\n  useEffect(() => {\n    const shippingRef = doc(db, 'settings', 'shipping');\n    const unsubscribe = onSnapshot(shippingRef, (snapshot) => {\n      if (snapshot.exists()) {\n        const cloudSettings = snapshot.data();\n        if (cloudSettings && Array.isArray(cloudSettings.zones)) {\n          setSettings(prev => ({ ...prev, ...cloudSettings, zones: cloudSettings.zones }));\n        }\n      } else {\n        setDoc(shippingRef, settings, { merge: true }).catch((error) => {\n          console.error('Gagal membuat pengaturan ongkir Cloud:', error);\n        });\n      }\n      setSettingsCloudLoaded(true);\n    }, (error) => {\n      console.error('Firestore shipping settings error:', error);\n      setSettingsCloudLoaded(true);\n    });\n    return () => unsubscribe();\n  }, []);\n\n  useEffect(() => {\n    if (!settingsCloudLoaded) return;\n    setDoc(doc(db, 'settings', 'shipping'), settings, { merge: true }).catch((error) => {\n      console.error('Gagal menyimpan pengaturan ongkir ke Cloud:', error);\n    });\n  }, [settings, settingsCloudLoaded]);`
        )
      }

      // SettingsView harus mengikuti perubahan dari Firestore setelah komponen sudah terbuka.
      const localSettingsMarker = `  const [localSettings, setLocalSettings] = useState(settings);`
      if (!out.includes('mataram76_sync_local_settings')) {
        out = out.replace(
          localSettingsMarker,
          `${localSettingsMarker}\n  useEffect(() => {\n    setLocalSettings(settings);\n  }, [settings]);\n  // matarAM76_sync_local_settings`
        )
      }

      // Fitur Edit pada Daftar Kota & Harga Dasar.
      const removeMarker = `  const handleRemoveZone = (index) => {`
      if (!out.includes('handleStartEditZone')) {
        out = out.replace(
          removeMarker,
          `  const handleStartEditZone = (index) => {\n    const zone = localSettings.zones[index];\n    setEditingZoneIndex(index);\n    setEditCity(zone.city);\n    setEditPrice(String(zone.price));\n  };\n\n  const handleCancelEditZone = () => {\n    setEditingZoneIndex(null);\n    setEditCity('');\n    setEditPrice('');\n  };\n\n  const handleSaveEditZone = (e) => {\n    e.preventDefault();\n    if (editingZoneIndex === null || !editCity.trim() || !editPrice) return;\n    const updatedZones = localSettings.zones.map((zone, idx) => (\n      idx === editingZoneIndex\n        ? { city: formatEYD(editCity.trim()), price: Number(editPrice) }\n        : zone\n    ));\n    const updated = { ...localSettings, zones: updatedZones };\n    setLocalSettings(updated);\n    setSettings(updated);\n    handleCancelEditZone();\n    showToast('Kota dan harga dasar berhasil diperbarui!');\n  };\n\n${removeMarker}`
        )
      }

      // Tambahkan state edit bila belum ada.
      const newPriceMarker = `  const [newPrice, setNewPrice] = useState('');`
      if (!out.includes('editingZoneIndex')) {
        out = out.replace(
          newPriceMarker,
          `${newPriceMarker}\n  const [editingZoneIndex, setEditingZoneIndex] = useState(null);\n  const [editCity, setEditCity] = useState('');\n  const [editPrice, setEditPrice] = useState('');`
        )
      }

      // Daftar kota: tombol Edit + Hapus.
      const oldZoneList = `              {localSettings.zones.map((zone, idx) => (\n                <div key={idx} className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3.5 flex items-center justify-between">\n                  <div>\n                    <div className="font-semibold text-white text-sm">{zone.city}</div>\n                    <div className="text-xs text-indigo-400 font-mono mt-0.5">Rp {zone.price.toLocaleString('id-ID')}</div>\n                  </div>\n                  <button\n                    type="button"\n                    onClick={() => handleRemoveZone(idx)}\n                    className="p-1.5 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white rounded-lg transition-all"\n                  >\n                    <Trash2 className="w-4 h-4" />\n                  </button>\n                </div>\n              ))}`
      const newZoneList = `              {localSettings.zones.map((zone, idx) => (\n                <div key={idx} className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3.5">\n                  {editingZoneIndex === idx ? (\n                    <form onSubmit={handleSaveEditZone} className="space-y-2">\n                      <input type="text" value={editCity} onChange={(e) => setEditCity(formatEYD(e.target.value))} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm" placeholder="Nama kota/zona" />\n                      <input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm" placeholder="Harga dasar" />\n                      <div className="flex justify-end gap-2">\n                        <button type="button" onClick={handleCancelEditZone} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs">Batal</button>\n                        <button type="submit" className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium">Simpan</button>\n                      </div>\n                    </form>\n                  ) : (\n                    <div className="flex items-center justify-between gap-3">\n                      <div>\n                        <div className="font-semibold text-white text-sm">{zone.city}</div>\n                        <div className="text-xs text-indigo-400 font-mono mt-0.5">Rp {zone.price.toLocaleString('id-ID')}</div>\n                      </div>\n                      <div className="flex items-center gap-1.5">\n                        <button type="button" onClick={() => handleStartEditZone(idx)} className="p-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-lg transition-all" title="Edit kota dan harga dasar"><Edit3 className="w-4 h-4" /></button>\n                        <button type="button" onClick={() => handleRemoveZone(idx)} className="p-1.5 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white rounded-lg transition-all" title="Hapus kota"><Trash2 className="w-4 h-4" /></button>\n                      </div>\n                    </div>\n                  )}\n                </div>\n              ))}`
      out = out.replace(oldZoneList, newZoneList)

      // Dropdown Kota/Zona Tujuan di Input Pengiriman: urut A-Z.
      const oldDropdown = `{settings.zones.map((z, idx) => (\n                  <option key={idx} value={z.city}>{z.city} (Base: Rp {z.price.toLocaleString('id-ID')})</option>\n                ))}`
      const newDropdown = `{[...settings.zones].sort((a, b) => a.city.localeCompare(b.city, 'id', { sensitivity: 'base' })).map((z, idx) => (\n                  <option key={idx} value={z.city}>{z.city} (Base: Rp {z.price.toLocaleString('id-ID')})</option>\n                ))}`
      out = out.replace(oldDropdown, newDropdown)

      return { code: out, map: null }
    },
  }
}

export default defineConfig({
  plugins: [appFixes(), react()],
})

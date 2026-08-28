import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function persistencePatch() {
  return {
    name: 'mataram76-persistence-patch',
    transform(code: string, id: string) {
      if (!id.endsWith('/src/App.tsx')) return null

      let out = code

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

      out = out.replace(
        `  const [selectedReceipt, setSelectedReceipt] = useState(null);\n`,
        `  const [selectedReceipt, setSelectedReceipt] = useState(null);\n\n  // Persistensi lokal hanya untuk konfigurasi aplikasi dan sesi admin.\n  // Tidak menyentuh data transaksi/Firebase shipments/customers.\n  useEffect(() => {\n    try {\n      localStorage.setItem('mataram76_shipping_settings', JSON.stringify(settings));\n    } catch (error) {\n      console.warn('Gagal menyimpan pengaturan ongkir:', error);\n    }\n  }, [settings]);\n\n  useEffect(() => {\n    try {\n      localStorage.setItem('mataram76_admin_credentials', JSON.stringify(adminCredentials));\n    } catch (error) {\n      console.warn('Gagal menyimpan kredensial admin:', error);\n    }\n  }, [adminCredentials]);\n`
      )

      out = out.replace(
        `      setIsLoggedIn(true);\n      setLoginError('');`,
        `      setIsLoggedIn(true);\n      localStorage.setItem('mataram76_admin_session', 'true');\n      setLoginError('');`
      )

      out = out.replace(
        `    setIsLoggedIn(false);\n    setUsernameInput('');`,
        `    setIsLoggedIn(false);\n    localStorage.removeItem('mataram76_admin_session');\n    setUsernameInput('');`
      )

      return { code: out, map: null }
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [persistencePatch(), react()],
})

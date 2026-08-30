import React, { useState, useEffect, useMemo } from 'react';
import { 
  Package, Users, FileText, Settings, LayoutDashboard, PlusCircle, 
  Printer, Search, Download, CheckCircle2, Clock, AlertCircle, 
  DollarSign, MapPin, Phone, User, Truck, Edit3, Trash2, ShieldCheck, LogOut, RefreshCw, X, ChevronRight, AlertTriangle, BookmarkPlus, Cloud
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, setDoc, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAjaB_RVf6tocoQV_udCOYor8CK5EF9Ry4",
  authDomain: "mataram-76.firebaseapp.com",
  projectId: "mataram-76",
  storageBucket: "mataram-76.firebasestorage.app",
  messagingSenderId: "710221250549",
  appId: "1:710221250549:web:1cdcd61e0a8101ad82eabc",
  measurementId: "G-T1F178D6M8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function formatEYD(val) {
  if (!val) return '';
  const str = String(val);
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function generateNextResiId(shipments) {
  const saved = localStorage.getItem('mataram76_resi_counter');
  let counter = saved ? parseInt(saved, 10) : 0;
  shipments.forEach((s) => {
    const match = s.id.match(/^MTR-(\d+)$/);
    if (match) counter = Math.max(counter, parseInt(match[1], 10));
  });
  counter += 1;
  localStorage.setItem('mataram76_resi_counter', String(counter));
  return `MTR-${String(counter).padStart(4, '0')}`;
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('mataram76_admin_session') === 'true');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [adminCredentials, setAdminCredentials] = useState(() => {
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
  });
  const [loginError, setLoginError] = useState('');

  const [activeTab, setActiveTab] = useState('dashboard');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [quickInputData, setQuickInputData] = useState(null);

  const [shipments, setShipments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [settings, setSettings] = useState(() => {
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
  });

  const [selectedReceipt, setSelectedReceipt] = useState(null);

  useEffect(() => {
    const shippingSettingsRef = doc(db, 'settings', 'shipping');
    const unsubscribe = onSnapshot(shippingSettingsRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const cloudSettings = snapshot.data();
      if (cloudSettings && Array.isArray(cloudSettings.zones)) {
        setSettings(prev => ({ ...prev, ...cloudSettings, zones: cloudSettings.zones }));
      }
    }, (error) => console.error('Firestore shipping settings error:', error));
    return () => unsubscribe();
  }, []);

  // Persistensi lokal hanya untuk konfigurasi aplikasi dan sesi admin.
  // Tidak menyentuh data transaksi/Firebase shipments/customers.
  useEffect(() => {
    try {
      localStorage.setItem('mataram76_shipping_settings', JSON.stringify(settings));
    } catch (error) {
      console.warn('Gagal menyimpan pengaturan ongkir:', error);
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem('mataram76_admin_credentials', JSON.stringify(adminCredentials));
    } catch (error) {
      console.warn('Gagal menyimpan kredensial admin:', error);
    }
  }, [adminCredentials]);

  useEffect(() => {
    signInAnonymously(auth).catch(err => {
      console.error("Auth error:", err);
    });

    const unsubShipments = onSnapshot(collection(db, 'shipments'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() }));
      list.sort((a, b) => b.id.localeCompare(a.id));
      if (list.length > 0) {
        setShipments(list);
      } else {
        setShipments([
          {
            id: 'MTR-0001',
            date: '2026-08-25',
            time: '12:00',
            senderName: 'Budi Santoso',
            senderPhone: '081234567890',
            senderAddress: 'Jl. Gajah Mada 14, Semarang',
            receiverName: 'Siti Rahma',
            receiverPhone: '089876543210',
            receiverAddress: 'Jl. Malioboro No. 12, Yogyakarta',
            serviceType: 'Antar sampai tujuan',
            weight: '2.5',
            length: '20',
            width: '15',
            height: '10',
            destinationCity: 'Yogyakarta',
            shippingCost: 80000,
            calo: 10000,
            lb: '',
            st: 0,
            sopir: '',
            paymentStatus: 'Lunas'
          }
        ]);
      }
    }, (error) => {
      console.error("Firestore shipments error:", error);
    });

    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() }));
      if (list.length > 0) {
        setCustomers(list);
      } else {
        setCustomers([
          { 
            id: 1, 
            senderName: 'Budi Santoso', 
            senderPhone: '081234567890', 
            senderAddress: 'Jl. Gajah Mada 14, Semarang',
            receiverName: 'Siti Rahma', 
            receiverPhone: '089876543210', 
            receiverAddress: 'Jl. Malioboro No. 12, Yogyakarta',
            destinationCity: 'Yogyakarta',
            serviceType: 'Antar sampai tujuan',
            weight: '2.5',
            length: '20',
            width: '15',
            height: '10',
            calo: 10000,
            lb: '',
            paymentStatus: 'Lunas'
          }
        ]);
      }
    });

    return () => {
      unsubShipments();
      unsubCustomers();
    };
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3500);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (usernameInput === adminCredentials.username && passwordInput === adminCredentials.password) {
      setIsLoggedIn(true);
      localStorage.setItem('mataram76_admin_session', 'true');
      setLoginError('');
      showToast('Login Berhasil! Terhubung ke Cloud Firebase.');
    } else {
      setLoginError('Username atau Password salah!');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('mataram76_admin_session');
    setUsernameInput('');
    setPasswordInput('');
    showToast('Berhasil logout.', 'info');
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-xl border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 mb-4">
              <Truck className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Mataram76</h1>
            <p className="text-slate-400 text-sm mt-1">Sistem Cloud Agen Pengangkutan Paket Cepat</p>
          </div>

          {loginError && (
            <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Username</label>
              <div className="relative">
                <User className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  required
                  className="w-full pl-11 pr-4 py-3 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                  placeholder=""
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Password</label>
              <div className="relative">
                <ShieldCheck className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  required
                  className="w-full pl-11 pr-4 py-3 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                  placeholder=""
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-600/30 transition-all transform active:scale-[0.98]"
            >
              Masuk ke Sistem
            </button>
          </form>

          <div className="mt-8 text-center text-xs text-slate-500 border-t border-slate-800 pt-4 flex items-center justify-center gap-1.5">
            <Cloud className="w-4 h-4 text-emerald-400" />
            <span>Firebase Connected (kikyaditya5757@gmail.com)</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {toast.show && (
        <div className="fixed top-5 right-5 z-50 animate-bounce bg-slate-900 border border-indigo-500/50 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Top Navbar */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-4 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-600/30">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-white tracking-wide">Mataram76</h1>
            <p className="text-xs text-slate-400">Agen pengangkutan paket cepat</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700/50 text-xs text-slate-300">
            <Cloud className="w-3.5 h-3.5 text-emerald-400" />
            <span>Cloud Database Aktif</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 border border-slate-700 rounded-xl text-xs font-medium transition-all"
            title="Keluar"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-slate-900/50 backdrop-blur border-b border-slate-800/80 px-4 lg:px-8 overflow-x-auto scrollbar-none">
        <div className="flex space-x-1 sm:space-x-2 py-2">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'input', label: 'Input Pengiriman', icon: PlusCircle },
            { id: 'shipments', label: 'Data Pengiriman', icon: Package },
            { id: 'customers', label: 'Data Pelanggan', icon: Users },
            { id: 'reports', label: 'Rekap & Laporan', icon: FileText },
            { id: 'settings', label: 'Settings Ongkir', icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full">
        {activeTab === 'dashboard' && <DashboardView shipments={shipments} setActiveTab={setActiveTab} setSelectedReceipt={setSelectedReceipt} />}
        {activeTab === 'input' && <InputShippingView shipments={shipments} setShipments={setShipments} customers={customers} setCustomers={setCustomers} settings={settings} setSelectedReceipt={setSelectedReceipt} showToast={showToast} initialData={quickInputData} setInitialData={setQuickInputData} />}
        {activeTab === 'shipments' && <ShipmentsListView shipments={shipments} setShipments={setShipments} customers={customers} setCustomers={setCustomers} setSelectedReceipt={setSelectedReceipt} showToast={showToast} />}
        {activeTab === 'customers' && <CustomersView customers={customers} setCustomers={setCustomers} shipments={shipments} showToast={showToast} setActiveTab={setActiveTab} setQuickInputData={setQuickInputData} />}
        {activeTab === 'reports' && <ReportsView shipments={shipments} setShipments={setShipments} showToast={showToast} />}
        {activeTab === 'settings' && <SettingsView settings={settings} setSettings={setSettings} adminCredentials={adminCredentials} setAdminCredentials={setAdminCredentials} showToast={showToast} />}
      </main>

      {selectedReceipt && (
        <ReceiptModal receipt={selectedReceipt} onClose={() => setSelectedReceipt(null)} />
      )}
    </div>
  );
}

function DashboardView({ shipments, setActiveTab, setSelectedReceipt }) {
  const todayStr = new Date().toISOString().split('T')[0];
  const todayShipments = shipments.filter(s => s.date === todayStr);
  const totalPackagesToday = todayShipments.length;
  const totalRevenueToday = todayShipments.reduce((sum, s) => sum + (Number(s.shippingCost) || 0), 0);
  const totalRevenueAll = shipments.reduce((sum, s) => sum + (Number(s.shippingCost) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-indigo-900/50 via-slate-900 to-slate-900 border border-indigo-500/20 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Selamat Datang di Mataram76</h2>
            <p className="text-slate-300 text-sm mt-1">Sistem cloud manajemen agen pengangkutan paket cepat.</p>
          </div>
          <button
            onClick={() => setActiveTab('input')}
            className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-600/30 transition-all text-sm"
          >
            <PlusCircle className="w-5 h-5" />
            <span>Input Paket Baru</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Paket Hari Ini</p>
            <h3 className="text-3xl font-extrabold text-white mt-2">{totalPackagesToday}</h3>
            <p className="text-xs text-emerald-400 mt-1">Tanggal: {todayStr}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Package className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Pendapatan Hari Ini</p>
            <h3 className="text-2xl font-extrabold text-white mt-2">Rp {totalRevenueToday.toLocaleString('id-ID')}</h3>
            <p className="text-xs text-emerald-400 mt-1">Status lunas/belum</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Total Seluruh Paket</p>
            <h3 className="text-3xl font-extrabold text-white mt-2">{shipments.length}</h3>
            <p className="text-xs text-indigo-400 mt-1">Tercatat di cloud</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Truck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Total Pendapatan</p>
            <h3 className="text-2xl font-extrabold text-white mt-2">Rp {totalRevenueAll.toLocaleString('id-ID')}</h3>
            <p className="text-xs text-indigo-400 mt-1">Akumulasi keseluruhan</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <FileText className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Pengiriman Terbaru Hari Ini</h3>
          <button
            onClick={() => setActiveTab('shipments')}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
          >
            <span>Lihat Semua</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {todayShipments.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-sm">
            Belum ada pengiriman tercatat hari ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs">
                <tr>
                  <th className="p-3 rounded-l-xl">No Resi</th>
                  <th className="p-3">Pengirim</th>
                  <th className="p-3">Penerima</th>
                  <th className="p-3">Tujuan</th>
                  <th className="p-3">Ongkir</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 rounded-r-xl text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {todayShipments.map((item) => (
                  <tr key={item.id || item.firebaseId} className="hover:bg-slate-800/30 transition-all">
                    <td className="p-3 font-mono font-medium text-indigo-400">{item.id}</td>
                    <td className="p-3">
                      <div className="font-medium text-white">{item.senderName}</div>
                      <div className="text-xs text-slate-400">{item.senderPhone}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-white">{item.receiverName}</div>
                      <div className="text-xs text-slate-400">{item.destinationCity}</div>
                    </td>
                    <td className="p-3 text-slate-300">{item.destinationCity}</td>
                    <td className="p-3 font-medium text-white">Rp {Number(item.shippingCost).toLocaleString('id-ID')}</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        item.paymentStatus === 'Lunas' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {item.paymentStatus}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => setSelectedReceipt(item)}
                        className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-lg text-xs font-medium transition-all inline-flex items-center gap-1.5"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Resi</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function InputShippingView({ shipments, setShipments, customers, setCustomers, settings, setSelectedReceipt, showToast, initialData, setInitialData }) {
  const [formData, setFormData] = useState({
    senderName: initialData?.senderName || '',
    senderPhone: initialData?.senderPhone || '',
    senderAddress: initialData?.senderAddress || '',
    receiverName: initialData?.receiverName || '',
    receiverPhone: initialData?.receiverPhone || '',
    receiverAddress: initialData?.receiverAddress || '',
    serviceType: initialData?.serviceType || 'Antar sampai tujuan',
    weight: initialData?.weight || '',
    length: initialData?.length || '',
    width: initialData?.width || '',
    height: initialData?.height || '',
    destinationCity: initialData?.destinationCity || settings.zones[0]?.city || 'Yogyakarta',
    shippingCost: '',
    calo: initialData?.calo || '',
    lb: initialData?.lb || '',
    paymentStatus: initialData?.paymentStatus || 'Lunas'
  });

  const [senderSuggestions, setSenderSuggestions] = useState([]);
  const [receiverSuggestions, setReceiverSuggestions] = useState([]);

  useEffect(() => {
    if (!settings.autoCalculate) return;

    let cost = 0;
    const zoneObj = settings.zones.find(z => z.city.toLowerCase() === formData.destinationCity.toLowerCase());
    if (zoneObj) {
      cost += zoneObj.price;
    } else {
      cost += 30000;
    }

    const weightNum = parseFloat(formData.weight) || 0;
    if (weightNum > settings.standardWeight) {
      const extraKg = weightNum - settings.standardWeight;
      cost += extraKg * settings.pricePerKg;
    }

    const l = parseFloat(formData.length) || 0;
    const w = parseFloat(formData.width) || 0;
    const h = parseFloat(formData.height) || 0;
    const volume = l * w * h;
    if (volume > settings.dimensionThreshold) {
      cost += settings.dimensionSurcharge;
    }

    setFormData(prev => ({ ...prev, shippingCost: cost }));
  }, [formData.destinationCity, formData.weight, formData.length, formData.width, formData.height, settings]);

  const handleSenderChange = (e) => {
    const val = formatEYD(e.target.value);
    setFormData(prev => ({ ...prev, senderName: val }));
    if (val.trim().length > 0) {
      const filtered = customers.filter(c => 
        c.senderName.toLowerCase().includes(val.toLowerCase()) || c.senderPhone.includes(val)
      );
      setSenderSuggestions(filtered);
    } else {
      setSenderSuggestions([]);
    }
  };

  const selectSender = (cust) => {
    setFormData(prev => ({
      ...prev,
      senderName: cust.senderName,
      senderPhone: cust.senderPhone,
      senderAddress: cust.senderAddress || '',
      receiverName: cust.receiverName || prev.receiverName,
      receiverPhone: cust.receiverPhone || prev.receiverPhone,
      receiverAddress: cust.receiverAddress || prev.receiverAddress,
      destinationCity: cust.destinationCity || prev.destinationCity,
      serviceType: cust.serviceType || prev.serviceType,
      calo: cust.calo ?? prev.calo,
      lb: cust.lb ?? prev.lb,
      paymentStatus: cust.paymentStatus || prev.paymentStatus
    }));
    setSenderSuggestions([]);
  };

  const handleReceiverChange = (e) => {
    const val = formatEYD(e.target.value);
    setFormData(prev => ({ ...prev, receiverName: val }));
    if (val.trim().length > 0) {
      const filtered = customers.filter(c => 
        c.receiverName.toLowerCase().includes(val.toLowerCase()) || c.receiverPhone.includes(val)
      );
      setReceiverSuggestions(filtered);
    } else {
      setReceiverSuggestions([]);
    }
  };

  const selectReceiver = (cust) => {
    setFormData(prev => ({
      ...prev,
      receiverName: cust.receiverName,
      receiverPhone: cust.receiverPhone,
      receiverAddress: cust.receiverAddress || ''
    }));
    setReceiverSuggestions([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const hours = String(today.getHours()).padStart(2, '0');
    const minutes = String(today.getMinutes()).padStart(2, '0');
    const newResiId = generateNextResiId(shipments);

    const newShipment = {
      id: newResiId,
      date: `${yyyy}-${mm}-${dd}`,
      time: `${hours}:${minutes}`,
      ...formData,
      shippingCost: Number(formData.shippingCost) || 0,
      calo: Number(formData.calo) || 0,
      lb: formData.lb || '',
      st: 0,
      sopir: ''
    };

    // Siapkan frame print saat masih berada dalam gesture klik tombol.
    // Ini menghindari popup blocker dan memastikan hanya dokumen nota yang dicetak.
    const printFrame = document.createElement('iframe');
    printFrame.setAttribute('aria-hidden', 'true');
    printFrame.style.position = 'fixed';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    printFrame.style.opacity = '0';
    printFrame.style.pointerEvents = 'none';
    printFrame.style.left = '-10000px';
    printFrame.style.top = '0';
    document.body.appendChild(printFrame);

    try {
      await addDoc(collection(db, 'shipments'), newShipment);
      if (setInitialData) setInitialData(null);
      showToast(`Paket berhasil disimpan ke Cloud dengan Resi: ${newResiId}`);
      printReceiptDirectly(newShipment, printFrame);
      // Tidak membuka ReceiptModal setelah penyimpanan.
    } catch (err) {
      printFrame.remove();
      console.error("Error saving shipment:", err);
      showToast("Gagal menyimpan ke Cloud!", "error");
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 lg:p-8 shadow-xl max-w-4xl mx-auto">
      <div className="mb-6 border-b border-slate-800 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-indigo-500" />
            <span>Input Pengiriman Paket Baru</span>
          </h2>
          <p className="text-slate-400 text-xs mt-1">Lengkapi data pengirim, penerima, serta detail paket barang titipan.</p>
        </div>
        {initialData && (
          <button
            onClick={() => setInitialData(null)}
            className="text-xs bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white px-3 py-1.5 rounded-lg transition-all"
          >
            Reset Quick Fill
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 space-y-4 relative">
            <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
              <User className="w-4 h-4" />
              <span>Data Pengirim</span>
            </h3>

            <div className="relative">
              <label className="block text-xs font-medium text-slate-300 mb-1">Nama Pengirim *</label>
              <input
                type="text"
                required
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ketik nama pengirim..."
                value={formData.senderName}
                onChange={handleSenderChange}
              />
              {senderSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 z-30 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                  {senderSuggestions.map((c, idx) => (
                    <div
                      key={c.firebaseId || idx}
                      onClick={() => selectSender(c)}
                      className="px-3.5 py-2 hover:bg-slate-700 cursor-pointer text-xs border-b border-slate-700/50 last:border-0"
                    >
                      <div className="font-semibold text-white">{c.senderName}</div>
                      <div className="text-slate-400">{c.senderPhone} - {c.destinationCity}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">No HP Pengirim *</label>
              <input
                type="text"
                required
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Contoh: 08123456789"
                value={formData.senderPhone}
                onChange={(e) => setFormData(prev => ({ ...prev, senderPhone: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Alamat Pengirim (Opsional)</label>
              <textarea
                rows="2"
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                placeholder="Alamat asal pengirim..."
                value={formData.senderAddress}
                onChange={(e) => setFormData(prev => ({ ...prev, senderAddress: formatEYD(e.target.value) }))}
              />
            </div>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 space-y-4 relative">
            <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <User className="w-4 h-4" />
              <span>Data Penerima</span>
            </h3>

            <div className="relative">
              <label className="block text-xs font-medium text-slate-300 mb-1">Nama Penerima *</label>
              <input
                type="text"
                required
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ketik nama penerima..."
                value={formData.receiverName}
                onChange={handleReceiverChange}
              />
              {receiverSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 z-30 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                  {receiverSuggestions.map((c, idx) => (
                    <div
                      key={c.firebaseId || idx}
                      onClick={() => selectReceiver(c)}
                      className="px-3.5 py-2 hover:bg-slate-700 cursor-pointer text-xs border-b border-slate-700/50 last:border-0"
                    >
                      <div className="font-semibold text-white">{c.receiverName}</div>
                      <div className="text-slate-400">{c.receiverPhone} - {c.receiverAddress}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">No HP Penerima *</label>
              <input
                type="text"
                required
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Contoh: 08987654321"
                value={formData.receiverPhone}
                onChange={(e) => setFormData(prev => ({ ...prev, receiverPhone: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Alamat Lengkap Penerima *</label>
              <textarea
                rows="2"
                required
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                placeholder="Jalan, No Rumah, RT/RW, Kota..."
                value={formData.receiverAddress}
                onChange={(e) => setFormData(prev => ({ ...prev, receiverAddress: formatEYD(e.target.value) }))}
              />
            </div>
          </div>
        </div>

        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
            <Package className="w-4 h-4" />
            <span>Detail Paket & Layanan Pengiriman</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Kota/Zona Tujuan *</label>
              <select
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={formData.destinationCity}
                onChange={(e) => setFormData(prev => ({ ...prev, destinationCity: e.target.value }))}
              >
                {[...settings.zones].sort((a,b) => a.city.localeCompare(b.city, 'id', { sensitivity: 'base' })).map((z, idx) => (
                  <option key={`${z.city}-${idx}`} value={z.city}>{z.city} (Base: Rp {z.price.toLocaleString('id-ID')})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Jenis Layanan *</label>
              <select
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={formData.serviceType}
                onChange={(e) => setFormData(prev => ({ ...prev, serviceType: e.target.value }))}
              >
                <option value="Antar sampai tujuan">Antar sampai tujuan</option>
                <option value="Ambil di agen">Ambil di agen</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Status Pembayaran *</label>
              <select
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={formData.paymentStatus}
                onChange={(e) => setFormData(prev => ({ ...prev, paymentStatus: e.target.value }))}
              >
                <option value="Lunas">Lunas</option>
                <option value="Tagih">Tagih</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Berat (kg) - Opsional</label>
              <input
                type="number"
                step="0.1"
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Contoh: 2.5"
                value={formData.weight}
                onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Panjang (cm)</label>
              <input
                type="number"
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="P (cm)"
                value={formData.length}
                onChange={(e) => setFormData(prev => ({ ...prev, length: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Lebar (cm)</label>
              <input
                type="number"
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="L (cm)"
                value={formData.width}
                onChange={(e) => setFormData(prev => ({ ...prev, width: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Tinggi (cm)</label>
              <input
                type="number"
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="T (cm)"
                value={formData.height}
                onChange={(e) => setFormData(prev => ({ ...prev, height: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Ongkos Kirim (Rp) {settings.autoCalculate ? <span className="text-indigo-400 font-normal">(Auto-hitung)</span> : <span className="text-amber-400 font-normal">(Manual)</span>}
              </label>
              <input
                type="number"
                required
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-bold text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Total Ongkir"
                value={formData.shippingCost}
                onChange={(e) => setFormData(prev => ({ ...prev, shippingCost: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Calo (Rp) - Opsional</label>
              <input
                type="number"
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Biaya Calo"
                value={formData.calo}
                onChange={(e) => setFormData(prev => ({ ...prev, calo: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">LB (Keterangan) - Opsional</label>
              <input
                type="text"
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Contoh: Fragile"
                value={formData.lb}
                onChange={(e) => setFormData(prev => ({ ...prev, lb: formatEYD(e.target.value) }))}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            type="submit"
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
          >
            <Printer className="w-5 h-5" />
            <span>Simpan ke Cloud & Cetak Resi</span>
          </button>
        </div>
      </form>
    </div>
  );
}

function ShipmentsListView({ shipments, setShipments, customers, setCustomers, setSelectedReceipt, showToast }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const filteredShipments = shipments.filter(item => {
    const matchSearch = 
      item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.senderName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.receiverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.destinationCity.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchDate = filterDate ? item.date === filterDate : true;

    return matchSearch && matchDate;
  });

  const handleDelete = async (firebaseId, id) => {
    if (window.confirm(`Yakin ingin menghapus data pengiriman ${id}?`)) {
      try {
        if (firebaseId) {
          await deleteDoc(doc(db, 'shipments', firebaseId));
        } else {
          setShipments(prev => prev.filter(s => s.id !== id));
        }
        showToast('Data pengiriman berhasil dihapus.', 'info');
      } catch (err) {
        console.error("Delete shipment error:", err);
        showToast('Gagal menghapus data!', 'error');
      }
    }
  };

  const handleSaveToCustomer = async (item) => {
    const customerRecord = {
      senderName: item.senderName,
      senderPhone: item.senderPhone,
      senderAddress: item.senderAddress || '',
      receiverName: item.receiverName,
      receiverPhone: item.receiverPhone,
      receiverAddress: item.receiverAddress,
      serviceType: item.serviceType,
      weight: item.weight || '',
      length: item.length || '',
      width: item.width || '',
      height: item.height || '',
      destinationCity: item.destinationCity,
      calo: item.calo || 0,
      lb: item.lb || '',
      st: item.st || 0,
      paymentStatus: item.paymentStatus
    };

    try {
      await addDoc(collection(db, 'customers'), customerRecord);
      showToast(`Data pengiriman ${item.id} berhasil disimpan ke Data Pelanggan Cloud!`);
    } catch (err) {
      console.error("Error saving customer:", err);
      showToast("Gagal menyimpan ke pelanggan!", "error");
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 lg:p-8 shadow-xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-500" />
            <span>Data Pengiriman</span>
          </h2>
          <p className="text-slate-400 text-xs mt-1">Cari, cetak kembali resi, simpan ke pelanggan, atau kelola data paket.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Cari resi / nama..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div>
            <input
              type="date"
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
          </div>

          {filterDate && (
            <button
              onClick={() => setFilterDate('')}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
            >
              Reset Tanggal
            </button>
          )}
        </div>
      </div>

      {filteredShipments.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">
          Tidak ada data pengiriman yang ditemukan.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs">
              <tr>
                <th className="p-3 rounded-l-xl">No Resi</th>
                <th className="p-3">Tanggal</th>
                <th className="p-3">Pengirim</th>
                <th className="p-3">Penerima</th>
                <th className="p-3">Tujuan</th>
                <th className="p-3">Ongkir</th>
                <th className="p-3">Status</th>
                <th className="p-3 rounded-r-xl text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredShipments.map((item, idx) => (
                <tr key={item.firebaseId || idx} className="hover:bg-slate-800/30 transition-all">
                  <td className="p-3 font-mono font-medium text-indigo-400">{item.id}</td>
                  <td className="p-3 text-slate-300">{item.date}</td>
                  <td className="p-3">
                    <div className="font-medium text-white">{item.senderName}</div>
                    <div className="text-xs text-slate-400">{item.senderPhone}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-medium text-white">{item.receiverName}</div>
                    <div className="text-xs text-slate-400">{item.receiverPhone}</div>
                  </td>
                  <td className="p-3 text-slate-300">{item.destinationCity}</td>
                  <td className="p-3 font-medium text-white">Rp {Number(item.shippingCost).toLocaleString('id-ID')}</td>
                  <td className="p-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      item.paymentStatus === 'Lunas' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {item.paymentStatus}
                    </span>
                  </td>
                  <td className="p-3 text-right space-x-1.5">
                    <button
                      onClick={() => handleSaveToCustomer(item)}
                      className="px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-lg text-xs font-medium transition-all inline-flex items-center gap-1"
                      title="Simpan ke Pelanggan"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5" />
                      <span className="hidden xl:inline">Save</span>
                    </button>
                    <button
                      onClick={() => setSelectedReceipt(item)}
                      className="px-2.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-lg text-xs font-medium transition-all inline-flex items-center gap-1"
                      title="Cetak Resi"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.firebaseId, item.id)}
                      className="px-2.5 py-1.5 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white rounded-lg text-xs font-medium transition-all inline-flex items-center gap-1"
                      title="Hapus"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CustomersView({ customers, setCustomers, shipments, showToast, setActiveTab, setQuickInputData }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const filteredCustomers = customers.filter(c => 
    c.senderName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.senderPhone.includes(searchTerm) ||
    c.receiverName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeleteCustomer = async (firebaseId) => {
    if (window.confirm('Yakin ingin menghapus data pelanggan ini?')) {
      try {
        if (firebaseId) {
          await deleteDoc(doc(db, 'customers', firebaseId));
        }
        if (selectedCustomer?.firebaseId === firebaseId) setSelectedCustomer(null);
        showToast('Data pelanggan berhasil dihapus dari Cloud.', 'info');
      } catch (err) {
        console.error("Error deleting customer:", err);
        showToast('Gagal menghapus pelanggan!', 'error');
      }
    }
  };

  const handleUseCustomerData = (cust) => {
    setQuickInputData({
      senderName: cust.senderName || '',
      senderPhone: cust.senderPhone || '',
      senderAddress: cust.senderAddress || '',
      receiverName: cust.receiverName || '',
      receiverPhone: cust.receiverPhone || '',
      receiverAddress: cust.receiverAddress || '',
      serviceType: cust.serviceType || 'Antar sampai tujuan',
      weight: cust.weight || '',
      length: cust.length || '',
      width: cust.width || '',
      height: cust.height || '',
      destinationCity: cust.destinationCity || 'Yogyakarta',
      calo: cust.calo || '',
      lb: cust.lb || '',
      paymentStatus: cust.paymentStatus || 'Lunas'
    });
    setActiveTab('input');
    showToast(`Memuat data "${cust.senderName}" ke form Input Pengiriman.`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" />
            <span>Database Pelanggan</span>
          </h2>
          <p className="text-slate-400 text-xs mt-1">Pilih pelanggan untuk melihat detail lengkap atau gunakan langsung untuk kirim paket baru.</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Cari pengirim / penerima..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">Pelanggan tidak ditemukan.</div>
          ) : (
            filteredCustomers.map((c, idx) => (
              <div
                key={c.firebaseId || idx}
                className={`p-3.5 rounded-xl border transition-all ${
                  selectedCustomer?.firebaseId === c.firebaseId 
                    ? 'bg-indigo-600/20 border-indigo-500/50 text-white' 
                    : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 cursor-pointer" onClick={() => setSelectedCustomer(c)}>
                    <div className="font-semibold text-sm text-white">{c.senderName} ({c.senderPhone})</div>
                    <div className="text-xs text-slate-400 mt-1">
                      Penerima: <span className="text-slate-200">{c.receiverName}</span> ({c.destinationCity})
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteCustomer(c.firebaseId)}
                    className="p-1.5 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white rounded-lg transition-all shrink-0"
                    title="Hapus pelanggan"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        {selectedCustomer ? (
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">Detail Data Pelanggan</h3>
                <p className="text-xs text-slate-400 mt-0.5">Semua data tersimpan (kecuali No Resi, Tanggal, dan Ongkir)</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleUseCustomerData(selectedCustomer)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Kirim Paket Lagi (Gunakan Data Ini)</span>
                </button>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="text-xs text-slate-400 hover:text-white px-3 py-2 bg-slate-800 rounded-xl"
                >
                  Tutup
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-indigo-400">Pengirim</div>
                <div><span className="text-slate-400 text-xs">Nama:</span> <span className="font-semibold text-white">{selectedCustomer.senderName}</span></div>
                <div><span className="text-slate-400 text-xs">No HP:</span> <span className="text-slate-200">{selectedCustomer.senderPhone}</span></div>
                <div><span className="text-slate-400 text-xs">Alamat:</span> <span className="text-slate-200">{selectedCustomer.senderAddress || '-'}</span></div>
              </div>

              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">Penerima</div>
                <div><span className="text-slate-400 text-xs">Nama:</span> <span className="font-semibold text-white">{selectedCustomer.receiverName}</span></div>
                <div><span className="text-slate-400 text-xs">No HP:</span> <span className="text-slate-200">{selectedCustomer.receiverPhone}</span></div>
                <div><span className="text-slate-400 text-xs">Alamat:</span> <span className="text-slate-200">{selectedCustomer.receiverAddress}</span></div>
              </div>
            </div>

            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block">Tujuan</span>
                <span className="font-semibold text-white text-sm">{selectedCustomer.destinationCity}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Layanan</span>
                <span className="font-semibold text-white text-sm">{selectedCustomer.serviceType}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Berat / Dimensi</span>
                <span className="font-semibold text-white text-sm">
                  {selectedCustomer.weight ? `${selectedCustomer.weight}kg` : '-'} 
                  {selectedCustomer.length ? ` (${selectedCustomer.length}x${selectedCustomer.width}x${selectedCustomer.height})` : ''}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Calo & Status</span>
                <span className="font-semibold text-white text-sm">Rp {Number(selectedCustomer.calo || 0).toLocaleString('id-ID')} ({selectedCustomer.paymentStatus})</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-slate-500">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Pilih salah satu pelanggan di daftar sebelah kiri untuk melihat detail data.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ReportsView({ shipments, setShipments, showToast }) {
  const [filterType, setFilterType] = useState('daily');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredShipments = useMemo(() => {
    let result = [...shipments];
    const today = new Date();

    if (filterType === 'daily') {
      const todayStr = today.toISOString().split('T')[0];
      result = result.filter(s => s.date === todayStr);
    } else if (filterType === 'weekly') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(today.getDate() - 7);
      result = result.filter(s => new Date(s.date) >= oneWeekAgo);
    } else if (filterType === 'monthly') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(today.getMonth() - 1);
      result = result.filter(s => new Date(s.date) >= oneMonthAgo);
    }

    if (startDate && endDate) {
      result = result.filter(s => s.date >= startDate && s.date <= endDate);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      result = result.filter(s =>
        s.id.toLowerCase().includes(q) ||
        s.senderName.toLowerCase().includes(q) ||
        s.receiverName.toLowerCase().includes(q) ||
        (s.sopir && s.sopir.toLowerCase().includes(q))
      );
    }

    return result;
  }, [shipments, filterType, startDate, endDate, searchTerm]);

  const handleUpdateField = async (firebaseId, id, field, value) => {
    try {
      if (firebaseId) {
        await updateDoc(doc(db, 'shipments', firebaseId), { [field]: value });
      } else {
        setShipments(prev => prev.map(item => {
          if (item.id === id) {
            return { ...item, [field]: value };
          }
          return item;
        }));
      }
    } catch (err) {
      console.error("Error updating shipment field:", err);
      showToast("Gagal memperbarui ke Cloud!", "error");
    }
  };

  const totalRevenue = filteredShipments.reduce((sum, s) => sum + (Number(s.shippingCost) || 0), 0);
  
  const totalNetIncome = filteredShipments.reduce((sum, s) => {
    const cost = Number(s.shippingCost) || 0;
    const calo = Number(s.calo) || 0;
    const st = Number(s.st) || 0;
    return sum + (cost - calo - st);
  }, 0);

  const exportToExcel = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "No Resi,Tanggal,Pengirim,Penerima,Tujuan,Ongkos Kirim,Calo,ST,Sopir,Pendapatan Bersih\n";

    filteredShipments.forEach(item => {
      const cost = Number(item.shippingCost) || 0;
      const calo = Number(item.calo) || 0;
      const st = Number(item.st) || 0;
      const net = cost - calo - st;

      const row = [
        item.id,
        item.date,
        `"${item.senderName}"`,
        `"${item.receiverName}"`,
        `"${item.destinationCity}"`,
        cost,
        calo,
        st,
        `"${item.sopir || ''}"`,
        net
      ];
      csvContent += row.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Rekap_Keuangan_Mataram76_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {filteredShipments.some(s => !s.sopir || s.sopir.trim() === '') && (
        <div className="bg-amber-500/10 border border-amber-500/40 text-amber-300 p-4 rounded-2xl flex items-center gap-3 shadow-lg animate-pulse">
          <AlertTriangle className="w-6 h-6 shrink-0 text-amber-400" />
          <div className="text-xs sm:text-sm">
            <span className="font-bold">PERINGATAN:</span> Ada transaksi dalam rekap ini yang <span className="underline font-semibold">nama sopirnya belum diisi</span>. Mohon periksa dan lengkapi pada kolom sopir di tabel bawah.
          </div>
        </div>
      )}

      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 lg:p-8 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" />
              <span>Rekap & Laporan Pendapatan</span>
            </h2>
            <p className="text-slate-400 text-xs mt-1">Isi langsung kolom ST dan Nama Sopir di tabel bawah. Pendapatan Bersih dihitung otomatis dari (Ongkos Kirim - Calo - ST).</p>
          </div>

          <button
            onClick={exportToExcel}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all self-start md:self-auto"
          >
            <Download className="w-4 h-4" />
            <span>Export ke Excel (CSV)</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-800/40 p-4 rounded-xl border border-slate-700/60">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Rentang Laporan</label>
            <select
              className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setStartDate(''); setEndDate(''); }}
            >
              <option value="daily">Hari Ini</option>
              <option value="weekly">7 Hari Terakhir</option>
              <option value="monthly">30 Hari Terakhir</option>
              <option value="all">Semua Waktu</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Dari Tanggal</label>
            <input
              type="date"
              className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Sampai Tanggal</label>
            <input
              type="date"
              className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Cari Resi / Nama / Sopir</label>
            <div className="relative">
              <Search className="absolute left-3.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Cth: MTR-0001 / Joko"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Total Pendapatan (Kotor)</p>
            <h3 className="text-3xl font-extrabold text-white mt-1">Rp {totalRevenue.toLocaleString('id-ID')}</h3>
            <p className="text-xs text-indigo-400 mt-1">{filteredShipments.length} paket tercatat dalam filter</p>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
            <p className="text-xs uppercase tracking-wider text-emerald-400 font-semibold">Total Pendapatan Bersih (Ongkir - Calo - ST)</p>
            <h3 className="text-3xl font-extrabold text-emerald-400 mt-1">Rp {totalNetIncome.toLocaleString('id-ID')}</h3>
            <p className="text-xs text-emerald-400 mt-1">Akumulasi bersih setelah dikurangi Calo dan ST</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/60 text-slate-400 uppercase">
              <tr>
                <th className="p-3 rounded-l-xl">No Resi / Tanggal</th>
                <th className="p-3">Pengirim</th>
                <th className="p-3">Tujuan</th>
                <th className="p-3 font-bold text-white">Ongkir</th>
                <th className="p-3">Calo</th>
                <th className="p-3 text-amber-400">ST (Input Manual)</th>
                <th className="p-3 text-indigo-300">Sopir (Input Manual)</th>
                <th className="p-3 rounded-r-xl font-bold text-emerald-400">Pendapatan Bersih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredShipments.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-10 text-slate-500 font-sans text-sm">
                    Tidak ada data laporan pada periode ini.
                  </td>
                </tr>
              ) : (
                filteredShipments.map((item, idx) => {
                  const cost = Number(item.shippingCost) || 0;
                  const calo = Number(item.calo) || 0;
                  const st = Number(item.st) || 0;
                  const net = cost - calo - st;
                  const isSopirEmpty = !item.sopir || item.sopir.trim() === '';

                  return (
                    <tr key={item.firebaseId || idx} className={`hover:bg-slate-800/30 transition-all ${isSopirEmpty ? 'bg-amber-500/5' : ''}`}>
                      <td className="p-3">
                        <div className="font-mono font-bold text-indigo-400">{item.id}</div>
                        <div className="text-[10px] text-slate-400">{item.date} {item.time && `(${item.time})`}</div>
                      </td>
                      <td className="p-3 text-white">{item.senderName}</td>
                      <td className="p-3 text-slate-300">{item.destinationCity}</td>
                      <td className="p-3 font-bold text-white font-mono">Rp {cost.toLocaleString('id-ID')}</td>
                      <td className="p-3 text-slate-300 font-mono">Rp {calo.toLocaleString('id-ID')}</td>
                      <td className="p-3">
                        <input
                          type="number"
                          className="w-24 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white font-mono text-xs focus:ring-1 focus:ring-indigo-500"
                          value={item.st ?? ''}
                          placeholder="0"
                          onChange={(e) => handleUpdateField(item.firebaseId, item.id, 'st', e.target.value)}
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            className={`w-28 px-2 py-1 bg-slate-800 border rounded text-white text-xs focus:ring-1 focus:ring-indigo-500 ${
                              isSopirEmpty ? 'border-amber-500 bg-amber-500/20 text-amber-200 font-semibold' : 'border-slate-700'
                            }`}
                            value={item.sopir ?? ''}
                            placeholder="Nama sopir..."
                            onChange={(e) => handleUpdateField(item.firebaseId, item.id, 'sopir', formatEYD(e.target.value))}
                          />
                          {isSopirEmpty && (
                            <span title="Peringatan: Nama sopir belum diisi!" className="text-amber-400 animate-bounce flex items-center">
                              <AlertTriangle className="w-4 h-4" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 font-bold text-emerald-400 font-mono">Rp {net.toLocaleString('id-ID')}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SettingsView({ settings, setSettings, adminCredentials, setAdminCredentials, showToast }) {
  const [newCity, setNewCity] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [editingZoneIndex, setEditingZoneIndex] = useState(null);
  const [editCity, setEditCity] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [localSettings, setLocalSettings] = useState(settings);

  const [currentPassInput, setCurrentPassInput] = useState('');
  const [newPassInput, setNewPassInput] = useState('');
  const [confirmPassInput, setConfirmPassInput] = useState('');

  const handleAddZone = (e) => {
    e.preventDefault();
    if (!newCity || !newPrice) return;
    const updatedZones = [...localSettings.zones, { city: formatEYD(newCity), price: Number(newPrice) }];
    const updated = { ...localSettings, zones: updatedZones };
    setLocalSettings(updated);
    setSettings(updated);
    setNewCity('');
    setNewPrice('');
    showToast('Zona/Kota berhasil ditambahkan!');
  };

  const handleStartEditZone = (index) => {
    const zone = localSettings.zones[index];
    setEditingZoneIndex(index);
    setEditCity(zone.city);
    setEditPrice(String(zone.price));
  };

  const handleCancelEditZone = () => {
    setEditingZoneIndex(null);
    setEditCity('');
    setEditPrice('');
  };

  const handleSaveEditZone = (e) => {
    e.preventDefault();
    if (editingZoneIndex === null || !editCity.trim() || !editPrice) return;
    const city = formatEYD(editCity.trim());
    if (localSettings.zones.some((z,i) => i !== editingZoneIndex && z.city.trim().toLowerCase() === city.toLowerCase())) {
      showToast('Nama kota sudah ada dalam daftar!', 'error');
      return;
    }
    const zones = localSettings.zones.map((z,i) => i === editingZoneIndex ? { city, price: Number(editPrice) } : z);
    const updated = { ...localSettings, zones };
    setLocalSettings(updated);
    setSettings(updated);
    handleCancelEditZone();
    showToast('Kota dan harga dasar berhasil diperbarui!');
  };

  const handleRemoveZone = (index) => {
    const updatedZones = localSettings.zones.filter((_, idx) => idx !== index);
    const updated = { ...localSettings, zones: updatedZones };
    setLocalSettings(updated);
    setSettings(updated);
    showToast('Zona/Kota berhasil dihapus.', 'info');
  };

  const handleSaveGeneralSettings = async (e) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'settings', 'shipping'), localSettings, { merge: true });
      setSettings(localSettings);
      showToast('Pengaturan ongkir berhasil disimpan ke Cloud!');
    } catch (error) {
      console.error('Gagal menyimpan pengaturan ongkir ke Cloud:', error);
      showToast('Gagal menyimpan pengaturan ongkir ke Cloud!', 'error');
    }
  };

  const handleChangePassword = (e) => {
    e.preventDefault();
    if (currentPassInput !== adminCredentials.password) {
      alert('Password saat ini salah!');
      return;
    }
    if (newPassInput !== confirmPassInput) {
      alert('Konfirmasi password baru tidak cocok!');
      return;
    }
    setAdminCredentials(prev => ({ ...prev, password: newPassInput }));
    setCurrentPassInput('');
    setNewPassInput('');
    setConfirmPassInput('');
    showToast('Password admin berhasil diubah!');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 lg:p-8 shadow-xl space-y-6">
        <div className="border-b border-slate-800 pb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-500" />
            <span>Konfigurasi Ongkos Kirim & Zona</span>
          </h2>
          <p className="text-slate-400 text-xs mt-1">Atur harga dasar per kota tujuan dan mode perhitungan otomatis.</p>
        </div>

        <form onSubmit={handleSaveGeneralSettings} className="space-y-6">
          <div className="flex items-center justify-between bg-slate-800/40 p-4 rounded-xl border border-slate-700/60">
            <div>
              <h3 className="text-sm font-semibold text-white">Mode Hitung Ongkir Otomatis</h3>
              <p className="text-xs text-slate-400">Jika aktif, sistem otomatis menghitung ongkir berdasarkan zona, berat, dan dimensi.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={localSettings.autoCalculate}
                onChange={(e) => setLocalSettings(prev => ({ ...prev, autoCalculate: e.target.checked }))}
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Harga per Kg ({'>'} Standar)</label>
              <input
                type="number"
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={localSettings.pricePerKg}
                onChange={(e) => setLocalSettings(prev => ({ ...prev, pricePerKg: Number(e.target.value) }))}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Berat Standar (kg)</label>
              <input
                type="number"
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={localSettings.standardWeight}
                onChange={(e) => setLocalSettings(prev => ({ ...prev, standardWeight: Number(e.target.value) }))}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Tambahan Dimensi Besar (Rp)</label>
              <input
                type="number"
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={localSettings.dimensionSurcharge}
                onChange={(e) => setLocalSettings(prev => ({ ...prev, dimensionSurcharge: Number(e.target.value) }))}
              />
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Daftar Kota & Harga Dasar</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {localSettings.zones.map((zone, idx) => (
                <div key={`${zone.city}-${idx}`} className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3.5">
                  {editingZoneIndex === idx ? (
                    <form onSubmit={handleSaveEditZone} className="space-y-2">
                      <input type="text" value={editCity} onChange={(e) => setEditCity(formatEYD(e.target.value))} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm" placeholder="Nama Kota/Zona" required />
                      <input type="number" min="0" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm" placeholder="Harga dasar (Rp)" required />
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={handleCancelEditZone} className="px-3 py-1.5 bg-slate-700 rounded-lg text-xs">Batal</button>
                        <button type="submit" className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium">Simpan</button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div><div className="font-semibold text-white text-sm">{zone.city}</div><div className="text-xs text-indigo-400 font-mono mt-0.5">Rp {zone.price.toLocaleString('id-ID')}</div></div>
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => handleStartEditZone(idx)} className="p-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-lg" title="Edit kota dan harga dasar"><Edit3 className="w-4 h-4" /></button>
                        <button type="button" onClick={() => handleRemoveZone(idx)} className="p-1.5 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white rounded-lg" title="Hapus kota"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <input
                type="text"
                placeholder="Nama Kota/Zona baru..."
                className="flex-1 px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={newCity}
                onChange={(e) => setNewCity(formatEYD(e.target.value))}
              />
              <input
                type="number"
                placeholder="Harga dasar (Rp)..."
                className="flex-1 px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
              />
              <button
                type="button"
                onClick={handleAddZone}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-all"
              >
                Tambah Zona
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              type="submit"
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-600/30 transition-all text-xs"
            >
              Simpan Pengaturan Ongkir
            </button>
          </div>
        </form>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 lg:p-8 shadow-xl space-y-6">
        <div className="border-b border-slate-800 pb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-500" />
            <span>Keamanan & Akun Admin</span>
          </h2>
          <p className="text-slate-400 text-xs mt-1">Ubah password akun login admin sistem.</p>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Password Saat Ini</label>
            <input
              type="password"
              required
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={currentPassInput}
              onChange={(e) => setCurrentPassInput(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Password Baru</label>
            <input
              type="password"
              required
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={newPassInput}
              onChange={(e) => setNewPassInput(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Konfirmasi Password Baru</label>
            <input
              type="password"
              required
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={confirmPassInput}
              onChange={(e) => setConfirmPassInput(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-600/30 transition-all text-xs"
          >
            Ubah Password
          </button>
        </form>
      </div>
    </div>
  );
}

function ReceiptContent({ receipt, variant }) {
  const st = Number(receipt.st) || 0;
  const calo = Number(receipt.calo) || 0;
  const shippingCost = Number(receipt.shippingCost) || 0;
  const internalNet = shippingCost - calo;
  const netIncome = shippingCost - calo - st;

  const variantLabel = {
    pengirim: 'NOTA PENGIRIM',
    penerima: 'NOTA PENERIMA',
    internal: 'NOTA INTERNAL / ARSIP'
  }[variant];

  return (
    <div className="receipt-thermal bg-white text-black p-3 font-mono text-[11px] leading-tight w-[80mm] mx-auto border border-dashed border-gray-300 mb-6 print:border-none print:mb-0 print:w-[80mm] print:h-[80mm]">
      <div className="text-center border-b border-black pb-2 mb-2">
        <p className="text-[10px] font-bold tracking-wider mb-0.5">*** {variantLabel} ***</p>
        <h1 className="text-lg font-black tracking-widest">MATARAM76</h1>
        <p className="text-[10px] mt-0.5">agen pengangkutan paket cepat</p>
        <p className="text-[9px] mt-0.5">Jl. MT Haryono 76 Semarang</p>
        <p className="text-[9px]">Telp. (024) 3549652 | WA: 08179175780</p>
        
        <div className="mt-1.5 flex items-stretch justify-between border-t border-b border-black py-1 my-1">
          <div className="text-left flex flex-col justify-center">
            <div className="font-bold text-xs">RESI: {receipt.id}</div>
            <div className="text-[9px] mt-0.5">Tgl: {receipt.date}</div>
            {receipt.time && <div className="text-[9px] mt-0.5">Waktu: {receipt.time}</div>}
          </div>
          <div className="border-2 border-black px-2 font-black text-2xl uppercase flex items-center justify-center text-center bg-gray-50 ml-2 min-w-[85px] tracking-wide">
            {receipt.destinationCity || '-'}
          </div>
        </div>
      </div>

      <div className="border-b border-black pb-2 mb-2 space-y-1">
        <div><span className="font-bold">PENGIRIM:</span> {receipt.senderName} ({receipt.senderPhone})</div>
        {receipt.senderAddress && <div><span className="font-bold">Alamat:</span> {receipt.senderAddress}</div>}
        <div className="mt-1"><span className="font-bold">PENERIMA:</span> {receipt.receiverName} ({receipt.receiverPhone})</div>
        <div><span className="font-bold">Alamat:</span> {receipt.receiverAddress}</div>
      </div>

      <div className="border-b border-black pb-2 mb-2 space-y-0.5">
        <div><span className="font-bold">Tujuan:</span> {receipt.destinationCity}</div>
        <div><span className="font-bold">Layanan:</span> {receipt.serviceType}</div>
        {(receipt.weight || receipt.length) && (
          <div><span className="font-bold">Fisik:</span> {receipt.weight ? `${receipt.weight}kg` : ''} {receipt.length ? `(${receipt.length}x${receipt.width}x${receipt.height}cm)` : ''}</div>
        )}
      </div>

      {variant === 'pengirim' && (
        <div className="text-center font-bold text-xs pt-1 border-t border-black">
          TOTAL ONGKIR: Rp {shippingCost.toLocaleString('id-ID')}
        </div>
      )}

      {variant === 'penerima' && (
        <div className="pt-2 space-y-3">
          <div className="text-[10px]">Tanda tangan penerima:</div>
          <div className="pt-10"></div>
        </div>
      )}

      {variant === 'internal' && (
        <div className="space-y-1 pt-1 text-[10px] border-b border-black pb-2 mb-2">
          <div>Ongkir: Rp {shippingCost.toLocaleString('id-ID')}</div>
          {calo > 0 && <div>Calo: - Rp {calo.toLocaleString('id-ID')}</div>}
          <div>LB: {receipt.lb ? receipt.lb : '-'}</div>
          <div className="font-bold pt-1 border-t border-black">
            HASIL: Rp {internalNet.toLocaleString('id-ID')}
          </div>
          <div>ST: Rp {st.toLocaleString('id-ID')}</div>
          <div>Sopir: {receipt.sopir || '-'}</div>
          <div className="font-bold pt-1 border-t border-black text-emerald-800 text-[11px]">
            Pendapatan Bersih: Rp {netIncome.toLocaleString('id-ID')}
          </div>
        </div>
      )}

      <div className="text-center text-[9px] pt-1 border-t border-black mt-2">
        <p>Jika dalam waktu 7 hari tidak ada pengaduan dan pengirim, dianggap telah diterima dengan baik/betul.</p>
      </div>
    </div>
  );
}

function escapePrintHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildReceiptPrintHtml(receipt, variant, pageHeightMm = null, measureOnly = false) {
  const st = Number(receipt.st) || 0;
  const calo = Number(receipt.calo) || 0;
  const shippingCost = Number(receipt.shippingCost) || 0;
  const internalNet = shippingCost - calo;
  const netIncome = shippingCost - calo - st;
  const money = (value) => Number(value || 0).toLocaleString('id-ID');

  const common = `
    <div class="header">
      <div class="label">*** {{TITLE}} ***</div>
      <div class="brand">MATARAM76</div>
      <div class="sub">agen pengangkutan paket cepat</div>
      <div class="tiny">Jl. MT Haryono 76 Semarang</div>
      <div class="tiny">Telp. (024) 3549652 | WA: 08179175780</div>
      <div class="meta">
        <div class="meta-left">
          <div class="resi">RESI: ${escapePrintHtml(receipt.id)}</div>
          <div class="tiny">Tgl: ${escapePrintHtml(receipt.date)}</div>
          ${receipt.time ? `<div class="tiny">Waktu: ${escapePrintHtml(receipt.time)}</div>` : ''}
        </div>
        <div class="city">${escapePrintHtml(receipt.destinationCity || '-')}</div>
      </div>
    </div>
    <div class="section">
      <div class="row"><span class="bold">PENGIRIM:</span> ${escapePrintHtml(receipt.senderName)} (${escapePrintHtml(receipt.senderPhone)})</div>
      ${receipt.senderAddress ? `<div class="row"><span class="bold">Alamat:</span> ${escapePrintHtml(receipt.senderAddress)}</div>` : ''}
      <div class="row"><span class="bold">PENERIMA:</span> ${escapePrintHtml(receipt.receiverName)} (${escapePrintHtml(receipt.receiverPhone)})</div>
      <div class="row"><span class="bold">Alamat:</span> ${escapePrintHtml(receipt.receiverAddress)}</div>
    </div>
    <div class="section">
      <div class="row"><span class="bold">Tujuan:</span> ${escapePrintHtml(receipt.destinationCity)}</div>
      <div class="row"><span class="bold">Layanan:</span> ${escapePrintHtml(receipt.serviceType)}</div>
      ${(receipt.weight || receipt.length) ? `<div class="row"><span class="bold">Fisik:</span> ${receipt.weight ? `${escapePrintHtml(receipt.weight)}kg` : ''} ${receipt.length ? `(${escapePrintHtml(receipt.length)}x${escapePrintHtml(receipt.width)}x${escapePrintHtml(receipt.height)}cm)` : ''}</div>` : ''}
    </div>`;

  const bodies = {
    pengirim: `<div class="total">TOTAL ONGKIR: Rp ${money(shippingCost)}</div>`,
    penerima: `<div class="signature"><div class="tiny">Tanda tangan penerima:</div><div class="signspace"></div></div>`,
    internal: `<div class="internal"><div>Ongkir: Rp ${money(shippingCost)}</div>${calo > 0 ? `<div>Calo: - Rp ${money(calo)}</div>` : ''}<div>LB: ${escapePrintHtml(receipt.lb || '-')}</div><div class="result">HASIL: Rp ${money(internalNet)}</div><div>ST: Rp ${money(st)}</div><div>Sopir: ${escapePrintHtml(receipt.sopir || '-')}</div><div class="net">Pendapatan Bersih: Rp ${money(netIncome)}</div></div>`
  };

  const titles = {
    pengirim: 'NOTA PENGIRIM',
    penerima: 'NOTA PENERIMA',
    internal: 'NOTA INTERNAL / ARSIP'
  };

  const heightRule = pageHeightMm
    ? `@page { size: 80mm ${pageHeightMm}mm; margin: 0; }`
    : '@page { size: 80mm auto; margin: 0; }';

  return `<!doctype html><html><head><meta charset="utf-8"><title>Nota ${escapePrintHtml(receipt.id)} - ${titles[variant]}</title><style>
    ${heightRule}
    html,body { margin:0 !important; padding:0 !important; background:#fff !important; color:#000 !important; width:80mm; }
    body { font-family:"Courier New", monospace; font-weight:700; }
    .receipt-page { width:80mm; margin:0; padding:0; }
    .receipt { width:80mm; max-width:80mm; box-sizing:border-box; padding:4mm; font-size:11px; line-height:1.15; overflow:visible; font-weight:700; }
    .header { text-align:center; border-bottom:1px solid #000; padding-bottom:2mm; margin-bottom:2mm; }
    .label { font-size:10px; font-weight:700; letter-spacing:1px; }
    .brand { font-size:18px; font-weight:900; letter-spacing:3px; }
    .sub,.tiny { font-size:9px; }
    .sub { font-size:10px; margin-top:1px; }
    .meta { display:flex; justify-content:space-between; align-items:stretch; border-top:1px solid #000; border-bottom:1px solid #000; padding:1.2mm 0; margin:1.5mm 0; }
    .meta-left { text-align:left; }
    .resi { font-weight:700; font-size:12px; }
    .city { border:2px solid #000; min-width:28mm; max-width:36mm; padding:1mm 2mm; font-size:18px; font-weight:900; display:flex; align-items:center; justify-content:center; text-align:center; text-transform:uppercase; overflow:hidden; }
    .section { border-bottom:1px solid #000; padding-bottom:2mm; margin-bottom:2mm; }
    .row { margin-bottom:1mm; overflow-wrap:anywhere; word-break:break-word; }
    .bold { font-weight:700; }
    .total { text-align:center; font-weight:700; font-size:12px; border-top:1px solid #000; padding-top:1mm; }
    .signature { padding-top:2mm; }
    .signspace { height:10mm; }
    .internal { font-size:10px; }
    .result { font-weight:700; border-top:1px solid #000; padding-top:1mm; }
    .net { font-weight:700; border-top:1px solid #000; padding-top:1mm; font-size:11px; }
    .footer { text-align:center; font-size:8px; border-top:1px solid #000; padding-top:1mm; margin-top:2mm; overflow-wrap:anywhere; }
    ${measureOnly ? '@media print { @page { size: 80mm auto; margin:0; } }' : ''}
  </style></head><body>
    <section class="receipt-page"><div class="receipt">${common.replace('{{TITLE}}', titles[variant])}${bodies[variant]}<div class="footer">Jika dalam waktu 7 hari tidak ada pengaduan dan pengirim, dianggap telah diterima dengan baik/betul.</div></div></section>
  </body></html>`;
}

function printReceiptDirectly(receipt, printFrame) {
  const variants = ['pengirim', 'penerima', 'internal'];
  let index = 0;

  const createFrame = () => {
    if (index === 0 && printFrame && printFrame.contentWindow) return printFrame;
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    Object.assign(frame.style, {
      position: 'fixed', width: '0', height: '0', border: '0', opacity: '0',
      pointerEvents: 'none', left: '-10000px', top: '0'
    });
    document.body.appendChild(frame);
    return frame;
  };

  const waitForFonts = (doc) => doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve();

  const printNext = () => {
    if (index >= variants.length) return;

    const variant = variants[index];
    const frame = createFrame();
    const doc = frame.contentDocument;
    if (!doc) return;

    // Tahap 1: render nota tanpa page height tetap, lalu ukur tinggi isi sebenarnya.
    doc.open();
    doc.write(buildReceiptPrintHtml(receipt, variant, null, true));
    doc.close();

    waitForFonts(doc).then(() => {
      requestAnimationFrame(() => {
        const receiptEl = doc.querySelector('.receipt');
        if (!receiptEl) {
          frame.remove();
          return;
        }

        const pxToMm = 25.4 / 96;
        let contentHeightMm = receiptEl.getBoundingClientRect().height * pxToMm;
        // Sedikit toleransi untuk rounding printer/browser, tetapi tidak pernah lebih dari 80 mm.
        let pageHeightMm = Math.min(80, Math.max(25, Math.ceil((contentHeightMm + 0.6) * 10) / 10));

        // Jika isi terlalu tinggi, kecilkan font secara proporsional agar tetap muat maksimal 80 mm.
        if (contentHeightMm > 79) {
          const scale = Math.max(0.78, 79 / contentHeightMm);
          receiptEl.style.fontSize = `${11 * scale}px`;
          requestAnimationFrame(() => {
            contentHeightMm = receiptEl.getBoundingClientRect().height * pxToMm;
            pageHeightMm = Math.min(80, Math.max(25, Math.ceil((contentHeightMm + 0.6) * 10) / 10));
            doPrint(frame, variant, pageHeightMm);
          });
        } else {
          doPrint(frame, variant, pageHeightMm);
        }
      });
    });
  };

  const doPrint = (frame, variant, pageHeightMm) => {
    const doc = frame.contentDocument;
    if (!doc) return;

    // Tulis ulang dengan ukuran halaman final hasil pengukuran.
    doc.open();
    doc.write(buildReceiptPrintHtml(receipt, variant, pageHeightMm, false));
    doc.close();

    waitForFonts(doc).then(() => {
      setTimeout(() => {
        let advanced = false;
        const advance = () => {
          if (advanced) return;
          advanced = true;
          index += 1;
          frame.remove();
          if (index < variants.length) setTimeout(printNext, 250);
        };

        frame.contentWindow.addEventListener('afterprint', advance, { once: true });
        frame.contentWindow.focus();
        frame.contentWindow.print();

        // Fallback untuk browser yang tidak meneruskan afterprint pada iframe.
        // Jangan langsung menembakkan print kedua; beri waktu cukup agar dialog pertama selesai.
        setTimeout(() => {
          if (!advanced && document.visibilityState === 'visible') {
            // Tidak memaksa print berikutnya ketika dialog masih terbuka.
            // afterprint tetap menjadi mekanisme utama.
          }
        }, 60000);
      }, 50);
    });
  };

  printNext();
  return true;
}

function ReceiptModal({ receipt, onClose }) {
  const handlePrint = () => {
    // Cetak ulang menggunakan mekanisme print yang sama dengan
    // alur "Simpan ke Cloud & Cetak Resi", tetapi TANPA menyimpan ulang ke Cloud.
    printReceiptDirectly(receipt);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto print-modal-overlay">
      <style>{`
        @media print {
          @page {
            size: 80mm 80mm;
            margin: 0;
          }
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body * {
            visibility: hidden !important;
          }
          #receipt-print-area, #receipt-print-area * {
            visibility: visible !important;
          }
          #receipt-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .receipt-thermal {
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            border: none !important;
            margin: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            min-height: 80mm !important;
            box-shadow: none !important;
            padding: 4mm !important;
          }
        }
      `}</style>
      <div className="bg-slate-100 text-slate-900 rounded-2xl max-w-lg w-full p-4 shadow-2xl relative print:shadow-none print:w-full print:max-w-none print:p-0 print:bg-white">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 w-8 h-8 rounded-full bg-white hover:bg-slate-200 flex items-center justify-center text-slate-600 print:hidden transition-all shadow"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="print:hidden mb-4 pt-2 px-2">
          <h3 className="text-lg font-bold text-slate-800">Cetak 3 Nota Resi (POS-80)</h3>
          <p className="text-xs text-slate-600 mt-1">Nota Pengirim, Penerima, dan Internal (Arsip) diatur masing-masing 1 halaman per nota (Total 3 Halaman).</p>
        </div>

        <div id="receipt-print-area" className="space-y-6 print:space-y-0">
          <ReceiptContent receipt={receipt} variant="pengirim" />
          <ReceiptContent receipt={receipt} variant="penerima" />
          <ReceiptContent receipt={receipt} variant="internal" />
        </div>

        <div className="mt-4 flex items-center justify-end gap-3 print:hidden border-t border-slate-300 pt-4 px-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-medium transition-all"
          >
            Tutup
          </button>
          <button
            onClick={handlePrint}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Nota POS-80 (Ctrl+P)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
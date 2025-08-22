// VipCryptoPay.jsx
import React, { useEffect, useState, useRef } from 'react';
import './VipCryptoPay.css';

const COINGECKO_IDS = { BTC:'bitcoin', ETH:'ethereum', USDT:'tether', USDC:'usd-coin', XRP:'ripple', LTC:'litecoin', DOGE:'dogecoin', ADA:'cardano', SOL:'solana' };
const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price';

function qs() {
  const p = new URLSearchParams(window.location.search);
  return {
    orderId: p.get('orderId') || '',
    token: p.get('token') || '',
    amountEur: Number(p.get('amountEur') || 0),
    coin: (p.get('coin') || '').toUpperCase(),
    success: p.get('success') || '',
    fail: p.get('fail') || '',
  };
}

function buildFailUrl({ baseFail, orderId, reason }) {
  const base = baseFail || '/zahlung-fehlgeschlagen';
  try {
    const u = new URL(base, window.location.origin);
    if (orderId) u.searchParams.set('orderId', orderId);
    if (reason)  u.searchParams.set('reason', reason);
    return u.toString();
  } catch {
    try {
      const u = new URL(base);
      if (orderId) u.searchParams.set('orderId', orderId);
      if (reason)  u.searchParams.set('reason', reason);
      return u.toString();
    } catch {
      return `${base}?orderId=${encodeURIComponent(orderId||'')}&reason=${encodeURIComponent(reason||'')}`;
    }
  }
}

function VipCryptoPay() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(900); // 15 min
  const [selectedCoin, setSelectedCoin] = useState('BTC');
  const [priceEur, setPriceEur] = useState(null);
  const [walletMap, setWalletMap] = useState({});
  const [allowedCoins, setAllowedCoins] = useState([]);
  const [overlay, setOverlay] = useState(false);
  const [customerData, setCustomerData] = useState({ name:'', email:'' });

  const params = qs();

  // Coin-Formatierung
  const COIN_DECIMALS = { BTC:8, ETH:6, LTC:6, SOL:4, ADA:2, DOGE:2, XRP:2, USDT:2, USDC:2 };
  const fmtAmount = (a, sym) => {
    if (a == null || !isFinite(a)) return '–';
    const d = COIN_DECIMALS[sym] ?? 6;
    return a.toFixed(d).replace(/\.?0+$/,'');
  };

  // --- Polling Setup ---
  const pollRef = useRef(null);
  const checkStatus = async () => {
    try {
      const u = new URL('https://www.goldsilverstuff.com/_functions/order');
      u.search = new URLSearchParams({ orderId: params.orderId, token: params.token }).toString();
      const r = await fetch(u.toString(), { method:'GET', mode:'cors', cache:'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      const st = String(j?.status || '').toLowerCase();
      if (st === 'paid') {
        const target = params.success || '/zahlung-erfolgreich';
        const url = new URL(target, window.location.origin);
        if (!url.searchParams.get('orderId')) url.searchParams.set('orderId', params.orderId);
        window.location.href = url.toString();
      } else if (st && st !== 'pending') {
        const target = params.fail || '/zahlung-fehlgeschlagen';
        const url = new URL(target, window.location.origin);
        if (!url.searchParams.get('orderId')) url.searchParams.set('orderId', params.orderId);
        window.location.href = url.toString();
      }
    } catch (_) {}
  };
  const startPolling = () => {
    if (pollRef.current) return;
    pollRef.current = setInterval(checkStatus, 3000);
  };
  useEffect(() => () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } }, []);

  // --- Init ---
  useEffect(() => {
    (async () => {
      if (!params.orderId || !params.token || !params.amountEur) {
        window.location.href = (params.fail ? `${params.fail}&reason=vipinit_params` : '/zahlung-fehlgeschlagen');
        return;
      }
      try {
        const u = new URL('https://www.goldsilverstuff.com/_functions/vipinit');
        u.search = new URLSearchParams({
          orderId: params.orderId, token: params.token,
          amountEur: String(params.amountEur),
          presetCoin: params.coin || ''
        }).toString();
        const r = await fetch(u.toString(), { method: 'GET', mode: 'cors', cache: 'no-store' });
        console.log('[VIPINIT] status', r.status);
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j?.ok) {
          console.error('[VIPINIT] bad response', { status: r.status, j });
          throw new Error(j?.error || `bad_status_${r.status}`);
        }
        setCustomerData({ name: j.name || '', email: j.email || '' });
        setWalletMap(j.walletMap || {});
        const allowed = j.allowedCoins || [];
        setAllowedCoins(allowed);
        const wanted = (params.coin || j.presetCoin || '').toUpperCase();
        const initial = wanted && allowed.includes(wanted) ? wanted : (allowed[0] || 'BTC');
        setSelectedCoin(initial);
        setLoading(false);
      } catch (e) {
        console.error('[VIPINIT] network/error', e);
        const reason = (e && e.message) ? e.message.slice(0,60) : 'vipinit_network';
        const failUrl = params.fail ? `${params.fail}&reason=${encodeURIComponent(reason)}` : '/zahlung-fehlgeschlagen';
        window.location.href = failUrl;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Countdown ---
  useEffect(() => {
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) {
          window.location.href = params.fail || '/zahlung-fehlgeschlagen';
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [params.fail]);

  // --- Preis-Refresh ---
  const fetchPrice = async (symbol) => {
    const id = COINGECKO_IDS[symbol];
    if (!id) return;
    setRefreshing(true);
    try {
      const res = await fetch(`${COINGECKO_URL}?ids=${encodeURIComponent(id)}&vs_currencies=eur`);
      const data = await res.json();
      const v = Number(data?.[id]?.eur || 0) || null;
      setPriceEur(v);
    } catch (e) {
      console.warn('price fetch fail', e);
    }
    setRefreshing(false);
  };
  useEffect(() => {
    if (!selectedCoin) return;
    fetchPrice(selectedCoin);
    const i = setInterval(() => fetchPrice(selectedCoin), 15000);
    return () => clearInterval(i);
  }, [selectedCoin]);

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  async function sendNotify(isBeratung) {
    if (!customerData.email || !customerData.name) {
      alert('Kundendaten fehlen.');
      return;
    }
    if (!selectedCoin || !allowedCoins.includes(selectedCoin)) {
      alert('Bitte einen gültigen VIP-Coin auswählen.');
      return;
    }
    const wallet = walletMap[selectedCoin];
    if (!wallet) {
      alert(`Keine VIP Wallet für ${selectedCoin} konfiguriert.`);
      return;
    }

    setOverlay(true);
    try {
      const payload = {
        orderId: params.orderId,
        token: params.token,
        coin: selectedCoin,
        amountEur: Number(params.amountEur),
        wallet,
        isBeratung: !!isBeratung,
        dbg: 1
      };
      // text/plain vermeidet Preflight
      const r = await fetch('https://www.goldsilverstuff.com/_functions/vipnotify', {
        method: 'POST',
        mode: 'cors',
        cache: 'no-store',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      });
      if (!r.ok) {
        const txt = await r.text().catch(() => '');
        throw new Error(`notify_${r.status}_${txt.slice(0,120)}`);
      }

      // NEU: direkt öffnen, wenn isBeratung=true und Backend URL liefert
      if (isBeratung) {
        let out = null;
        try { out = await r.json(); } catch(_){}
        const direct = out?.jitsi?.guestUrl;
        if (direct) {
          window.open(direct, '_blank');   // Variante B: direkt in den Warteraum
        } else {
          // Fallback (für den Fall, dass Token fehlte oder Secret nicht gesetzt)
          window.open('https://meet.goldsilverstuff.com', '_blank');
        }
      }

      // Ab hier auf Admin-Entscheidung warten → Poll starten
      startPolling();
    } catch (e) {
      console.error('[VIP] vipnotify error', e);
      setOverlay(false);
      alert('Konnte Benachrichtigung nicht senden.');
    }
  }

  if (loading) return <div className="vip-wrapper">Lade…</div>;

  const walletAddr = walletMap[selectedCoin] || '';
  const coinAmount = priceEur ? (Number(params.amountEur) / priceEur) : null;

  return (
    <div className="vip-wrapper">
      <img src="/logo.png" alt="Logo" className="logo" />
      <h2>VIP Crypto Zahlung</h2>

      <div className="vip-input" style={{textAlign:'left', border:'none'}}>
        <div><b>Bestellnummer:</b> {params.orderId}</div>
        <div><b>Kunde:</b> {customerData.name} ({customerData.email})</div>
        <div><b>Gesamt (EUR):</b> {Number(params.amountEur).toFixed(2)} €</div>
      </div>

      <div className="vip-select-wrapper">
        <select value={selectedCoin} onChange={e => setSelectedCoin(e.target.value)} className="vip-select">
          {allowedCoins.map(c => (<option key={c} value={c}>{c}</option>))}
        </select>
        <img src={`/${selectedCoin.toLowerCase()}logo.png`} alt={`${selectedCoin} Logo`} className="vip-select-logo" />
      </div>

      <p>Empfangsadresse:</p>
      <code className="vip-wallet">{walletAddr}</code>
      <img
        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(walletAddr)}`}
        alt="QR Code"
        className="vip-qr"
      />

      <div className="vip-amount">
        {priceEur !== null
          ? <>Zu senden: <b>{fmtAmount(coinAmount, selectedCoin)}</b> {selectedCoin} (~{Number(params.amountEur).toFixed(2)} €)</>
          : 'Zu senden: …'}
      </div>

      <div className="vip-timer">Verbleibende Zeit: {formatTime(timeLeft)}</div>

      <div className="vip-price">
        {priceEur !== null ? `Marktpreis (${selectedCoin}): ${priceEur} €` : 'Preis …'}
        <span className={refreshing ? 'refresh-symbol' : ''}>🔄</span>
      </div>

      <button className="vip-button" onClick={() => sendNotify(false)}>Ich habe gesendet</button>
      <button className="vip-button" onClick={() => sendNotify(true)}>Live-Beratung starten</button>

      {overlay && (
        <div className="vip-overlay">
          <p>Zahlung wurde angekündigt. Wir prüfen und melden uns gleich.</p>
          <div className="vip-spinner"></div>
        </div>
      )}
    </div>
  );
}

export default VipCryptoPay;
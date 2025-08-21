// VipCryptoPay.jsx
import React, { useEffect, useState } from 'react';
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
    // falls base bereits absolute URL ist
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

  // Init von Wix holen
  useEffect(() => {
    (async () => {
      if (!params.orderId || !params.token || !params.amountEur) {
        window.location.href = buildFailUrl({
          baseFail: params.fail,
          orderId: params.orderId,
          reason: 'missing_params'
        });
        return;
      }

      try {
        const url = 'https://www.goldsilverstuff.com/_functions/vipinit?dbg=1';
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type':'application/json' },
          body: JSON.stringify({
            orderId: params.orderId,
            token: params.token,
            amountEur: Number(params.amountEur),
            presetCoin: params.coin || null,
            dbg: 1
          })
        });

        let j = null, txt = '';
        try { j = await r.json(); } catch { try { txt = await r.text(); } catch(_){} }

        if (!r.ok || !j?.ok) {
          const reason = (j && (j.error || j.message)) || (txt && txt.slice(0,120)) || `vipinit_${r.status}`;
          // diag nur in Konsole, nicht in URL
          console.warn('[VIP] vipinit failed', { status: r.status, reason, diag: j?.diag });
          window.location.href = buildFailUrl({
            baseFail: params.fail,
            orderId: params.orderId,
            reason
          });
          return;
        }

        // Erfolg
        setCustomerData({ name: j.name || '', email: j.email || '' });
        const wallets = j.walletMap || {};
        const allowed = j.allowedCoins || [];
        setWalletMap(wallets);
        setAllowedCoins(allowed);

        // Vorwahl robust: nur Coin verwenden, der wirklich erlaubt ist
        const preWanted = (params.coin || j.presetCoin || '').toUpperCase();
        const pre =
          (preWanted && allowed.includes(preWanted)) ? preWanted :
          (allowed[0] || 'BTC');
        setSelectedCoin(pre);

        setLoading(false);
      } catch (e) {
        console.error('[VIP] vipinit network error', e);
        window.location.href = buildFailUrl({
          baseFail: params.fail,
          orderId: params.orderId,
          reason: 'vipinit_network'
        });
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown
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

  // Preis-Refresh
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
      const r = await fetch('https://www.goldsilverstuff.com/_functions/vipnotify', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          orderId: params.orderId,
          token: params.token,
          coin: selectedCoin,
          amountEur: Number(params.amountEur),
          wallet,
          isBeratung: !!isBeratung,
          dbg: 1
        })
      });
      if (!r.ok) throw new Error(`notify_${r.status}`);
      if (isBeratung) window.open('https://meet.jit.si/GoldSilverSupport', '_blank');
      // overlay bleibt bis Admin entscheidet
    } catch (e) {
      console.error('[VIP] vipnotify error', e);
      setOverlay(false);
      alert('Konnte Benachrichtigung nicht senden.');
    }
  }

  if (loading) return <div className="vip-wrapper">Lade…</div>;

  const walletAddr = walletMap[selectedCoin] || '';

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
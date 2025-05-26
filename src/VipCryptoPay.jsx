import React, { useEffect, useState } from 'react';
import './VipCryptoPay.css';

const coinWallets = {
  BTC: 'deine_btc_walletadresse',
  ETH: 'deine_eth_walletadresse',
  XRP: 'deine_xrp_walletadresse',
  LTC: 'deine_ltc_walletadresse',
  DOGE: 'deine_doge_walletadresse',
  ADA: 'deine_ada_walletadresse',
  USDT: 'deine_usdt_walletadresse'
};

const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price';

function VipCryptoPay() {
  const [price, setPrice] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10 Minuten
  const [selectedCoin, setSelectedCoin] = useState('BTC');
  const [refreshing, setRefreshing] = useState(false);

  // Eingabedaten
  const [customerData, setCustomerData] = useState({
    name: '',
    email: '',
    warenkorbWert: '' // Betrag in EUR
  });

  // Coin-Preis aus CoinGecko laden
  const fetchPrice = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(
        `${COINGECKO_URL}?ids=${selectedCoin.toLowerCase()}&vs_currencies=eur`
      );
      const data = await res.json();
      setPrice(data[selectedCoin.toLowerCase()].eur);
    } catch (err) {
      console.error('Preis konnte nicht geladen werden:', err);
    }
    setRefreshing(false);
  };

  // Alle 15 Sekunden Preis-Refresh
  useEffect(() => {
    fetchPrice();
    const interval = setInterval(fetchPrice, 15000);
    return () => clearInterval(interval);
  }, [selectedCoin]);

  // 10-Minuten-Countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          window.location.href = '/zahlung-fehlgeschlagen';
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Klick auf „Ich habe gesendet“
  const handleSendClick = async () => {
    // Validierung
    if (
      !customerData.name.trim() ||
      !customerData.email.trim() ||
      !customerData.warenkorbWert
    ) {
      alert('Bitte Name, E-Mail und Warenkorbwert ausfüllen.');
      return;
    }
    setIsLoading(true);
    try {
      // POST an Wix-Endpoint
      const response = await fetch(
        'https://www.goldsilverstuff.com/_functions/vipcryptopay',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: customerData.name,
            email: customerData.email,
            betrag: parseFloat(customerData.warenkorbWert),
            coin: selectedCoin,
            wallet: coinWallets[selectedCoin],
            isBeratung: false
          })
        }
      );
      const result = await response.json();
      console.log('CMS logged:', result);
      // Das Overlay bleibt so lange, bis du in der Mail klickst
    } catch (err) {
      console.error('Fehler beim Senden:', err);
      setIsLoading(false);
    }
  };

  // Klick auf „Live-Beratung starten“
  const handleBeratungClick = async () => {
    if (
      !customerData.name.trim() ||
      !customerData.email.trim() ||
      !customerData.warenkorbWert
    ) {
      alert('Bitte Name, E-Mail und Warenkorbwert ausfüllen.');
      return;
    }
    setIsLoading(true);
    try {
      // POST mit isBeratung = true
      await fetch('https://www.goldsilverstuff.com/_functions/vipcryptopay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customerData.name,
          email: customerData.email,
          betrag: parseFloat(customerData.warenkorbWert),
          coin: selectedCoin,
          wallet: coinWallets[selectedCoin],
          isBeratung: true
        })
      });
      // Direkt Jitsi in neuem Tab öffnen
      window.open('https://meet.jit.si/GoldSilverSupport', '_blank');
    } catch (err) {
      console.error('Fehler bei Beratung:', err);
      setIsLoading(false);
    }
  };

  // Hilfsfunktion: mm:ss
  const formatTime = seconds => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  return (
    <div className="vip-wrapper">
      {/* Logo */}
      <img src="/logo.png" alt="Logo" className="logo" />

      <h2>VIP Crypto Zahlung</h2>

      {/* Eingabefelder */}
      <input
        type="text"
        placeholder="Dein Name"
        value={customerData.name}
        onChange={e =>
          setCustomerData({ ...customerData, name: e.target.value })
        }
        className="vip-input"
      />
      <input
        type="email"
        placeholder="Deine E-Mail"
        value={customerData.email}
        onChange={e =>
          setCustomerData({ ...customerData, email: e.target.value })
        }
        className="vip-input"
      />
      <input
        type="number"
        placeholder="Warenkorbwert (EUR)"
        value={customerData.warenkorbWert}
        onChange={e =>
          setCustomerData({ ...customerData, warenkorbWert: e.target.value })
        }
        className="vip-input"
      />

      {/* Coin-Dropdown mit Logo-Icon */}
      <div className="vip-select-wrapper">
        <select
          value={selectedCoin}
          onChange={e => setSelectedCoin(e.target.value)}
          className="vip-select"
        >
          {Object.keys(coinWallets).map(coin => (
            <option key={coin} value={coin}>
              {coin}
            </option>
          ))}
        </select>
        <img
          src={`/${selectedCoin.toLowerCase()}logo.png`}
          alt={`${selectedCoin} Logo`}
          className="vip-select-logo"
        />
      </div>

      {/* QR-Code & Wallet-Adresse */}
      <p>Empfangsadresse:</p>
      <code className="vip-wallet">{coinWallets[selectedCoin]}</code>
      <img
        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${coinWallets[selectedCoin]}`}
        alt="QR Code"
        className="vip-qr"
      />

      {/* Countdown */}
      <div className="vip-timer">Verbleibende Zeit: {formatTime(timeLeft)}</div>

      {/* Preis + Rotations-Icon */}
      <div className="vip-price">
        Preis in EUR: {price !== null ? `${price} €` : '...'}
        <span className={refreshing ? 'refresh-symbol' : ''}>🔄</span>
      </div>

      {/* Buttons */}
      <button onClick={handleSendClick} className="vip-button">
        Ich habe gesendet
      </button>
      <button onClick={handleBeratungClick} className="vip-button">
        Live-Beratung starten
      </button>

      {/* Lade-Overlay */}
      {isLoading && (
        <div className="vip-overlay">
          <p>Zahlung wird überprüft …</p>
          <div className="vip-spinner"></div>
        </div>
      )}
    </div>
  );
}

export default VipCryptoPay;

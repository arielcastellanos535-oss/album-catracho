"use client";

import React, { useState, useEffect } from 'react';

interface Department {
  id: string;
  name: string;
}

interface Sticker {
  id: string;
  name: string;
  department_id: string;
  quantity: number; 
}

interface Auction {
  id: string;
  sticker_name: string;
  seller_name: string;
  highest_bid: number;
  expires_at: string;
  status: string;
}

interface TradeOffer {
  id: string;
  offered_name: string;
  wanted_name: string;
}

export default function TradingModule({ 
  departments = [], 
  ownedStickers = [],
  stickerCatalog = [],
  activeAuctions = [],
  activeTrades = []
}: { 
  departments: Department[];
  ownedStickers: Sticker[];
  stickerCatalog: Sticker[];
  activeAuctions: Auction[];
  activeTrades: TradeOffer[];
}) {
  // Usaremos los endpoints server-side que crean/validan reservas y transferencias
  const [activeTab, setActiveTab] = useState<'public' | 'direct' | 'auction'>('public');

  // Estados del Mercado Público
  const [tradesList, setTradesList] = useState<TradeOffer[]>(activeTrades);
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [filteredStickers, setFilteredStickers] = useState<Sticker[]>([]);
  const [offeredSticker, setOfferedSticker] = useState<string>('');
  const [wantedSticker, setWantedSticker] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados Trato Directo
  const [friendId, setFriendId] = useState<string>('');
  
  // Estados Subastas
  const [auctionsList, setAuctionsList] = useState<Auction[]>(activeAuctions);
  const [auctionSticker, setAuctionSticker] = useState<string>('');
  const [minBet, setMinBet] = useState<number>(10);
  const [durationMinutes, setDurationMinutes] = useState<number>(5);
  const [isSubmittingAuction, setIsSubmittingAuction] = useState(false);
  const [bids, setBids] = useState<Record<string, number>>({});
  const [submittingBidFor, setSubmittingBidFor] = useState<string | null>(null);
  const [isFinalizingExpired, setIsFinalizingExpired] = useState(false);

  // Sincronizar listas desde el servidor
  useEffect(() => { setTradesList(activeTrades); }, [activeTrades]);
  useEffect(() => { setAuctionsList(activeAuctions); }, [activeAuctions]);

  // Filtrado de municipios por departamento
  useEffect(() => {
    if (selectedDept) {
      const filtered = stickerCatalog.filter(s => s.department_id === selectedDept);
      setFilteredStickers(filtered);
    } else {
      setFilteredStickers([]);
    }
    setWantedSticker('');
  }, [selectedDept, stickerCatalog]);

  // Regrera los cromos que el usuario puede ofrecer (cantidad > 1)
  const userTradableStickers = ownedStickers.filter(s => s.quantity > 1);

  // 📢 PUBLICAR OFERTA EN TRADE_OFFERS
  const handlePublishOffer = async () => {
    if (!offeredSticker || !wantedSticker) return;
    
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/trading/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offeredStickerId: offeredSticker, wantedStickerId: wantedSticker }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'publish_failed');

      const offStickerObj = ownedStickers.find(s => s.id === offeredSticker);
      const wanStickerObj = stickerCatalog.find(s => s.id === wantedSticker);

      const newOffer: TradeOffer = {
        id: data.id,
        offered_name: offStickerObj?.name || "Cromo",
        wanted_name: wanStickerObj?.name || "Cromo"
      };

      setTradesList([newOffer, ...tradesList]);
      alert("¡Oferta publicada con éxito en el Mercado Global! 🎉");

      setOfferedSticker('');
      setWantedSticker('');
      setSelectedDept('');
    } catch (error: unknown) {
      console.error(error);
      const errMsg = error instanceof Error ? error.message : "Error desconocido";
      alert(`Error al guardar en trade_offers: ${errMsg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ ACEPTAR UN TRATO DE LA COMUNIDAD
  const handleAcceptTrade = async (tradeId: string) => {
    if (!confirm("¿Estás seguro de que deseas aceptar este intercambio?")) return;
    try {
      const res = await fetch('/api/trading/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradeId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'accept_failed');

      setTradesList(tradesList.filter(t => t.id !== tradeId));
      alert("¡Intercambio realizado con éxito! El cromo ha sido movido a tu colección. 🤝");
    } catch (error: unknown) {
      console.error(error);
      const errMsg = error instanceof Error ? error.message : "Error desconocido";
      alert(`Error al aceptar el intercambio: ${errMsg}`);
    }
  };

  // 🔨 INICIAR SUBASTA REAL EN BASE DE DATOS
  const handleStartAuction = async () => {
    if (!auctionSticker) return;
    
    setIsSubmittingAuction(true);
    try {
      const res = await fetch('/api/trading/start-auction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stickerId: auctionSticker, minBet, durationMinutes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'auction_failed');

      const stickerObj = ownedStickers.find(s => s.id === auctionSticker);
      const newAuction: Auction = {
        id: data.id,
        sticker_name: stickerObj?.name || "Cromo en Subasta",
        seller_name: "Tú",
        highest_bid: minBet,
        expires_at: new Date(Date.now() + durationMinutes * 60000).toISOString(),
        status: "active",
      };

      setAuctionsList([newAuction, ...auctionsList]);
      alert(`🔨 ¡Subasta de ${stickerObj?.name} iniciada con éxito en la base de datos!`);
      setAuctionSticker('');
    } catch (error: unknown) {
      console.error(error);
      const errMsg = error instanceof Error ? error.message : "Error desconocido";
      alert(`Error al iniciar subasta: ${errMsg}`);
    } finally {
      setIsSubmittingAuction(false);
    }
  };

  // Enviar puja al servidor usando el endpoint que llama a la RPC `place_bid`
  const handlePlaceBid = async (auctionId: string) => {
    const bidAmount = bids[auctionId];
    if (!bidAmount || bidAmount <= 0) return alert('Ingresa un monto válido');
    setSubmittingBidFor(auctionId);
    try {
      const res = await fetch('/api/trading/place-bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auctionId, bid: bidAmount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'bid_failed');

      // Actualizar UI: aumentar highest_bid para esa subasta
      setAuctionsList(prev => prev.map(a => a.id === auctionId ? { ...a, highest_bid: bidAmount } : a));
      alert('Puja enviada con éxito 🎉');
    } catch (err) {
      console.error('place bid error', err);
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      alert(`Error al pujar: ${msg}`);
    } finally {
      setSubmittingBidFor(null);
    }
  };

  const handleFinalizeExpired = async () => {
    setIsFinalizingExpired(true);
    try {
      const res = await fetch('/api/trading/finalize-expired', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'finalize_failed');

      setAuctionsList(prev => prev.filter(a => new Date(a.expires_at) > new Date()));
      alert(`Se finalizaron ${data.detail?.finalized_count ?? 0} subastas expiradas.`);
    } catch (err) {
      console.error('finalize expired error', err);
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      alert(`Error al finalizar subastas: ${msg}`);
    } finally {
      setIsFinalizingExpired(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-slate-950 border border-slate-800 rounded-3xl p-6 text-white shadow-2xl">
      {/* ENCABEZADO */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-500 mb-2">
          🇭🇳 Centro de Intercambios Catracho
        </h2>
        <p className="text-sm text-slate-400">Cambia repetidos, negocia con amigos o subasta en vivo</p>
      </div>

      {/* PESTAÑAS */}
      <div className="flex border-b border-slate-800 mb-6 bg-slate-900/50 p-1 rounded-xl">
        <button onClick={() => setActiveTab('public')} className={`flex-1 py-3 text-sm font-bold rounded-lg transition ${activeTab === 'public' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>🌐 Mercado Público</button>
        <button onClick={() => setActiveTab('direct')} className={`flex-1 py-3 text-sm font-bold rounded-lg transition ${activeTab === 'direct' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>👥 Trato Directo</button>
        <button onClick={() => setActiveTab('auction')} className={`flex-1 py-3 text-sm font-bold rounded-lg transition ${activeTab === 'auction' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>🔨 Subastas en Vivo</button>
      </div>

      {/* MODALIDAD A: MERCADO PÚBLICO */}
      {activeTab === 'public' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
            <h3 className="text-lg font-semibold text-blue-400 mb-4">📢 Publicar Nueva Oferta</h3>
            
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-400 mb-1">Cromo que ofreces (Tus Repetidos Libres)</label>
              <select value={offeredSticker} onChange={(e) => setOfferedSticker(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-blue-500">
                <option value="">-- Selecciona tu cromo repetido --</option>
                {userTradableStickers.map(s => (
                  <option key={s.id} value={s.id}>{s.name} (Disponibles: {s.quantity - 1})</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-400 mb-1">Buscar por Departamento</label>
              <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-blue-500">
                <option value="">-- Elige Departamento --</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className="mb-5">
              <label className="block text-xs font-semibold text-slate-400 mb-1">Cromo que pides (Municipio)</label>
              <select value={wantedSticker} onChange={(e) => setWantedSticker(e.target.value)} disabled={!selectedDept} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-40">
                <option value="">-- {selectedDept ? 'Elige el Municipio' : 'Primero elige departamento'} --</option>
                {filteredStickers.map(s => (
                  <option key={s.id} value={s.id}>{s.name} {s.quantity > 0 ? '✅ (Ya lo tienes)' : '❌ (Te falta!)'}</option>
                ))}
              </select>
            </div>

            <button onClick={handlePublishOffer} disabled={!offeredSticker || !wantedSticker || isSubmitting} className="w-full bg-gradient-to-r from-blue-600 to-teal-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed">
              {isSubmitting ? "Publicando..." : "Publicar Oferta Global"}
            </button>
          </div>

          {/* OFERTAS DE LA COMUNIDAD CON BOTÓN DE ACEPTAR */}
          <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-300 mb-4">Ofertas de la Comunidad</h3>
              <div className="space-y-3 max-h-[340px] overflow-y-auto pr-2">
                {tradesList.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                    No hay ofertas globales publicadas en este momento. ¡Sé el primero!
                  </div>
                ) : (
                  tradesList.map((trade) => (
                    <div key={trade.id} className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-slate-400">Cambia: <span className="text-teal-400 font-bold">{trade.offered_name}</span></div>
                        <div className="text-xs font-medium text-slate-400">Por: <span className="text-blue-400 font-bold">{trade.wanted_name}</span></div>
                      </div>
                      <button 
                        onClick={() => handleAcceptTrade(trade.id)}
                        className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 px-3 rounded-lg shadow transition-all duration-200"
                      >
                        Aceptar Trato 🤝
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODALIDAD B: TRATO DIRECTO */}
      {activeTab === 'direct' && (
        <div className="max-w-md mx-auto bg-slate-900/80 border border-slate-800 p-6 rounded-2xl">
          <h3 className="text-lg font-semibold text-teal-400 mb-2">👥 Trato Directo con Coleccionistas</h3>
          <p className="text-xs text-slate-400 mb-4">Busca a tu amigo por su ID de usuario para ver sus repetidas.</p>
          <div className="mb-4">
            <div className="flex gap-2">
              <input type="text" placeholder="Ingresa el user_id de tu amigo..." value={friendId} onChange={(e) => setFriendId(e.target.value)} className="flex-1 bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-teal-500" />
              <button className="bg-teal-600 hover:bg-teal-500 px-4 rounded-xl font-bold text-sm transition">Buscar</button>
            </div>
          </div>
          <div className="border border-dashed border-slate-800 rounded-xl p-6 text-center text-slate-500 text-xs">Al encontrar al usuario, aquí aparecerá su vitrina de repetidos.</div>
        </div>
      )}

      {/* MODALIDAD C: SUBASTAS INTERACTIVAS */}
      {activeTab === 'auction' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 bg-slate-900/80 border border-slate-800 p-5 rounded-2xl h-fit">
              <h3 className="text-base font-bold text-yellow-500 mb-4">🔨 Crear Subasta</h3>
              <div className="mb-3">
                <label className="block text-xs font-semibold text-slate-400 mb-1">Cromo a Subastar</label>
                <select value={auctionSticker} onChange={(e) => setAuctionSticker(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white">
                  <option value="">-- Elige un cromo repetido --</option>
                  {userTradableStickers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} (Disp: {s.quantity - 1})</option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <label className="block text-xs font-semibold text-slate-400 mb-1">Puja Mínima</label>
                <input type="number" value={minBet} onChange={(e) => setMinBet(parseInt(e.target.value) || 0)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white" />
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-400 mb-1">Duración (Minutos)</label>
                <select value={durationMinutes} onChange={(e) => setDurationMinutes(parseInt(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white">
                  <option value={1}>1 Minuto</option>
                  <option value={5}>5 Minutos</option>
                  <option value={60}>1 Hora</option>
                </select>
              </div>
              <button 
                onClick={handleStartAuction} 
                disabled={!auctionSticker || isSubmittingAuction} 
                className="w-full bg-gradient-to-r from-yellow-600 to-amber-500 text-slate-950 font-extrabold py-2.5 px-4 rounded-xl text-xs transition hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmittingAuction ? "Creando Subasta..." : "¡Iniciar Subasta!"}
              </button>
            </div>

            <div className="md:col-span-2 bg-slate-900/40 border border-slate-800 p-5 rounded-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <h3 className="text-base font-bold text-slate-300">Subastas Activas</h3>
                <button
                  onClick={handleFinalizeExpired}
                  disabled={isFinalizingExpired}
                  className="self-start bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-2 px-3 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isFinalizingExpired ? 'Finalizando...' : 'Finalizar Expiradas'}
                </button>
              </div>
              {auctionsList.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">No hay subastas en vivo en este momento.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {auctionsList.map((auction) => (
                    <div key={auction.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between shadow-md">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full">LIVE 🔥</span>
                          <span className="font-mono text-xs text-rose-400 font-bold">ACTIVA</span>
                        </div>
                        <h4 className="text-base font-bold text-white">{auction.sticker_name}</h4>
                        <p className="text-xs text-slate-400 mb-3">Vendedor: {auction.seller_name}</p>
                        <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-center mb-4">
                          <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-wider">Puja Más Alta</span>
                          <span className="text-lg font-black text-yellow-400">{auction.highest_bid} 🪙</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={bids[auction.id] ?? (auction.highest_bid + 10)}
                          onChange={(e) => setBids(prev => ({ ...prev, [auction.id]: parseInt(e.target.value || '0') }))}
                          className="w-20 bg-slate-800 border border-slate-700 rounded-lg p-2 text-center text-xs text-white font-bold"
                        />
                        <button
                          onClick={() => handlePlaceBid(auction.id)}
                          disabled={submittingBidFor === auction.id}
                          className={`flex-1 bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold text-xs py-2 px-3 rounded-lg transition ${submittingBidFor === auction.id ? 'opacity-50 cursor-wait' : ''}`}
                        >
                          {submittingBidFor === auction.id ? 'Pujando...' : 'Pujar'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
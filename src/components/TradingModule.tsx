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

export default function TradingModule({ 
  departments = [], 
  allStickers = [],
  activeAuctions = []
}: { 
  departments: Department[]; 
  allStickers: Sticker[];
  activeAuctions: Auction[];
}) {
  const [activeTab, setActiveTab] = useState<'public' | 'direct' | 'auction'>('public');

  // Estados Mercado Público
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [filteredStickers, setFilteredStickers] = useState<Sticker[]>([]);
  const [offeredSticker, setOfferedSticker] = useState<string>('');
  const [wantedSticker, setWantedSticker] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados Trato Directo
  const [friendId, setFriendId] = useState<string>('');
  
  // Estados Subastas
  const [auctionSticker, setAuctionSticker] = useState<string>('');
  const [minBet, setMinBet] = useState<number>(10);
  const [durationMinutes, setDurationMinutes] = useState<number>(5);

  // Filtrado de municipios por departamento
  useEffect(() => {
    if (selectedDept) {
      const filtered = allStickers.filter(s => s.department_id === selectedDept);
      setFilteredStickers(filtered);
    } else {
      setFilteredStickers([]);
    }
    setWantedSticker('');
  }, [selectedDept, allStickers]);

  // 🔥 REGLA DE ORO: Solo puedes OFRECER o SUBASTAR cromos donde tengas más de 1 (el primero está pegado)
  const userTradableStickers = allStickers.filter(s => s.quantity > 1);

  // Función para publicar la oferta en el Mercado Público
  const handlePublishOffer = async () => {
    if (!offeredSticker || !wantedSticker) return;
    
    setIsSubmitting(true);
    try {
      // Aquí conectaremos luego con un RPC o api route para insertar en tu tabla 'trades'
      console.log("Insertando en Supabase...", {
        offered_sticker_id: offeredSticker,
        wanted_sticker_id: wantedSticker
      });
      
      alert("¡Oferta publicada con éxito en el Mercado Global! 🎉");
      // Limpiamos el formulario
      setOfferedSticker('');
      setWantedSticker('');
      setSelectedDept('');
    } catch (error) {
      console.error(error);
      alert("Hubo un error al publicar la oferta.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Función para iniciar subasta
  const handleStartAuction = () => {
    if (!auctionSticker) return;
    alert(`🔨 ¡Subasta iniciada en vivo para el cromo seleccionado con una base de ${minBet} monedas!`);
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
        <button
          onClick={() => setActiveTab('public')}
          className={`flex-1 py-3 text-sm font-bold rounded-lg transition ${activeTab === 'public' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
        >
          🌐 Mercado Público
        </button>
        <button
          onClick={() => setActiveTab('direct')}
          className={`flex-1 py-3 text-sm font-bold rounded-lg transition ${activeTab === 'direct' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
        >
          👥 Trato Directo
        </button>
        <button
          onClick={() => setActiveTab('auction')}
          className={`flex-1 py-3 text-sm font-bold rounded-lg transition ${activeTab === 'auction' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
        >
          🔨 Subastas en Vivo
        </button>
      </div>

      {/* MODALIDAD A: MERCADO PÚBLICO */}
      {activeTab === 'public' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
            <h3 className="text-lg font-semibold text-blue-400 mb-4">📢 Publicar Nueva Oferta</h3>
            
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-400 mb-1">Cromo que ofreces (Tus Repetidos Libres)</label>
              <select 
                value={offeredSticker} 
                onChange={(e) => setOfferedSticker(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Selecciona tu cromo repetido --</option>
                {userTradableStickers.map(s => (
                  <option key={s.id} value={s.id}>{s.name} (Disponibles: {s.quantity - 1})</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-400 mb-1">Buscar por Departamento</label>
              <select 
                value={selectedDept} 
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Elige Departamento --</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className="mb-5">
              <label className="block text-xs font-semibold text-slate-400 mb-1">Cromo que pides (Municipio)</label>
              <select 
                value={wantedSticker} 
                onChange={(e) => setWantedSticker(e.target.value)}
                disabled={!selectedDept}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-40"
              >
                <option value="">-- {selectedDept ? 'Elige el Municipio' : 'Primero elige departamento'} --</option>
                {filteredStickers.map(s => {
                  const yaLoTiene = s.quantity > 0;
                  return (
                    <option key={s.id} value={s.id}>
                      {s.name} {yaLoTiene ? '✅ (Ya lo tienes)' : '❌ (Te falta!)'}
                    </option>
                  );
                })}
              </select>
            </div>

            <button 
              onClick={handlePublishOffer}
              disabled={!offeredSticker || !wantedSticker || isSubmitting}
              className="w-full bg-gradient-to-r from-blue-600 to-teal-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Publicando..." : "Publicar Oferta Global"}
            </button>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-300 mb-4">Ofertas de la Comunidad</h3>
              <div className="space-y-3 max-h-[260px] overflow-y-auto pr-2">
                <div className="text-center py-8 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                  No hay ofertas globales publicadas en este momento. ¡Sé el primero!
                </div>
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
              <input 
                type="text" 
                placeholder="Ingresa el user_id de tu amigo..." 
                value={friendId}
                onChange={(e) => setFriendId(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-teal-500"
              />
              <button className="bg-teal-600 hover:bg-teal-500 px-4 rounded-xl font-bold text-sm transition">
                Buscar
              </button>
            </div>
          </div>
          <div className="border border-dashed border-slate-800 rounded-xl p-6 text-center text-slate-500 text-xs">
            Al encontrar al usuario, aquí aparecerá su vitrina de repetidos.
          </div>
        </div>
      )}

      {/* MODALIDAD C: SUBASTAS PÚBLICAS */}
      {activeTab === 'auction' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 bg-slate-900/80 border border-slate-800 p-5 rounded-2xl h-fit">
              <h3 className="text-base font-bold text-yellow-500 mb-4">🔨 Crear Subasta</h3>
              
              <div className="mb-3">
                <label className="block text-xs font-semibold text-slate-400 mb-1">Cromo a Subastar (Solo Tus Repetidos Libres)</label>
                <select 
                  value={auctionSticker}
                  onChange={(e) => setAuctionSticker(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                >
                  <option value="">-- Elige un cromo repetido --</option>
                  {userTradableStickers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} (Disp: {s.quantity - 1})</option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="block text-xs font-semibold text-slate-400 mb-1">Puja Mínima (Monedas)</label>
                <input 
                  type="number" 
                  value={minBet}
                  onChange={(e) => setMinBet(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-400 mb-1">Duración (Minutos)</label>
                <select 
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(parseInt(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                >
                  <option value={1}>1 Minuto (Prueba)</option>
                  <option value={5}>5 Minutos (Stream)</option>
                  <option value={60}>1 Hora</option>
                </select>
              </div>

              <button 
                onClick={handleStartAuction}
                disabled={!auctionSticker}
                className="w-full bg-gradient-to-r from-yellow-600 to-amber-500 text-slate-950 font-extrabold py-2.5 px-4 rounded-xl text-xs transition hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ¡Iniciar Subasta!
              </button>
            </div>

            <div className="md:col-span-2 bg-slate-900/40 border border-slate-800 p-5 rounded-2xl">
              <h3 className="text-base font-bold text-slate-300 mb-4">Subastas Activas en este Momento</h3>
              {activeAuctions.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                  No hay subastas en vivo en este momento. ¡Lanza una para tus espectadores en TikTok!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {activeAuctions.map((auction) => (
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
                        <input type="number" placeholder="+10" className="w-20 bg-slate-800 border border-slate-700 rounded-lg p-2 text-center text-xs text-white font-bold" />
                        <button className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold text-xs py-2 px-3 rounded-lg transition">Pujar</button>
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
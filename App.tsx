
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CalendarEvent, ViewType, EventType, EventStatus, UserRole } from './types';
import { getMonthDays, getWeekDays, isSameDay, formatTime, formatDate } from './utils/dateUtils';
import { parseEventDescription } from './services/geminiService';

const App: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewType>('month');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [role, setRole] = useState<UserRole>('secretaria');

  const [isSmartAddOpen, setIsSmartAddOpen] = useState(false);
  const [smartInput, setSmartInput] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [isParsing, setIsParsing] = useState(false);

  // States for Editing/Detailing
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Notification logic
  const [pendingNotifications, setPendingNotifications] = useState<string[]>([]);
  const notifiedEventsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const saved = localStorage.getItem('ciap_boss_agenda_v5');
    if (saved) {
      try {
        const parsed = JSON.parse(saved).map((ev: any) => ({
          ...ev,
          start: new Date(ev.start),
          end: new Date(ev.end)
        }));
        setEvents(parsed);
      } catch (e) { console.error(e); }
    } else {
        setEvents([
            {
                id: '1',
                title: 'Despacho de Comando: CIAP 2024',
                responsible: 'Coronel Diretor',
                participants: ['Estado Maior'],
                createdBy: 'Secretaria CIAP',
                start: new Date(new Date().setHours(9, 0, 0, 0)),
                end: new Date(new Date().setHours(11, 0, 0, 0)),
                type: 'meeting',
                status: 'active',
                reminderMinutes: 60,
                emoji: '📜',
                color: 'from-slate-900 to-black'
            },
            {
                id: '2',
                title: 'Formatura e Premiação CIAP',
                responsible: 'Diretoria de Saúde',
                participants: ['Todo o Efetivo'],
                createdBy: 'Secretaria CIAP',
                start: new Date(new Date().setHours(14, 0, 0, 0)),
                end: new Date(new Date().setHours(17, 0, 0, 0)),
                type: 'ceremony',
                status: 'active',
                reminderMinutes: 30,
                emoji: '🎖️',
                color: 'from-amber-600 to-orange-800'
            },
            {
                id: '3',
                title: 'Revisão de Protocolos Psicológicos',
                responsible: 'Gabinete',
                participants: [],
                createdBy: 'Secretaria CIAP',
                start: new Date(new Date().setHours(10, 0, 0, 0)),
                end: new Date(new Date().setHours(11, 0, 0, 0)),
                type: 'task',
                status: 'active',
                reminderMinutes: 15,
                emoji: '✅',
                color: 'from-emerald-600 to-teal-900'
            }
        ]);
    }
    const savedOp = localStorage.getItem('ciap_operator');
    if (savedOp) setOperatorName(savedOp);
    
    const savedRole = localStorage.getItem('ciap_role');
    if (savedRole) setRole(savedRole as UserRole);
  }, []);

  useEffect(() => {
    localStorage.setItem('ciap_boss_agenda_v5', JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    localStorage.setItem('ciap_operator', operatorName);
    localStorage.setItem('ciap_role', role);
  }, [operatorName, role]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const newToNotify: string[] = [];

      events.forEach(event => {
        if (event.status !== 'active' || !event.reminderMinutes || notifiedEventsRef.current.has(event.id)) return;
        const triggerTime = event.start.getTime() - (event.reminderMinutes * 60000);
        if (now >= triggerTime && now < event.start.getTime()) {
          newToNotify.push(event.id);
        }
      });

      if (newToNotify.length > 0) {
        setPendingNotifications(prev => [...new Set([...prev, ...newToNotify])]);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [events]);

  const stats = useMemo(() => {
    return {
      total: events.length,
      lectures: events.filter(e => e.type === 'lecture').length,
      meetings: events.filter(e => e.type === 'meeting').length,
      cancelled: events.filter(e => e.status === 'cancelled').length,
      completed: events.filter(e => e.status === 'completed').length,
      rescheduled: events.filter(e => e.status === 'rescheduled').length,
    };
  }, [events]);

  // Fix: Implemented the missing openDetail function to manage event selection and modal visibility
  const openDetail = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsDetailModalOpen(true);
    setIsEditing(false);
  };

  const handleSmartAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smartInput.trim()) return;
    setIsParsing(true);
    const result = await parseEventDescription(smartInput, new Date());
    setIsParsing(false);

    if (result) {
      const colors: Record<EventType, string> = {
        meeting: 'from-slate-800 to-slate-950',
        lecture: 'from-blue-600 to-indigo-700',
        ceremony: 'from-amber-600 to-orange-700',
        event: 'from-blue-500 to-cyan-600',
        task: 'from-emerald-600 to-teal-800'
      };

      const newEvent: CalendarEvent = {
        id: Math.random().toString(36).substr(2, 9),
        title: result.title,
        description: result.description,
        responsible: result.responsible,
        participants: result.participants || [],
        createdBy: operatorName || (role === 'chefe' ? 'Chefe CIAP' : 'Secretária CIAP'),
        start: new Date(result.start),
        end: new Date(result.end),
        type: result.type,
        status: 'active',
        reminderMinutes: 60,
        emoji: result.emoji || '📅',
        color: colors[result.type] || 'from-slate-600 to-slate-800'
      };
      setEvents([...events, newEvent]);
      setSmartInput('');
      setIsSmartAddOpen(false);
    }
  };

  const handleUpdateEvent = (updated: CalendarEvent) => {
    setEvents(events.map(e => e.id === updated.id ? updated : e));
    setSelectedEvent(updated);
  };

  const handleToggleTask = (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEvents(prev => prev.map(event => {
      if (event.id === eventId && event.type === 'task') {
        return {
          ...event,
          status: event.status === 'completed' ? 'active' : 'completed'
        };
      }
      return event;
    }));
  };

  const handleShareWhatsApp = (event: CalendarEvent) => {
    const text = `📢 *CIAP PM/PA - Agenda Chefia*
🗓️ *Evento:* ${event.title}
📅 *Data:* ${formatDate(event.start)}
⏰ *Hora:* ${formatTime(event.start)}
👤 *Responsável:* ${event.responsible}
👥 *Participantes:* ${event.participants.join(', ')}
📝 *Descrição:* ${event.description || 'Sem descrição.'}
✍️ *Registrado por:* ${event.createdBy}
--------------------------`;
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
    notifiedEventsRef.current.add(event.id);
    setPendingNotifications(prev => prev.filter(id => id !== event.id));
  };

  const CIAPBrasaoOficial = () => (
    <div className="flex flex-col items-center gap-0 mb-8 group cursor-pointer select-none">
      <div className="relative w-48 h-48 flex items-center justify-center">
        <div className="absolute inset-0 bg-white rounded-full border border-slate-300 shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex items-center justify-center">
           {/* Arco vermelho característico da imagem */}
           <div className="absolute inset-2 border-[16px] border-transparent border-t-[#E21E26] border-r-[#E21E26] rounded-full rotate-[15deg] transition-all duration-1000 group-hover:rotate-[375deg]"></div>
           
           {/* Fundo interno cinza claro da imagem */}
           <div className="absolute inset-5 bg-slate-100 rounded-full flex items-center justify-center shadow-inner overflow-hidden border border-slate-200">
                <div className="relative z-10 flex flex-col items-center justify-center scale-110">
                    <div className="w-20 h-24 border-[3px] border-[#002395] rounded-b-2xl bg-white shadow-xl relative overflow-hidden flex flex-col">
                        <div className="h-10 border-b-[3px] border-red-600 flex overflow-hidden">
                            <div className="flex-1 bg-[#E21E26] flex items-center justify-center text-[10px] font-black text-white italic">PM</div>
                            <div className="w-6 bg-white flex items-center justify-center border-x-[1px] border-slate-200">
                                <span className="text-amber-500 text-xs drop-shadow-sm">⚔️</span>
                            </div>
                            <div className="flex-1 bg-[#002395] flex items-center justify-center text-[10px] font-black text-white italic">PA</div>
                        </div>
                        <div className="flex-1 flex flex-col items-center justify-center p-1 bg-white relative">
                            <div className="text-[12px] text-blue-900 font-black mb-1 drop-shadow-sm">⚖️</div>
                            <div className="text-[5px] text-[#002395] font-black uppercase text-center leading-[6px] tracking-tighter">Centro Integrado<br/>Atenção Psicossocial</div>
                            <div className="text-[5px] text-blue-800 font-black mt-1">2020</div>
                            <div className="absolute bottom-0 w-full h-1 bg-amber-400"></div>
                        </div>
                    </div>
                </div>
           </div>
        </div>
      </div>
      <div className="relative -mt-6 z-10 text-center">
        <h1 className="font-black text-4xl text-slate-800 tracking-[-0.05em] uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)] mb-0">CIAP</h1>
        <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.4em] opacity-80 -mt-1">PMPA • Oficial</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#eff3f6] text-slate-800 font-sans">
      <aside className="w-80 bg-white border-r border-slate-200 p-6 flex flex-col gap-6 shadow-[15px_0_40px_rgba(0,0,0,0.02)] z-20">
        <CIAPBrasaoOficial />

        {/* Switcher de Perfil */}
        <div className="bg-slate-100 p-2 rounded-[2rem] flex gap-1 shadow-inner mb-2 border border-slate-200">
            <button 
                onClick={() => setRole('secretaria')}
                className={`flex-1 py-3 px-2 rounded-[1.5rem] text-[9px] font-black uppercase tracking-widest transition-all ${role === 'secretaria' ? 'bg-[#002395] text-white shadow-xl translate-y-[-2px]' : 'text-slate-400 hover:bg-slate-200'}`}
            >
                Secretaria
            </button>
            <button 
                onClick={() => setRole('chefe')}
                className={`flex-1 py-3 px-2 rounded-[1.5rem] text-[9px] font-black uppercase tracking-widest transition-all ${role === 'chefe' ? 'bg-[#E21E26] text-white shadow-xl translate-y-[-2px]' : 'text-slate-400 hover:bg-slate-200'}`}
            >
                Chefia
            </button>
        </div>

        <div className="space-y-4 px-2">
          {role === 'secretaria' && (
            <button 
                onClick={() => setIsSmartAddOpen(true)}
                className="w-full flex items-center justify-center gap-4 bg-gradient-to-br from-[#002395] via-blue-800 to-indigo-950 hover:scale-[1.02] text-white py-5 px-6 rounded-[2.5rem] shadow-2xl shadow-blue-900/30 transition-all active:scale-95 group overflow-hidden relative border-b-4 border-indigo-950"
            >
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <span className="text-2xl group-hover:scale-125 transition-transform">⚡</span>
                <span className="font-black tracking-tight text-xs uppercase">Registrar Evento</span>
            </button>
          )}
          
          <div className={`bg-slate-50 p-4 rounded-[2rem] border border-slate-100 shadow-inner group transition-all hover:bg-white hover:shadow-md border-l-4 ${role === 'chefe' ? 'border-amber-400' : 'border-[#E21E26]'}`}>
            <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest opacity-70">{role === 'chefe' ? 'Identificação do Comandante' : 'Operadora em Serviço'}</label>
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-md border border-slate-200 text-lg">
                    {role === 'chefe' ? '🎖️' : '🛡️'}
                </div>
                <input 
                  type="text" 
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  placeholder={role === 'chefe' ? "Coronel Diretor" : "Voluntária Secretária"}
                  className="flex-1 bg-transparent text-xs font-black outline-none placeholder:text-slate-300 uppercase tracking-tighter"
                />
            </div>
          </div>
        </div>

        <nav className="flex flex-col gap-2 mt-2 px-2">
            <h3 className="text-[10px] font-black uppercase text-slate-400 mb-2 px-4 tracking-[0.3em] opacity-40">Módulo Operacional</h3>
            {[
                { id: 'month', label: 'Calendário Mensal', icon: '📅' },
                { id: 'week', label: 'Agenda Semanal', icon: '🗓️' },
                { id: 'dashboard', label: 'Estatísticas CIAP', icon: '📊' }
            ].map(item => (
                <button 
                    key={item.id}
                    onClick={() => setView(item.id as ViewType)}
                    className={`flex items-center gap-5 px-6 py-4 rounded-[2rem] transition-all font-black text-xs uppercase tracking-widest ${view === item.id ? (role === 'chefe' ? 'bg-gradient-to-r from-slate-900 to-black text-white shadow-2xl translate-x-3' : 'bg-gradient-to-r from-[#002395] to-blue-900 text-white shadow-2xl translate-x-3') : 'hover:bg-slate-50 text-slate-400 hover:text-slate-900'}`}
                >
                    <span className="text-xl">{item.icon}</span>
                    {item.label}
                </button>
            ))}
        </nav>

        {pendingNotifications.length > 0 && role === 'secretaria' && (
          <div className="mx-2 bg-gradient-to-br from-emerald-50 to-green-100 border-2 border-emerald-200 p-6 rounded-[3rem] space-y-4 shadow-xl shadow-emerald-200/50 animate-bounce-subtle">
            <p className="text-[9px] font-black text-emerald-800 uppercase tracking-[0.2em] flex items-center gap-3">
              <span className="flex h-3 w-3 rounded-full bg-emerald-600 shadow-sm animate-ping"></span>
              Pauta Pronta ({pendingNotifications.length})
            </p>
            {pendingNotifications.slice(0, 1).map(id => {
              const ev = events.find(e => e.id === id);
              if (!ev) return null;
              return (
                <div key={id} className="bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-white">
                  <p className="text-[11px] font-black truncate text-slate-800 mb-3 uppercase tracking-tighter">{ev.title}</p>
                  <button 
                    onClick={() => handleShareWhatsApp(ev)}
                    className="w-full bg-[#25D366] text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/30 border-b-4 border-green-700 active:border-b-0 active:translate-y-1"
                  >
                    <span>NOTIFICAR CHEFE</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-auto space-y-4 px-2">
            <div className={`p-8 rounded-[3.5rem] shadow-2xl relative overflow-hidden group border border-white/5 ${role === 'chefe' ? 'bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white' : 'bg-gradient-to-br from-blue-900 to-indigo-950 text-white'}`}>
                <div className="absolute -right-6 -top-6 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
                <p className="text-[10px] font-black text-blue-400 uppercase mb-6 tracking-[0.4em] border-b border-white/10 pb-4">Indicadores Gabinete</p>
                <div className="grid grid-cols-2 gap-6">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-500 uppercase">EVENTOS</span>
                        <span className="text-2xl font-black">{stats.total - stats.cancelled}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-500 uppercase">FEITOS</span>
                        <span className="text-2xl font-black text-emerald-400">{stats.completed}</span>
                    </div>
                </div>
            </div>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.5em] text-center opacity-60">G-CAL AI V6 • CIAP PM/PA</p>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-36 bg-white/80 backdrop-blur-2xl border-b border-slate-200 px-20 flex items-center justify-between shadow-sm z-10 sticky top-0">
          <div className="flex items-center gap-12">
            <div className="w-16 h-16 rounded-full border-4 border-slate-100 p-1">
                <div className={`w-full h-full rounded-full flex items-center justify-center text-white font-black text-xs ${role === 'chefe' ? 'bg-slate-900' : 'bg-[#002395]'}`}>
                    {role === 'chefe' ? 'CMD' : 'SEC'}
                </div>
            </div>
            <div>
              <h2 className="text-4xl font-black text-slate-950 flex items-center gap-5 tracking-tighter">
                {role === 'chefe' ? 'Bom dia, Sr. Diretor' : 'Área de Trabalho da Secretaria'}
                <div className={`h-4 w-4 rounded-full shadow-xl animate-pulse ${role === 'chefe' ? 'bg-amber-400' : 'bg-[#E21E26]'}`}></div>
              </h2>
              <p className="text-xs font-black text-slate-400 uppercase tracking-[0.5em] mt-3 ml-1 opacity-70">
                {view === 'dashboard' ? 'Métricas de Comando' : currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-10">
            {view !== 'dashboard' && (
                <div className="flex bg-slate-100/80 p-2 rounded-[3rem] shadow-inner border border-slate-200">
                    <button onClick={() => {
                        const d = new Date(currentDate); d.setMonth(d.getMonth() - 1); setCurrentDate(d);
                    }} className="p-4 hover:bg-white rounded-full transition-all shadow-sm group">
                        <svg className="w-7 h-7 text-slate-600 group-hover:text-[#002395]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M15 19l-7-7 7-7"/></svg>
                    </button>
                    <button onClick={() => setCurrentDate(new Date())} className="px-12 text-[12px] font-black text-slate-800 uppercase tracking-[0.3em] hover:text-[#002395] transition-colors">Hoje</button>
                    <button onClick={() => {
                        const d = new Date(currentDate); d.setMonth(d.getMonth() + 1); setCurrentDate(d);
                    }} className="p-4 hover:bg-white rounded-full transition-all shadow-sm group">
                        <svg className="w-7 h-7 text-slate-600 group-hover:text-[#002395]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M9 5l7 7-7 7"/></svg>
                    </button>
                </div>
            )}
            <div className="flex items-center gap-6 group cursor-pointer">
                <div className="text-right hidden sm:block">
                    <p className="text-sm font-black text-slate-950 uppercase leading-none tracking-tighter group-hover:text-[#002395] transition-colors">
                        {operatorName || (role === 'chefe' ? 'Diretor CIAP' : 'Equipe Secretaria')}
                    </p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{role === 'chefe' ? 'ESTRELA DE COMANDO' : 'OPERADOR LOGÍSTICO'}</p>
                </div>
                <div className={`h-16 w-16 rounded-[2rem] flex items-center justify-center text-white shadow-2xl group-hover:rotate-12 transition-all duration-500 border-4 border-white ${role === 'chefe' ? 'bg-gradient-to-tr from-slate-800 to-slate-950' : 'bg-gradient-to-tr from-[#E21E26] via-red-600 to-red-800'}`}>
                    {role === 'chefe' ? (
                        <span className="text-3xl">★</span>
                    ) : (
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                    )}
                </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-16 custom-scrollbar bg-[#eff3f6]">
          {view === 'month' && <MonthView date={currentDate} events={events} onEventClick={openDetail} onToggleTask={handleToggleTask} />}
          {view === 'week' && <WeekView date={currentDate} events={events} onEventClick={openDetail} onToggleTask={handleToggleTask} />}
          {view === 'dashboard' && <Dashboard stats={stats} />}
        </div>
      </main>

      {/* Modal Detalhes Adaptado ao Papel */}
      {isDetailModalOpen && selectedEvent && (
        <div className="fixed inset-0 bg-slate-950/98 backdrop-blur-3xl z-50 flex items-center justify-center p-12 overflow-y-auto">
          <div className="bg-white w-full max-w-7xl rounded-[6rem] shadow-[0_80px_160px_rgba(0,0,0,0.6)] p-20 animate-in fade-in slide-in-from-top-24 duration-700 border border-white/20 flex flex-col max-h-[92vh] relative overflow-hidden">
            <div className={`absolute top-0 left-0 right-0 h-5 bg-gradient-to-r ${selectedEvent.color}`}></div>
            
            <div className="flex justify-between items-start mb-20">
              <div className="flex items-center gap-12 w-full">
                {isEditing ? (
                  <div className="flex items-center gap-10 flex-1 bg-slate-50 p-12 rounded-[5rem] border-2 border-slate-200 shadow-inner">
                    <div className="bg-white p-8 rounded-[3rem] shadow-2xl border-4 border-slate-100">
                        <input type="text" className="text-8xl bg-transparent w-32 text-center outline-none" value={selectedEvent.emoji}
                          onChange={(e) => handleUpdateEvent({...selectedEvent, emoji: e.target.value})} />
                    </div>
                    <div className="flex-1 space-y-4">
                        <label className="text-[14px] font-black uppercase text-slate-400 tracking-[0.5em] ml-2">Título do Registro Ofical</label>
                        <input type="text" className="text-6xl font-black text-slate-950 w-full bg-transparent outline-none tracking-tighter" value={selectedEvent.title}
                          onChange={(e) => handleUpdateEvent({...selectedEvent, title: e.target.value})} />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-16">
                    <div className={`text-9xl p-16 rounded-[5rem] bg-gradient-to-br ${selectedEvent.color} shadow-2xl shadow-slate-400 text-white flex items-center justify-center transform -rotate-3 border-8 border-white/30 ${selectedEvent.status === 'completed' ? 'opacity-50 grayscale' : ''}`}>
                        {selectedEvent.status === 'completed' ? '✔️' : selectedEvent.emoji}
                    </div>
                    <div>
                      <h3 className={`text-7xl font-black text-slate-950 leading-tight uppercase tracking-tighter drop-shadow-xl ${selectedEvent.status === 'completed' ? 'line-through opacity-40' : ''}`}>{selectedEvent.title}</h3>
                      <div className="flex items-center gap-10 mt-10">
                        <span className={`px-12 py-5 rounded-full text-[14px] font-black uppercase tracking-[0.4em] bg-gradient-to-r ${selectedEvent.color} text-white shadow-2xl border-2 border-white/10 ${selectedEvent.status === 'completed' ? 'grayscale opacity-50' : ''}`}>
                            {selectedEvent.status === 'completed' ? 'CONCLUÍDO' : selectedEvent.type}
                        </span>
                        <div className="flex items-center gap-5">
                            <div className="w-4 h-4 rounded-full bg-[#E21E26] shadow-lg animate-pulse"></div>
                            <p className="text-lg font-black text-slate-400 uppercase tracking-[0.3em]">Registro Estratégico CIAP</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <button onClick={() => setIsDetailModalOpen(false)} className="bg-slate-100 hover:bg-slate-200 p-10 rounded-[4.5rem] transition-all hover:rotate-90 duration-700 shadow-xl border-4 border-white group">
                <svg className="w-12 h-12 text-slate-600 group-hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="flex-1 overflow-auto grid grid-cols-1 lg:grid-cols-12 gap-20 pr-12 custom-scrollbar">
              <div className="lg:col-span-7 space-y-16">
                <section className="bg-slate-50 p-16 rounded-[6rem] border-2 border-slate-100 shadow-inner relative overflow-hidden">
                   <h4 className="text-[14px] font-black uppercase text-slate-400 mb-14 tracking-[0.5em] flex items-center gap-6">
                    <span className="w-16 h-1.5 bg-[#002395] rounded-full"></span> Dados Técnicos do Compromisso
                   </h4>
                   <div className="grid grid-cols-2 gap-16">
                      <div className="space-y-4">
                         <span className="text-[12px] font-black uppercase text-slate-400 block tracking-widest opacity-80">Data / Hora Início</span>
                         {isEditing ? (
                           <input type="datetime-local" className="text-2xl font-black w-full bg-white p-8 rounded-[2rem] shadow-xl border-2 border-slate-200 outline-none"
                            value={selectedEvent.start.toISOString().slice(0, 16)}
                            onChange={(e) => handleUpdateEvent({...selectedEvent, start: new Date(e.target.value)})}/>
                         ) : (
                           <div className="space-y-2">
                                <p className="text-5xl font-black text-slate-950 tracking-tighter">{formatDate(selectedEvent.start)}</p>
                                <p className="text-2xl font-black text-blue-700 uppercase tracking-widest">{formatTime(selectedEvent.start)}</p>
                           </div>
                         )}
                      </div>
                      <div className="space-y-4">
                         <span className="text-[12px] font-black uppercase text-slate-400 block tracking-widest opacity-80">Término Estimado</span>
                         {isEditing ? (
                            <input type="datetime-local" className="text-2xl font-black w-full bg-white p-8 rounded-[2rem] shadow-xl border-2 border-slate-200 outline-none"
                             value={selectedEvent.end.toISOString().slice(0, 16)}
                             onChange={(e) => handleUpdateEvent({...selectedEvent, end: new Date(e.target.value)})}/>
                          ) : (
                            <div className="space-y-2">
                                <p className="text-5xl font-black text-slate-950/30 tracking-tighter">Horário Fim</p>
                                <p className="text-2xl font-black text-blue-700 uppercase tracking-widest">{formatTime(selectedEvent.end)}</p>
                            </div>
                          )}
                      </div>
                      <div className="space-y-4">
                         <span className="text-[12px] font-black uppercase text-slate-400 block tracking-widest opacity-80">Solicitante / Pauta</span>
                         {isEditing ? (
                           <input type="text" className="text-2xl font-black w-full bg-white p-8 rounded-[2rem] shadow-xl border-2 border-slate-200 outline-none"
                            value={selectedEvent.responsible} onChange={(e) => handleUpdateEvent({...selectedEvent, responsible: e.target.value})}/>
                         ) : (
                           <p className="text-3xl font-black text-slate-950 uppercase tracking-tighter drop-shadow-sm">{selectedEvent.responsible}</p>
                         )}
                      </div>
                      <div className="space-y-4">
                         <span className="text-[12px] font-black uppercase text-slate-400 block tracking-widest opacity-80">Log de Registro</span>
                         <p className="text-3xl font-black text-slate-400 italic tracking-tighter uppercase">{selectedEvent.createdBy}</p>
                      </div>
                   </div>
                </section>

                <section className="bg-white p-16 rounded-[6rem] border-2 border-slate-100 shadow-2xl relative">
                   <h4 className="text-[14px] font-black uppercase text-slate-400 mb-10 tracking-[0.5em]">Autoridades Presentes</h4>
                   {isEditing ? (
                     <textarea className="w-full p-10 bg-slate-50 border-4 border-slate-200 rounded-[4rem] text-xl font-black focus:bg-white transition-all outline-none resize-none shadow-inner h-48"
                        placeholder="Ex: Cel. Castro, Maj. Lima, Equipe Psicologia..."
                        value={selectedEvent.participants.join(', ')}
                        onChange={(e) => handleUpdateEvent({...selectedEvent, participants: e.target.value.split(',').map(p => p.trim())})} />
                   ) : (
                    <div className="flex flex-wrap gap-5">
                        {selectedEvent.participants.map((p, i) => (
                          <div key={i} className="px-10 py-5 bg-slate-100 text-slate-900 text-sm font-black rounded-[2.5rem] border-2 border-slate-200 shadow-md flex items-center gap-4 group hover:bg-[#002395] hover:text-white transition-all cursor-default scale-100 hover:scale-105">
                            <div className="w-4 h-4 rounded-full bg-[#E21E26] shadow-md group-hover:bg-white"></div> {p}
                          </div>
                        ))}
                     </div>
                   )}
                </section>
              </div>

              <div className="lg:col-span-5 flex flex-col gap-16">
                <section className="flex-1 bg-slate-50 p-14 rounded-[7rem] border-8 border-dashed border-slate-200 shadow-inner flex flex-col group relative">
                   <h4 className="text-[14px] font-black uppercase text-slate-400 mb-10 tracking-[0.5em] group-hover:text-[#002395] transition-colors">Briefing e Pautas Gabinete</h4>
                   <textarea 
                     readOnly={role === 'chefe' && !isEditing}
                     className="w-full flex-1 p-14 bg-white border-4 border-slate-100 rounded-[5rem] focus:border-[#002395] transition-all outline-none text-2xl font-bold leading-relaxed resize-none shadow-3xl shadow-slate-300 placeholder:text-slate-100"
                     placeholder="Detalhe estratégico para o Comando..."
                     value={selectedEvent.description || ''}
                     onChange={(e) => handleUpdateEvent({...selectedEvent, description: e.target.value})}
                   />
                </section>

                {role === 'secretaria' && (
                    <section className="bg-emerald-50 p-12 rounded-[5rem] border-4 border-emerald-100 shadow-2xl shadow-emerald-200/30">
                        <h4 className="text-[12px] font-black uppercase text-emerald-800 mb-10 tracking-[0.3em] flex items-center gap-4">
                            <span className="text-5xl">🔔</span> Configurar Aviso WhatsApp
                        </h4>
                        <div className="grid grid-cols-4 gap-6">
                            {[
                                { val: 0, label: 'OFF' },
                                { val: 15, label: '15M' },
                                { val: 60, label: '1H' },
                                { val: 1440, label: '1D' }
                            ].map(rem => (
                                <button key={rem.val} onClick={() => handleUpdateEvent({...selectedEvent, reminderMinutes: rem.val})}
                                    className={`py-7 rounded-[3rem] text-[12px] font-black uppercase tracking-[0.3em] transition-all border-8 ${selectedEvent.reminderMinutes === rem.val ? 'bg-[#25D366] text-white border-green-800 shadow-2xl scale-110 translate-y--2' : 'bg-white text-emerald-600 border-emerald-100 hover:bg-emerald-100 shadow-md'}`}>
                                    {rem.label}
                                </button>
                            ))}
                        </div>
                    </section>
                )}
              </div>
            </div>

            <div className="mt-20 pt-16 border-t-4 border-slate-100 flex justify-between items-center bg-white relative z-10">
               <div className="flex gap-8">
                  {selectedEvent.type === 'task' && (
                    <button 
                      onClick={(e) => { handleToggleTask(selectedEvent.id, e as any); }}
                      className={`px-16 py-8 rounded-[3rem] font-black text-base uppercase tracking-[0.4em] transition-all shadow-3xl ${selectedEvent.status === 'completed' ? 'bg-slate-200 text-slate-500' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200'}`}
                    >
                      {selectedEvent.status === 'completed' ? '↺ REATIVAR TAREFA' : '✓ CONCLUIR TAREFA'}
                    </button>
                  )}
                  {role === 'secretaria' && (
                    <button 
                        onClick={() => handleUpdateEvent({...selectedEvent, status: selectedEvent.status === 'cancelled' ? 'active' : 'cancelled'})}
                        className={`px-16 py-8 rounded-[3rem] font-black text-base uppercase tracking-[0.4em] transition-all shadow-3xl ${selectedEvent.status === 'cancelled' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                    >
                        {selectedEvent.status === 'cancelled' ? '✓ REATIVAR AGENDA' : '✕ CANCELAR REGISTRO'}
                    </button>
                  )}
                  {!isEditing && (
                    <button onClick={() => setIsEditing(true)}
                      className="px-16 py-8 bg-slate-900 text-white hover:bg-black rounded-[3rem] font-black text-base uppercase tracking-[0.4em] transition-all shadow-3xl border-b-[12px] border-black active:border-b-0 active:translate-y-2">
                      ✎ EDITAR DADOS
                    </button>
                  )}
               </div>
               <div className="flex gap-8">
                  <button onClick={() => handleShareWhatsApp(selectedEvent)}
                    className="bg-[#25D366] text-white px-20 py-10 rounded-[4rem] font-black shadow-2xl hover:scale-105 active:scale-95 transition-all text-base uppercase tracking-[0.4em] flex items-center gap-8 border-b-[12px] border-green-800">
                    <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.539 2.016 2.069-.531c.972.53 1.968.814 3.22.815h.001c3.181 0 5.766-2.586 5.767-5.766 0-3.18-2.585-5.767-5.77-5.767zm3.373 8.311c-.14.394-.805.748-1.114.792-.308.043-.701.077-1.114-.055-.413-.131-.93-.306-1.554-.582-1.076-.475-1.765-1.571-1.819-1.642-.054-.071-.435-.579-.435-1.117s.283-.804.384-.911c.101-.107.221-.134.295-.134.074 0 .148.001.214.004.068.003.159-.026.249.191.09.217.31.758.337.813.027.054.045.118.009.191-.036.072-.054.118-.107.181-.054.063-.114.14-.163.188-.054.054-.11.113-.047.22.063.107.28.461.6.745.413.366.76.479.867.533s.191.045.263-.036c.072-.081.31-.362.392-.486.082-.124.164-.105.276-.064.112.041.71.335.833.396s.204.09.234.14c.03.051.03.292-.111.687zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
                    ENVIAR AO COMANDO
                  </button>
                  <button onClick={() => { setIsEditing(false); setIsDetailModalOpen(false); }}
                    className={`text-white px-20 py-10 rounded-[4rem] font-black shadow-3xl hover:scale-105 active:scale-95 transition-all text-base uppercase tracking-[0.4em] border-b-[12px] active:border-b-0 active:translate-y-2 ${role === 'chefe' ? 'bg-slate-900 border-black' : 'bg-indigo-900 border-indigo-950'}`}>
                    {isEditing ? '✓ SALVAR REGISTRO' : 'CIENTE / CONCLUIR'}
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Smart Add Modal */}
      {isSmartAddOpen && (
        <div className="fixed inset-0 bg-slate-950/99 backdrop-blur-3xl z-50 flex items-center justify-center p-16">
          <div className="bg-white w-full max-w-6xl rounded-[8rem] shadow-[0_120px_240px_rgba(0,0,0,1)] p-20 animate-in fade-in zoom-in duration-700 border border-white/30">
            <div className="flex justify-between items-center mb-20">
              <div className="flex items-center gap-14">
                <div className="bg-gradient-to-br from-[#002395] to-indigo-950 text-white w-32 h-32 flex items-center justify-center rounded-[4rem] shadow-3xl animate-pulse text-6xl border-4 border-white/20">⚡</div>
                <div>
                  <h3 className="text-6xl font-black text-slate-950 uppercase tracking-tighter italic">Processador AI CIAP</h3>
                  <p className="text-lg font-black text-slate-400 mt-4 uppercase tracking-[0.6em] opacity-60">Inserção via Linguagem Natural</p>
                </div>
              </div>
              <button onClick={() => setIsSmartAddOpen(false)} className="bg-slate-100 hover:bg-slate-200 p-12 rounded-[5rem] transition-all hover:rotate-90 shadow-xl">
                <svg className="w-14 h-14 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            
            <form onSubmit={handleSmartAdd} className="space-y-16">
              <div className="relative group">
                  <div className="absolute -inset-10 bg-gradient-to-br from-[#002395]/30 to-indigo-500/30 rounded-[6rem] blur-[80px] group-focus-within:opacity-100 opacity-0 transition-all duration-1000"></div>
                  <textarea autoFocus value={smartInput} onChange={(e) => setSmartInput(e.target.value)}
                    placeholder="Descreva: 'Reunião estratégica amanhã às 15h com Cel. Souza e Maj. Silva no Comando Geral'..."
                    className="relative w-full h-[400px] p-20 bg-slate-50 border-8 border-transparent rounded-[7rem] focus:bg-white focus:border-[#002395] transition-all outline-none text-5xl font-black leading-tight shadow-inner placeholder:text-slate-200 tracking-tighter"
                  />
              </div>
              
              <div className="flex justify-between items-center bg-slate-950 p-16 rounded-[6rem] shadow-[0_50px_100px_rgba(0,0,0,0.6)] border-4 border-white/20 relative overflow-hidden">
                <div className="flex items-center gap-14 relative z-10">
                    <div className="w-24 h-24 bg-white/10 rounded-[2rem] flex items-center justify-center shadow-inner border border-white/10 backdrop-blur-3xl text-6xl">🤖</div>
                    <div>
                        <p className="text-sm font-black text-blue-400 uppercase tracking-[0.5em] mb-3">Assistente Inteligente</p>
                        <p className="text-xl font-bold text-white leading-relaxed opacity-60">
                            Processando para: <span className="text-amber-400 underline font-black uppercase tracking-widest">{operatorName || (role === 'chefe' ? 'Comando' : 'Secretaria')}</span>
                        </p>
                    </div>
                </div>
                <div className="flex gap-14 items-center relative z-10">
                    <button type="button" onClick={() => setIsSmartAddOpen(false)} className="font-black text-slate-400 hover:text-white transition-all uppercase tracking-[0.5em] text-sm">DESCATAR</button>
                    <button disabled={isParsing || !smartInput} type="submit"
                      className="bg-gradient-to-r from-blue-600 to-indigo-800 text-white px-24 py-12 rounded-[4rem] font-black shadow-3xl shadow-blue-900/50 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 text-xl uppercase tracking-[0.4em] border-b-[12px] border-indigo-950">
                      {isParsing ? 'CALCULANDO...' : 'EXECUTAR AGENDAMENTO'}
                    </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Sub-components (Dashboard, MonthView, WeekView) ---

const Dashboard: React.FC<{ stats: any }> = ({ stats }) => (
    <div className="space-y-20 animate-in fade-in slide-in-from-bottom-24 duration-1000">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-14">
            {[
                { label: 'Eventos Totais', value: stats.total - stats.cancelled, icon: '📋', color: 'from-blue-600 to-blue-900' },
                { label: 'Em Aberto', value: stats.total - stats.completed - stats.cancelled, icon: '🎤', color: 'from-indigo-600 to-indigo-950' },
                { label: 'Concluídos', value: stats.completed, icon: '✅', color: 'from-emerald-600 to-emerald-950' },
                { label: 'Baixas de Agenda', value: stats.cancelled, icon: '🚫', color: 'from-red-600 to-red-900' }
            ].map((s, i) => (
                <div key={i} className="bg-white p-16 rounded-[5rem] shadow-2xl shadow-slate-200/50 flex flex-col items-center text-center group hover:scale-105 transition-all duration-700 cursor-default border border-slate-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-slate-50 rounded-full -mr-20 -mt-20 opacity-40"></div>
                    <div className={`w-28 h-28 rounded-[3rem] bg-gradient-to-br ${s.color} text-white flex items-center justify-center text-6xl mb-10 shadow-2xl shadow-slate-400 group-hover:rotate-12 transition-all duration-500`}>
                        {s.icon}
                    </div>
                    <span className="text-8xl font-black text-slate-950 tracking-tighter tabular-nums drop-shadow-md">{s.value}</span>
                    <span className="text-[12px] font-black uppercase tracking-[0.5em] text-slate-400 mt-8">{s.label}</span>
                </div>
            ))}
        </div>

        <div className="bg-white p-24 rounded-[7rem] shadow-2xl shadow-slate-200/60 relative overflow-hidden border-4 border-white">
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-50 rounded-full blur-[200px] opacity-50 -mr-64 -mt-64"></div>
            <div className="flex justify-between items-center mb-20 relative z-10">
                <h3 className="text-4xl font-black uppercase tracking-[0.6em] text-slate-950 border-l-[20px] border-[#002395] pl-16">Engajamento de Comando Semanal</h3>
                <div className="flex gap-10">
                    <span className="flex items-center gap-3 text-sm font-black uppercase tracking-widest text-slate-400"><div className="w-5 h-5 rounded-full bg-blue-600 shadow-lg"></div> REUNIÕES</span>
                    <span className="flex items-center gap-3 text-sm font-black uppercase tracking-widest text-slate-400"><div className="w-5 h-5 rounded-full bg-red-600 shadow-lg"></div> SOLENIDADES</span>
                </div>
            </div>
            <div className="h-[500px] flex items-end justify-between gap-16 px-14 relative z-10">
                {[45, 90, 55, 98, 70, 65, 50].map((h, i) => (
                    <div key={i} className="flex-1 group flex flex-col items-center gap-12">
                        <div className="w-full bg-slate-50/80 backdrop-blur-md rounded-[4rem] h-full flex flex-col justify-end overflow-hidden shadow-inner border border-slate-100 p-4">
                            <div style={{ height: `${h}%` }} 
                                className={`w-full rounded-[3.5rem] bg-gradient-to-t ${i % 2 === 0 ? 'from-[#002395] to-blue-400' : 'from-[#E21E26] to-red-400'} group-hover:brightness-150 transition-all duration-1000 transform origin-bottom group-hover:scale-y-110 shadow-2xl relative`}>
                            </div>
                        </div>
                        <span className="text-[16px] font-black text-slate-950 tracking-[0.4em] uppercase opacity-30">Semana 0{i+1}</span>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

const MonthView: React.FC<{ date: Date; events: CalendarEvent[]; onEventClick: (ev: CalendarEvent) => void; onToggleTask: (id: string, e: React.MouseEvent) => void }> = ({ date, events, onEventClick, onToggleTask }) => {
  const days = useMemo(() => getMonthDays(date), [date]);
  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="bg-white rounded-[7rem] border-4 border-slate-200 shadow-[0_100px_200px_-40px_rgba(0,0,0,0.12)] overflow-hidden min-w-[1600px]">
      <div className="calendar-grid bg-slate-50/80 border-b-4 border-slate-200 shadow-inner backdrop-blur-3xl">
        {weekdays.map(d => (
          <div key={d} className="py-16 text-center text-[14px] font-black text-slate-500 uppercase tracking-[0.6em]">{d}</div>
        ))}
      </div>
      <div className="calendar-grid">
        {days.map((day, i) => {
          const dayEvents = events.filter(e => isSameDay(e.start, day.date));
          const isToday = isSameDay(day.date, new Date());

          return (
            <div key={i} className={`min-h-[300px] border-b-2 border-r-2 border-slate-100 p-10 transition-all hover:bg-slate-50 group last:border-r-0 relative overflow-hidden`}>
              <div className="flex justify-between items-start mb-10 relative z-10">
                <span className={`text-3xl font-black w-20 h-20 flex items-center justify-center rounded-[2.5rem] transition-all duration-700 ${!day.currentMonth ? 'text-slate-200 opacity-20' : isToday ? 'bg-gradient-to-br from-[#E21E26] to-red-700 text-white shadow-2xl shadow-red-500/50 scale-125 rotate-6' : 'text-slate-950 hover:bg-slate-100 shadow-md border-2 border-slate-100'}`}>
                  {day.date.getDate()}
                </span>
                {dayEvents.length > 0 && <div className="flex gap-2"><div className="w-5 h-5 rounded-full bg-[#002395] shadow-2xl animate-pulse"></div></div>}
              </div>
              <div className="space-y-4 relative z-10">
                {dayEvents.slice(0, 3).map(e => (
                  <div key={e.id} onClick={() => onEventClick(e)}
                    className={`cursor-pointer p-5 rounded-[2.2rem] shadow-2xl font-black flex flex-col gap-2 transition-all hover:scale-105 hover:-translate-y-2 bg-gradient-to-br ${e.color} text-white border border-white/20 group/card relative overflow-hidden ${e.status === 'cancelled' || e.status === 'completed' ? 'opacity-30 grayscale' : ''}`}>
                    <div className="absolute -right-4 -top-4 text-4xl opacity-10 rotate-12">{e.status === 'completed' ? '✔️' : e.emoji}</div>
                    <div className="flex items-center gap-3">
                        {e.type === 'task' && (
                          <div 
                            onClick={(evt) => onToggleTask(e.id, evt)}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all ${e.status === 'completed' ? 'bg-white border-white text-emerald-600' : 'bg-transparent border-white/50 text-transparent hover:border-white'}`}
                          >
                            {e.status === 'completed' && <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>}
                          </div>
                        )}
                        <span className={`text-2xl drop-shadow-lg ${e.status === 'completed' ? 'hidden' : ''}`}>{e.emoji}</span>
                        <span className={`text-[11px] truncate uppercase tracking-tighter leading-none pr-4 font-black ${e.status === 'completed' ? 'line-through' : ''}`}>{e.title}</span>
                    </div>
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] font-black text-[#002395] px-6 py-3 bg-blue-50/50 backdrop-blur-sm rounded-full inline-block uppercase tracking-[0.2em] border border-blue-100 shadow-sm">+ {dayEvents.length - 3} EVENTOS</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const WeekView: React.FC<{ date: Date; events: CalendarEvent[]; onEventClick: (ev: CalendarEvent) => void; onToggleTask: (id: string, e: React.MouseEvent) => void }> = ({ date, events, onEventClick, onToggleTask }) => {
    const days = useMemo(() => getWeekDays(date), [date]);
    const hours = Array.from({ length: 14 }, (_, i) => i + 7);

    return (
        <div className="bg-white rounded-[6rem] border border-slate-200 shadow-[0_60px_120px_-20px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col min-w-[1400px]">
            <div className="flex border-b border-slate-200 bg-slate-50/50 backdrop-blur-md shadow-inner">
                <div className="w-40 border-r border-slate-200 py-12 flex items-center justify-center text-[12px] font-black text-slate-400 uppercase tracking-[0.5em]">HORA</div>
                {days.map((d, i) => {
                    const isToday = isSameDay(d, new Date());
                    return (
                        <div key={i} className="flex-1 py-10 text-center border-r border-slate-100 last:border-r-0 group">
                            <div className="text-[12px] font-black text-slate-400 uppercase tracking-[0.4em] mb-6 group-hover:text-blue-900 transition-colors">{d.toLocaleDateString('pt-BR', { weekday: 'short' })}</div>
                            <div className={`inline-flex w-20 h-20 items-center justify-center rounded-[2.5rem] text-3xl font-black transition-all duration-500 ${isToday ? 'bg-gradient-to-br from-[#002395] to-indigo-900 text-white shadow-2xl shadow-blue-500/50 scale-110' : 'text-slate-950 hover:bg-slate-100'}`}>
                                {d.getDate()}
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="flex-1 overflow-auto max-h-[1000px] custom-scrollbar bg-slate-50/20">
                {hours.map(hour => (
                    <div key={hour} className="flex min-h-[180px] border-b border-slate-100 group">
                        <div className="w-40 border-r border-slate-200 p-10 text-right flex flex-col justify-center gap-2 bg-white/50 backdrop-blur-sm">
                            <span className="text-4xl font-black text-slate-950 leading-none tracking-tighter tabular-nums">{hour.toString().padStart(2, '0')}</span>
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">H/MARK</span>
                        </div>
                        {days.map((d, i) => {
                            const hourEvents = events.filter(e => isSameDay(e.start, d) && e.start.getHours() === hour);
                            return (
                                <div key={i} className="flex-1 border-r border-slate-50 last:border-r-0 relative hover:bg-white/80 transition-all p-4 flex flex-col gap-4">
                                    {hourEvents.map(e => (
                                        <div key={e.id} onClick={() => onEventClick(e)}
                                          className={`cursor-pointer p-8 rounded-[3.5rem] h-full shadow-2xl flex flex-col justify-between transition-all hover:scale-[1.05] hover:z-10 bg-gradient-to-br ${e.color} text-white border-2 border-white/20 group/card relative overflow-hidden ${e.status === 'completed' || e.status === 'cancelled' ? 'opacity-30 grayscale' : ''}`}>
                                            <div className="absolute top-0 right-0 p-8 text-7xl opacity-10 rotate-12">{e.status === 'completed' ? '✔️' : e.emoji}</div>
                                            <div className="flex items-start gap-6 relative z-10">
                                                <div className="flex items-center gap-4">
                                                   {e.type === 'task' && (
                                                     <div 
                                                       onClick={(evt) => onToggleTask(e.id, evt)}
                                                       className={`w-8 h-8 rounded-xl flex items-center justify-center border-2 transition-all ${e.status === 'completed' ? 'bg-white border-white text-emerald-600 shadow-lg' : 'bg-transparent border-white/50 text-transparent hover:border-white'}`}
                                                     >
                                                       {e.status === 'completed' && <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>}
                                                     </div>
                                                   )}
                                                   <div className={`w-16 h-16 rounded-[1.5rem] bg-white/10 backdrop-blur-xl flex items-center justify-center text-4xl shadow-inner group-hover/card:rotate-[360deg] transition-all duration-1000 border border-white/20 ${e.status === 'completed' ? 'hidden' : ''}`}>{e.emoji}</div>
                                                </div>
                                                <div className="flex flex-col flex-1 mt-1">
                                                    <span className={`text-lg font-black uppercase leading-tight tracking-tighter mb-2 ${e.status === 'completed' ? 'line-through' : ''}`}>{e.title}</span>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                                                        <span className="text-[10px] font-black opacity-70 uppercase tracking-widest">{e.responsible}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col text-[10px] font-black uppercase tracking-[0.2em] opacity-60 border-t border-white/10 pt-6 mt-6 relative z-10">
                                                <div className="flex justify-between items-center">
                                                    <span className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[7px]">👤</div> REG: {e.createdBy.toUpperCase()}</span>
                                                    <span className="bg-white/10 px-6 py-2 rounded-full backdrop-blur-md border border-white/5">{formatTime(e.start)} - {formatTime(e.end)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default App;

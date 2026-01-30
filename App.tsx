
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CalendarEvent, ViewType, EventType, EventStatus, UserRole } from './types';
import { getMonthDays, getWeekDays, isSameDay, formatTime, formatDate } from './utils/dateUtils';
import { parseEventDescription } from './services/geminiService';

const App: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewType>('month');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [role, setRole] = useState<UserRole>('secretaria');
  const [zoomLevel, setZoomLevel] = useState<'small' | 'medium' | 'large'>('medium');

  const [isSmartAddOpen, setIsSmartAddOpen] = useState(false);
  const [smartInput, setSmartInput] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [isParsing, setIsParsing] = useState(false);

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const [pendingNotifications, setPendingNotifications] = useState<string[]>([]);
  const notifiedEventsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const saved = localStorage.getItem('ciap_boss_agenda_v6');
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
                title: 'Verificar relatórios trimestrais',
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
    const savedZoom = localStorage.getItem('ciap_zoom');
    if (savedZoom) setZoomLevel(savedZoom as any);
  }, []);

  useEffect(() => {
    localStorage.setItem('ciap_boss_agenda_v6', JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    localStorage.setItem('ciap_operator', operatorName);
    localStorage.setItem('ciap_role', role);
    localStorage.setItem('ciap_zoom', zoomLevel);
  }, [operatorName, role, zoomLevel]);

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
    };
  }, [events]);

  const openDetail = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsDetailModalOpen(true);
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

  const handleToggleTask = (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEvents(prev => prev.map(event => {
      if (event.id === eventId && event.type === 'task') {
        return { ...event, status: event.status === 'completed' ? 'active' : 'completed' };
      }
      return event;
    }));
  };

  const handleShareWhatsApp = (event: CalendarEvent) => {
    const text = `📢 *CIAP PM/PA - Agenda Chefia*\n🗓️ *Evento:* ${event.title}\n📅 *Data:* ${formatDate(event.start)}\n⏰ *Hora:* ${formatTime(event.start)}\n👤 *Responsável:* ${event.responsible}\n👥 *Participantes:* ${event.participants.join(', ')}\n📝 *Descrição:* ${event.description || 'Sem descrição.'}\n✍️ *Registrado por:* ${event.createdBy}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    notifiedEventsRef.current.add(event.id);
    setPendingNotifications(prev => prev.filter(id => id !== event.id));
  };

  const CIAPBrasaoOficial = () => (
    <div className="flex flex-col items-center mb-6 group cursor-pointer select-none">
      <div className="relative w-32 h-32 flex items-center justify-center">
        <div className="absolute inset-0 bg-white rounded-full border border-slate-200 shadow-lg flex items-center justify-center">
           <div className="absolute inset-1.5 border-[8px] border-transparent border-t-[#E21E26] border-r-[#E21E26] rounded-full rotate-[15deg] transition-all duration-1000 group-hover:rotate-[375deg]"></div>
           <div className="absolute inset-3.5 bg-slate-50 rounded-full flex items-center justify-center shadow-inner border border-slate-100 overflow-hidden">
                <div className="relative z-10 flex flex-col items-center justify-center scale-75">
                    <div className="w-20 h-24 border-[2px] border-[#002395] rounded-b-xl bg-white shadow-md flex flex-col overflow-hidden">
                        <div className="h-8 border-b-[2px] border-red-600 flex overflow-hidden">
                            <div className="flex-1 bg-[#E21E26] flex items-center justify-center text-[8px] font-black text-white italic">PM</div>
                            <div className="w-5 bg-white flex items-center justify-center border-x-[1px] border-slate-100">
                                <span className="text-amber-500 text-[10px]">⚔️</span>
                            </div>
                            <div className="flex-1 bg-[#002395] flex items-center justify-center text-[8px] font-black text-white italic">PA</div>
                        </div>
                        <div className="flex-1 flex flex-col items-center justify-center p-1 relative">
                            <div className="text-[12px] text-blue-900 font-black mb-0.5">⚖️</div>
                            <div className="text-[4px] text-[#002395] font-black uppercase text-center leading-[5px] tracking-tight">Centro Integrado<br/>Atenção Psicossocial</div>
                            <div className="text-[4px] text-blue-800 font-black mt-0.5">2020</div>
                        </div>
                    </div>
                </div>
           </div>
        </div>
      </div>
      <div className="text-center mt-2">
        <h1 className="font-black text-xl text-slate-800 tracking-[-0.02em] uppercase">CIAP</h1>
        <p className="text-[7px] text-slate-500 font-bold uppercase tracking-[0.3em] opacity-80 -mt-1">PMPA Oficial</p>
      </div>
    </div>
  );

  const zoomClasses = {
    small: 'zoom-small',
    medium: 'zoom-medium',
    large: 'zoom-large'
  };

  return (
    <div className={`flex h-screen overflow-hidden bg-[#f0f2f5] text-slate-800 font-sans selection:bg-blue-100 zoom-transition ${zoomClasses[zoomLevel]}`}>
      <aside className="w-[18rem] bg-white border-r border-slate-200 p-4 flex flex-col gap-4 shadow-sm z-20 overflow-y-auto">
        <CIAPBrasaoOficial />

        {/* Controle de Zoom Proporcional */}
        <div className="space-y-2">
            <h3 className="text-[8px] font-bold uppercase text-slate-400 px-3 tracking-widest opacity-50">Escala de Interface</h3>
            <div className="bg-slate-100 p-1 rounded-xl flex gap-1 border border-slate-200">
                {[
                    { id: 'small', label: 'Comp.', icon: '🔍-' },
                    { id: 'medium', label: 'Std.', icon: '🔍' },
                    { id: 'large', label: 'Ampl.', icon: '🔍+' }
                ].map(z => (
                    <button key={z.id} onClick={() => setZoomLevel(z.id as any)}
                        className={`flex-1 py-2 px-1 rounded-lg text-[8px] font-bold uppercase transition-all flex items-center justify-center gap-1 ${zoomLevel === z.id ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                        {z.label}
                    </button>
                ))}
            </div>
        </div>

        <div className="bg-slate-50 p-1.5 rounded-2xl flex gap-1 shadow-inner border border-slate-200">
            <button onClick={() => setRole('secretaria')}
                className={`flex-1 py-2 px-1 rounded-xl text-[8px] font-bold uppercase tracking-widest transition-all ${role === 'secretaria' ? 'bg-[#002395] text-white shadow-md' : 'text-slate-400 hover:bg-slate-200'}`}>
                Secretária
            </button>
            <button onClick={() => setRole('chefe')}
                className={`flex-1 py-2 px-1 rounded-xl text-[8px] font-bold uppercase tracking-widest transition-all ${role === 'chefe' ? 'bg-[#E21E26] text-white shadow-md' : 'text-slate-400 hover:bg-slate-200'}`}>
                Chefia
            </button>
        </div>

        <div className="space-y-3">
          {role === 'secretaria' && (
            <button onClick={() => setIsSmartAddOpen(true)}
                className="w-full flex items-center justify-center gap-3 bg-gradient-to-br from-[#002395] to-indigo-900 text-white py-3.5 px-4 rounded-xl shadow-lg transition-all active:scale-95 group overflow-hidden relative">
                <span className="text-lg">⚡</span>
                <span className="font-semibold tracking-tight text-[10px] uppercase">Novo Evento</span>
            </button>
          )}
          
          <div className={`bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-sm border-l-4 ${role === 'chefe' ? 'border-amber-400' : 'border-[#E21E26]'}`}>
            <label className="text-[8px] font-bold uppercase text-slate-400 mb-1 block tracking-widest opacity-70">Operador</label>
            <input type="text" value={operatorName} onChange={(e) => setOperatorName(e.target.value)}
              placeholder={role === 'chefe' ? "Coronel Diretor" : "Voluntária Secretária"}
              className="w-full bg-transparent text-[10px] font-bold outline-none uppercase tracking-tighter text-slate-700" />
          </div>
        </div>

        <nav className="flex flex-col gap-1 mt-2">
            <h3 className="text-[8px] font-bold uppercase text-slate-400 mb-2 px-3 tracking-widest opacity-50">Navegação</h3>
            {[
                { id: 'month', label: 'Mensal', icon: '📅' },
                { id: 'week', label: 'Semanal', icon: '🗓️' },
                { id: 'dashboard', label: 'Dashboard', icon: '📊' }
            ].map(item => (
                <button key={item.id} onClick={() => setView(item.id as ViewType)}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all font-semibold text-[10px] uppercase tracking-wider ${view === item.id ? (role === 'chefe' ? 'bg-slate-900 text-white shadow-md translate-x-1' : 'bg-[#002395] text-white shadow-md translate-x-1') : 'hover:bg-slate-50 text-slate-500'}`}>
                    <span>{item.icon}</span> {item.label}
                </button>
            ))}
        </nav>

        {pendingNotifications.length > 0 && role === 'secretaria' && (
          <div className="mt-4 bg-emerald-50 border border-emerald-200 p-4 rounded-2xl space-y-3 animate-pulse">
            <p className="text-[8px] font-bold text-emerald-800 uppercase flex items-center gap-2">🔔 Alertas ({pendingNotifications.length})</p>
            {pendingNotifications.slice(0, 1).map(id => {
              const ev = events.find(e => e.id === id);
              if (!ev) return null;
              return (
                <button key={id} onClick={() => handleShareWhatsApp(ev)}
                    className="w-full bg-[#25D366] text-white py-2 rounded-lg text-[9px] font-bold uppercase hover:brightness-105 shadow-sm">
                    Avisar Chefe
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-auto pt-4 border-t border-slate-100">
            <div className={`p-4 rounded-2xl shadow-sm text-white ${role === 'chefe' ? 'bg-slate-900' : 'bg-blue-900'}`}>
                <div className="flex justify-between items-end">
                    <div>
                        <p className="text-[7px] font-bold uppercase opacity-60">Status Gabinete</p>
                        <p className="text-xl font-bold">{stats.total - stats.cancelled}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[7px] font-bold uppercase opacity-60">Concluídos</p>
                        <p className="text-xl font-bold text-emerald-400">{stats.completed}</p>
                    </div>
                </div>
            </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-6">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-black text-[10px] ${role === 'chefe' ? 'bg-slate-900' : 'bg-[#002395]'}`}>
                {role === 'chefe' ? 'CMD' : 'SEC'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-950 flex items-center gap-3 tracking-tight">
                {role === 'chefe' ? 'Sr. Diretor' : 'Secretaria CIAP'}
                <div className={`h-2 w-2 rounded-full animate-pulse ${role === 'chefe' ? 'bg-amber-400' : 'bg-[#E21E26]'}`}></div>
              </h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {view !== 'dashboard' && (
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth() - 1); setCurrentDate(d); }} className="p-2 hover:bg-white rounded-lg transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M15 19l-7-7 7-7"/></svg></button>
                    <button onClick={() => setCurrentDate(new Date())} className="px-4 text-[10px] font-bold uppercase tracking-widest">Hoje</button>
                    <button onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth() + 1); setCurrentDate(d); }} className="p-2 hover:bg-white rounded-lg transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M9 5l7 7-7 7"/></svg></button>
                </div>
            )}
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-md ${role === 'chefe' ? 'bg-slate-800' : 'bg-red-600'}`}>
                {role === 'chefe' ? '★' : '👤'}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6 bg-[#f8fafc]">
          {view === 'month' && <MonthView date={currentDate} events={events} onEventClick={openDetail} onToggleTask={handleToggleTask} />}
          {view === 'week' && <WeekView date={currentDate} events={events} onEventClick={openDetail} onToggleTask={handleToggleTask} />}
          {view === 'dashboard' && <Dashboard stats={stats} role={role} />}
        </div>
      </main>

      {isDetailModalOpen && selectedEvent && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className={`h-2 bg-gradient-to-r ${selectedEvent.color}`}></div>
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-md bg-gradient-to-br ${selectedEvent.color} text-white`}>
                    {selectedEvent.status === 'completed' ? '✔️' : selectedEvent.emoji}
                  </div>
                  <div>
                    <h3 className={`text-xl font-bold tracking-tight ${selectedEvent.status === 'completed' ? 'line-through opacity-40' : ''}`}>{selectedEvent.title}</h3>
                    <span className="text-[9px] font-bold px-3 py-1 bg-slate-100 rounded-full uppercase tracking-wider text-slate-500">{selectedEvent.type}</span>
                  </div>
                </div>
                <button onClick={() => setIsDetailModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-all">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="space-y-1">
                  <p className="text-[8px] font-bold uppercase text-slate-400 tracking-widest">Data e Início</p>
                  <p className="text-sm font-semibold">{formatDate(selectedEvent.start)} - {formatTime(selectedEvent.start)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[8px] font-bold uppercase text-slate-400 tracking-widest">Responsável</p>
                  <p className="text-sm font-semibold uppercase">{selectedEvent.responsible}</p>
                </div>
              </div>

              <div className="space-y-3 mb-8">
                <p className="text-[8px] font-bold uppercase text-slate-400 tracking-widest">Descrição / Pauta</p>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm leading-relaxed text-slate-600 font-medium">
                  {selectedEvent.description || 'Nenhuma pauta detalhada para este evento.'}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                <button onClick={() => handleShareWhatsApp(selectedEvent)}
                    className="px-4 py-2 text-[10px] font-bold uppercase bg-[#25D366] text-white rounded-lg hover:brightness-105 transition-all flex items-center gap-2">
                    <span>📲</span> Compartilhar
                </button>
                {selectedEvent.type === 'task' && (
                  <button onClick={(e) => handleToggleTask(selectedEvent.id, e as any)}
                    className="px-4 py-2 text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors">
                    {selectedEvent.status === 'completed' ? 'Reabrir' : 'Concluir'}
                  </button>
                )}
                <button onClick={() => setIsDetailModalOpen(false)}
                    className="px-6 py-2 text-[10px] font-bold uppercase bg-slate-900 text-white rounded-lg hover:bg-black transition-colors">
                    Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isSmartAddOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl p-6 animate-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold uppercase tracking-tight">Inserir Evento AI</h3>
              <button onClick={() => setIsSmartAddOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg"><svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
            <form onSubmit={handleSmartAdd}>
              <textarea autoFocus value={smartInput} onChange={(e) => setSmartInput(e.target.value)}
                placeholder="Ex: Reunião de comando amanhã às 15h com Cel. Souza..."
                className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-sm mb-4 font-medium" />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setIsSmartAddOpen(false)} className="px-4 py-2 text-[10px] font-bold uppercase text-slate-400">Cancelar</button>
                <button disabled={isParsing || !smartInput} type="submit"
                  className="px-6 py-2 bg-blue-900 text-white text-[10px] font-bold uppercase rounded-xl shadow-lg disabled:opacity-50 transition-all">
                  {isParsing ? 'Processando...' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const Dashboard: React.FC<{ stats: any, role: string }> = ({ stats, role }) => (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
                { label: 'Total Ativos', value: stats.total - stats.cancelled, color: role === 'chefe' ? 'bg-slate-900' : 'bg-blue-900' },
                { label: 'Em Aberto', value: stats.total - stats.completed - stats.cancelled, color: 'bg-indigo-700' },
                { label: 'Concluídos', value: stats.completed, color: 'bg-emerald-600' },
                { label: 'Cancelados', value: stats.cancelled, color: 'bg-red-600' }
            ].map((s, i) => (
                <div key={i} className={`${s.color} p-6 rounded-2xl shadow-md text-white`}>
                    <p className="text-[8px] font-bold uppercase opacity-60 tracking-widest">{s.label}</p>
                    <p className="text-3xl font-bold mt-1">{s.value}</p>
                </div>
            ))}
        </div>
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 h-64 flex items-end justify-between gap-4">
            {[40, 80, 60, 95, 70, 85, 50].map((h, i) => (
                <div key={i} className="flex-1 bg-slate-50 rounded-lg h-full relative group flex flex-col justify-end p-1">
                    <div style={{ height: `${h}%` }} className={`w-full rounded-md transition-all group-hover:brightness-110 ${role === 'chefe' ? 'bg-slate-800' : 'bg-blue-800'}`}></div>
                    <span className="text-[6px] font-bold text-center mt-2 text-slate-400">SEM 0{i+1}</span>
                </div>
            ))}
        </div>
    </div>
);

const MonthView: React.FC<{ date: Date; events: CalendarEvent[]; onEventClick: (ev: CalendarEvent) => void; onToggleTask: (id: string, e: React.MouseEvent) => void }> = ({ date, events, onEventClick, onToggleTask }) => {
  const days = useMemo(() => getMonthDays(date), [date]);
  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
          <div key={d} className="py-3 text-center text-[9px] font-bold text-slate-500 uppercase tracking-widest">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const dayEvents = events.filter(e => isSameDay(e.start, day.date));
          const isToday = isSameDay(day.date, new Date());
          return (
            <div key={i} className={`min-h-[120px] border-b border-r border-slate-100 p-2 hover:bg-slate-50 transition-all ${!day.currentMonth ? 'opacity-20' : ''}`}>
              <div className="flex justify-between items-center mb-2">
                <span className={`text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded-lg ${isToday ? 'bg-red-600 text-white' : 'text-slate-400'}`}>{day.date.getDate()}</span>
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map(e => (
                  <div key={e.id} onClick={() => onEventClick(e)}
                    className={`cursor-pointer px-2 py-1 rounded-md text-[8px] font-bold flex items-center gap-2 bg-gradient-to-r ${e.color} text-white truncate shadow-sm hover:brightness-110 transition-all ${e.status === 'completed' ? 'opacity-40 line-through' : ''}`}>
                    {e.type === 'task' && <div onClick={(evt) => onToggleTask(e.id, evt)} className="w-2.5 h-2.5 rounded bg-white/20 border border-white/40"></div>}
                    <span className="truncate">{e.title}</span>
                  </div>
                ))}
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
    const hours = Array.from({ length: 12 }, (_, i) => i + 8);
    return (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="flex border-b border-slate-200 bg-slate-50">
                <div className="w-16 border-r border-slate-200 py-4 flex items-center justify-center text-[8px] font-bold text-slate-400 uppercase tracking-widest">HORA</div>
                {days.map((d, i) => (
                    <div key={i} className="flex-1 py-4 text-center border-r border-slate-100">
                        <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{d.toLocaleDateString('pt-BR', { weekday: 'short' })}</div>
                        <div className={`text-sm font-bold mt-1 ${isSameDay(d, new Date()) ? 'text-red-600' : 'text-slate-700'}`}>{d.getDate()}</div>
                    </div>
                ))}
            </div>
            <div className="flex-1 overflow-auto max-h-[600px]">
                {hours.map(hour => (
                    <div key={hour} className="flex min-h-[60px] border-b border-slate-100">
                        <div className="w-16 border-r border-slate-200 px-2 py-4 text-right text-[10px] font-semibold text-slate-300">{hour}:00</div>
                        {days.map((d, i) => {
                            const hourEvents = events.filter(e => isSameDay(e.start, d) && e.start.getHours() === hour);
                            return (
                                <div key={i} className="flex-1 border-r border-slate-50 p-1 flex flex-col gap-1">
                                    {hourEvents.map(e => (
                                        <div key={e.id} onClick={() => onEventClick(e)}
                                          className={`cursor-pointer p-2 rounded-lg text-[8px] font-bold bg-gradient-to-r ${e.color} text-white shadow-sm flex flex-col justify-between hover:brightness-110 transition-all ${e.status === 'completed' ? 'opacity-40' : ''}`}>
                                            <span className={`truncate ${e.status === 'completed' ? 'line-through' : ''}`}>{e.title}</span>
                                            <span className="opacity-70 text-[7px] mt-1">{formatTime(e.start)}</span>
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

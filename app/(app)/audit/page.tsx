'use client';

import { useState, useMemo } from 'react';
import { useAuditLogs } from '@/hooks/use-queries';
import { History, Search, Filter, Box, Banknote, User, TrendingUp, Shield, Clock, CalendarDays } from 'lucide-react';

type DatePreset = 'today' | '7days' | '30days' | 'all';

function getPresetRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().split('T')[0];
  if (preset === 'all') return { from: '', to: '' };
  if (preset === 'today') return { from: to, to };
  const d = new Date(now);
  d.setDate(d.getDate() - (preset === '7days' ? 7 : 30));
  return { from: d.toISOString().split('T')[0], to };
}

export default function AuditTrailPage() {
  const { data: logs = [] } = useAuditLogs();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEntity, setFilterEntity] = useState('All');
  const [filterAgent, setFilterAgent] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activePreset, setActivePreset] = useState<DatePreset | null>('all');

  const uniqueAgents = useMemo(() => {
    const names = new Set(logs.map((l) => l.userName));
    return Array.from(names).sort();
  }, [logs]);

  const applyPreset = (preset: DatePreset) => {
    setActivePreset(preset);
    const range = getPresetRange(preset);
    setDateFrom(range.from);
    setDateTo(range.to);
  };

  const handleDateChange = (field: 'from' | 'to', value: string) => {
    setActivePreset(null);
    if (field === 'from') setDateFrom(value);
    else setDateTo(value);
  };

  const filteredLogs = useMemo(() => logs.filter((log) => {
    const matchesSearch = log.userName.toLowerCase().includes(searchTerm.toLowerCase()) || log.details.toLowerCase().includes(searchTerm.toLowerCase()) || log.action.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEntity = filterEntity === 'All' || log.entityType === filterEntity;
    const matchesAgent = filterAgent === 'All' || log.userName === filterAgent;

    let matchesDate = true;
    if (dateFrom || dateTo) {
      const logDate = log.timestamp.split('T')[0];
      if (dateFrom && logDate < dateFrom) matchesDate = false;
      if (dateTo && logDate > dateTo) matchesDate = false;
    }

    return matchesSearch && matchesEntity && matchesAgent && matchesDate;
  }), [logs, searchTerm, filterEntity, filterAgent, dateFrom, dateTo]);

  const getEntityIcon = (type: string) => {
    const map: Record<string, React.ReactNode> = { Inventory: <Box size={16} className="text-blue-500" />, Sale: <Banknote size={16} className="text-green-500" />, Customer: <User size={16} className="text-purple-500" /> };
    return map[type] || <Shield size={16} className="text-slate-500" />;
  };

  const presetLabels: Record<DatePreset, string> = {
    today: 'Today',
    '7days': 'Last 7 Days',
    '30days': 'Last 30 Days',
    all: 'All',
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div><h1 className="text-2xl font-semibold tracking-tight flex items-center gap-3"><History className="text-primary" /> System Audit Trail</h1><p className="text-muted-foreground">Traceability of all major operations and stock movements.</p></div>

      <div className="flex flex-col gap-4 bg-card p-4 rounded-lg border shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-80"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input type="text" placeholder="Search by agent or action..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-10 text-sm focus:outline-none focus:ring-1 focus:ring-ring" /></div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 border rounded-md px-3 py-1.5 bg-background"><Filter size={14} className="text-muted-foreground" /><select value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)} className="bg-transparent border-none text-sm font-medium focus:outline-none"><option value="All">All Entities</option><option>Inventory</option><option>Sale</option><option>Customer</option><option>System</option></select></div>
            <div className="flex items-center gap-2 border rounded-md px-3 py-1.5 bg-background"><User size={14} className="text-muted-foreground" /><select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)} className="bg-transparent border-none text-sm font-medium focus:outline-none"><option value="All">All Agents</option>{uniqueAgents.map((name) => <option key={name} value={name}>{name}</option>)}</select></div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays size={14} className="text-muted-foreground" />
            <input type="date" value={dateFrom} onChange={(e) => handleDateChange('from', e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            <span className="text-muted-foreground text-sm">to</span>
            <input type="date" value={dateTo} onChange={(e) => handleDateChange('to', e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div className="flex items-center gap-1.5">
            {(['today', '7days', '30days', 'all'] as DatePreset[]).map((preset) => (
              <button
                key={preset}
                onClick={() => applyPreset(preset)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activePreset === preset
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border'
                }`}
              >
                {presetLabels[preset]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">Showing <span className="font-semibold text-foreground">{filteredLogs.length}</span> of <span className="font-semibold text-foreground">{logs.length}</span> entries</p>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b text-[10px] uppercase font-bold text-muted-foreground tracking-wider"><tr><th className="h-12 px-6 text-left">Timestamp</th><th className="h-12 px-6 text-left">Agent</th><th className="h-12 px-6 text-left">Entity</th><th className="h-12 px-6 text-left">Action</th><th className="h-12 px-6 text-left">Details</th></tr></thead>
            <tbody className="divide-y">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/30">
                  <td className="p-6 whitespace-nowrap"><div className="flex flex-col"><span className="font-bold">{new Date(log.timestamp).toLocaleDateString()}</span><span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock size={10} /> {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div></td>
                  <td className="p-6"><div className="flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary border">{log.userName.charAt(0)}</div><div className="flex flex-col"><span className="font-medium">{log.userName}</span><span className="text-[10px] text-muted-foreground uppercase">{log.location}</span></div></div></td>
                  <td className="p-6"><div className="flex items-center gap-2 font-semibold">{getEntityIcon(log.entityType)}{log.entityType}</div></td>
                  <td className="p-6"><span className="px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground text-xs font-bold uppercase border border-border/50">{log.action}</span></td>
                  <td className="p-6 text-muted-foreground italic text-xs max-w-xs truncate" title={log.details}>{log.details}</td>
                </tr>
              ))}
              {filteredLogs.length === 0 && <tr><td colSpan={5} className="p-12 text-center text-muted-foreground italic">No activity logs found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useAgents, useSaveAgents, useHubs, useSaveHubs } from '@/hooks/use-queries';
import { usePermissions } from '@/hooks/use-permissions';
import { StorageService } from '@/lib/storage-service';
import {
  getRolePermissions, saveRolePermissions, DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_GROUPS, Permission, RoleName,
} from '@/lib/permissions';
import { Agent, Hub } from '@/types';
import { toast } from 'sonner';
import {
  Save, User, Lock, Moon, Sun, Trash2, AlertTriangle,
  Users, Plus, X, Pencil, MapPin, Building2, Shield,
  ChevronDown, ChevronRight, Check, RotateCcw,
} from 'lucide-react';

const inputCls = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';
const labelCls = 'text-sm font-medium';
const btnPrimary = 'inline-flex items-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2';
const btnSecondary = 'inline-flex items-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent h-9 px-4 py-2';

const ROLES: RoleName[] = ['Company Admin', 'Hub Manager', 'Finance', 'Customer Success'];

export default function SettingsPage() {
  const { user, updateProfile } = useAuth();
  const { data: agents = [] } = useAgents();
  const { data: hubs = [] } = useHubs();
  const saveAgents = useSaveAgents();
  const saveHubs = useSaveHubs();
  const { can } = usePermissions();

  const canManageUsers = can('settings.manage_users');
  const canManageHubs = can('settings.manage_hubs');
  const canManageRoles = can('settings.manage_roles');
  const canResetData = can('settings.reset_data');

  const activeHubs = hubs.filter((h) => h.isActive);

  const [activeTab, setActiveTab] = useState<'Profile' | 'Users' | 'Hubs' | 'Roles & Permissions' | 'Preferences' | 'Data'>('Profile');
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [location, setLocation] = useState(user?.location || 'Lagos');
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<Agent>>({ role: 'Hub Manager', location: activeHubs[0]?.name || 'Lagos' });
  const [confirmAction, setConfirmAction] = useState<{ type: 'deleteUser' | 'deleteHub' | 'resetData' | 'resetRoles'; payload?: string } | null>(null);

  // Hub management state
  const [showHubModal, setShowHubModal] = useState(false);
  const [editingHub, setEditingHub] = useState<Partial<Hub>>({ isActive: true });

  // Roles & Permissions state
  const [rolePerms, setRolePerms] = useState<Record<RoleName, Permission[]>>(getRolePermissions);
  const [selectedRole, setSelectedRole] = useState<RoleName>('Hub Manager');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(PERMISSION_GROUPS.map((g) => g.label)));
  const [rolesDirty, setRolesDirty] = useState(false);

  useEffect(() => {
    setDarkMode(document.documentElement.classList.contains('dark'));
  }, []);

  // ── Profile ──
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await updateProfile({ name, email, phone, location });
    setLoading(false);
    toast.success('Profile updated.');
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword !== confirmPassword) { toast.error('Passwords do not match.'); return; }
    setLoading(true);
    await updateProfile({ password: newPassword });
    setLoading(false);
    setNewPassword(''); setConfirmPassword('');
    toast.success('Password changed.');
  };

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (next) { document.documentElement.classList.add('dark'); localStorage.setItem('fudfarmer_theme', 'dark'); }
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('fudfarmer_theme', 'light'); }
  };

  // ── Users ──
  const handleSaveUser = () => {
    if (!editingUser.name || !editingUser.email) { toast.error('Name and email required.'); return; }
    if (editingUser.id) {
      saveAgents.mutate(agents.map((a) => a.id === editingUser.id ? { ...a, ...editingUser } as Agent : a));
    } else {
      const newAgent: Agent = {
        id: StorageService.generateId(), name: editingUser.name!, email: editingUser.email!,
        phone: editingUser.phone || '', role: editingUser.role as Agent['role'] || 'Hub Manager',
        location: editingUser.location || activeHubs[0]?.name || 'Lagos',
        joinedDate: new Date().toISOString().split('T')[0], password: 'password',
      };
      saveAgents.mutate([...agents, newAgent]);
    }
    setShowUserModal(false); setEditingUser({ role: 'Hub Manager', location: activeHubs[0]?.name || 'Lagos' });
    toast.success('User saved.');
  };

  const handleDeleteUser = (id: string) => {
    if (id === user?.id) { toast.error("Can't delete yourself."); return; }
    setConfirmAction({ type: 'deleteUser', payload: id });
  };

  // ── Hubs ──
  const handleSaveHub = () => {
    if (!editingHub.name) { toast.error('Hub name is required.'); return; }
    const duplicate = hubs.find((h) => h.name.toLowerCase() === editingHub.name!.toLowerCase() && h.id !== editingHub.id);
    if (duplicate) { toast.error('A hub with that name already exists.'); return; }

    if (editingHub.id) {
      saveHubs.mutate(hubs.map((h) => h.id === editingHub.id ? { ...h, ...editingHub } as Hub : h));
      StorageService.addAuditLog({ userId: user?.id || 'admin', userName: user?.name || 'Admin', action: 'HUB_UPDATED', entityType: 'System', details: `Hub "${editingHub.name}" updated`, location: user?.location || activeHubs[0]?.name || 'Lagos' });
    } else {
      const newHub: Hub = {
        id: StorageService.generateId(),
        name: editingHub.name!,
        address: editingHub.address || '',
        phone: editingHub.phone || '',
        managerName: editingHub.managerName || '',
        isActive: editingHub.isActive !== false,
        createdDate: new Date().toISOString().split('T')[0],
      };
      saveHubs.mutate([...hubs, newHub]);
      StorageService.addAuditLog({ userId: user?.id || 'admin', userName: user?.name || 'Admin', action: 'HUB_CREATED', entityType: 'System', details: `New hub "${newHub.name}" created`, location: user?.location || activeHubs[0]?.name || 'Lagos' });
    }
    setShowHubModal(false);
    setEditingHub({ isActive: true });
    toast.success('Hub saved.');
  };

  const handleToggleHub = (hub: Hub) => {
    saveHubs.mutate(hubs.map((h) => h.id === hub.id ? { ...h, isActive: !h.isActive } : h));
    toast.success(hub.isActive ? `Hub "${hub.name}" deactivated.` : `Hub "${hub.name}" activated.`);
  };

  const handleDeleteHub = (id: string) => {
    setConfirmAction({ type: 'deleteHub', payload: id });
  };

  // ── Roles & Permissions ──
  const togglePermission = (perm: Permission) => {
    if (selectedRole === 'Company Admin') return; // Admin always has all
    const current = rolePerms[selectedRole] || [];
    const next = current.includes(perm) ? current.filter((p) => p !== perm) : [...current, perm];
    setRolePerms({ ...rolePerms, [selectedRole]: next });
    setRolesDirty(true);
  };

  const toggleGroup = (groupLabel: string) => {
    const next = new Set(expandedGroups);
    if (next.has(groupLabel)) next.delete(groupLabel); else next.add(groupLabel);
    setExpandedGroups(next);
  };

  const toggleAllInGroup = (group: typeof PERMISSION_GROUPS[0]) => {
    if (selectedRole === 'Company Admin') return;
    const current = rolePerms[selectedRole] || [];
    const groupKeys = group.permissions.map((p) => p.key);
    const allSelected = groupKeys.every((k) => current.includes(k));
    const next = allSelected
      ? current.filter((p) => !groupKeys.includes(p))
      : [...new Set([...current, ...groupKeys])];
    setRolePerms({ ...rolePerms, [selectedRole]: next });
    setRolesDirty(true);
  };

  const handleSaveRoles = () => {
    saveRolePermissions(rolePerms);
    setRolesDirty(false);
    StorageService.addAuditLog({ userId: user?.id || 'admin', userName: user?.name || 'Admin', action: 'ROLES_UPDATED', entityType: 'System', details: `Permissions updated for "${selectedRole}"`, location: user?.location || 'Lagos' });
    toast.success(`Permissions saved for ${selectedRole}.`);
  };

  const handleResetRoles = () => {
    setConfirmAction({ type: 'resetRoles' });
  };

  const selectedPerms = rolePerms[selectedRole] || [];
  const permCount = selectedPerms.length;
  const totalPerms = PERMISSION_GROUPS.reduce((sum, g) => sum + g.permissions.length, 0);

  // ── Confirm action executor ──
  const executeConfirmAction = () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'deleteUser' && confirmAction.payload) {
      saveAgents.mutate(agents.filter((a) => a.id !== confirmAction.payload));
      toast.success('User deleted.');
    } else if (confirmAction.type === 'deleteHub' && confirmAction.payload) {
      saveHubs.mutate(hubs.filter((h) => h.id !== confirmAction.payload));
      StorageService.addAuditLog({ userId: user?.id || 'admin', userName: user?.name || 'Admin', action: 'HUB_DELETED', entityType: 'System', details: `Hub deleted`, location: user?.location || activeHubs[0]?.name || 'Lagos' });
      toast.success('Hub deleted.');
    } else if (confirmAction.type === 'resetData') {
      StorageService.resetData();
    } else if (confirmAction.type === 'resetRoles') {
      setRolePerms({ ...DEFAULT_ROLE_PERMISSIONS });
      saveRolePermissions({ ...DEFAULT_ROLE_PERMISSIONS });
      setRolesDirty(false);
      toast.success('All role permissions reset to defaults.');
    }
    setConfirmAction(null);
  };

  const getPasswordStrength = (password: string): { label: string; color: string; width: string } => {
    if (!password) return { label: '', color: '', width: 'w-0' };
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    if (score <= 2) return { label: 'Weak', color: 'bg-destructive', width: 'w-1/3' };
    if (score <= 3) return { label: 'Medium', color: 'bg-yellow-500', width: 'w-2/3' };
    return { label: 'Strong', color: 'bg-green-500', width: 'w-full' };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  const roleColorMap: Record<RoleName, string> = {
    'Company Admin': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    'Hub Manager': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    'Finance': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    'Customer Success': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  };

  const tabs = ['Profile', 'Users', 'Hubs', 'Roles & Permissions', 'Preferences', 'Data'] as const;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div><h1 className="text-2xl font-semibold tracking-tight">Settings</h1><p className="text-muted-foreground">Manage your profile, team, hubs, roles, and preferences.</p></div>

      <div className="flex border-b overflow-x-auto">{tabs.map((tab) => (
        <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-[1px] whitespace-nowrap flex items-center gap-1.5 ${activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
          {tab === 'Roles & Permissions' && <Shield size={14} />}
          {tab}
        </button>
      ))}</div>

      {/* ══════ PROFILE TAB ══════ */}
      {activeTab === 'Profile' && (
        <div className="space-y-8">
          <form onSubmit={handleProfileUpdate} className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
            <h3 className="font-bold flex items-center gap-2"><User size={18} /> Profile Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><label className={labelCls}>Full Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></div>
              <div className="space-y-2"><label className={labelCls}>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} /></div>
              <div className="space-y-2"><label className={labelCls}>Phone</label><input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} /></div>
              <div className="space-y-2"><label className={labelCls}>Hub Location</label>
                <select value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls}>
                  {activeHubs.map((h) => <option key={h.id} value={h.name}>{h.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${roleColorMap[user?.role as RoleName] || 'bg-muted'}`}>{user?.role}</span>
              <span className="text-xs text-muted-foreground">Role assigned by Company Admin</span>
            </div>
            <button type="submit" disabled={loading} className={btnPrimary}><Save size={14} className="mr-2" /> Save Changes</button>
          </form>

          <form onSubmit={handlePasswordUpdate} className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
            <h3 className="font-bold flex items-center gap-2"><Lock size={18} /> Change Password</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><label className={labelCls}>New Password</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls} />{newPassword && (<div className="mt-2 space-y-1"><div className="h-1.5 w-full rounded-full bg-muted overflow-hidden"><div className={`h-full rounded-full transition-all duration-300 ${passwordStrength.color} ${passwordStrength.width}`} /></div><p className={`text-xs font-medium ${passwordStrength.color === 'bg-destructive' ? 'text-destructive' : passwordStrength.color === 'bg-yellow-500' ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>{passwordStrength.label}</p></div>)}</div>
              <div className="space-y-2"><label className={labelCls}>Confirm Password</label><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputCls} /></div>
            </div>
            <button type="submit" disabled={loading} className={btnPrimary}><Lock size={14} className="mr-2" /> Update Password</button>
          </form>
        </div>
      )}

      {/* ══════ USERS TAB ══════ */}
      {activeTab === 'Users' && (
        <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold flex items-center gap-2"><Users size={18} /> Team Members</h3>
            {canManageUsers && <button onClick={() => { setEditingUser({ role: 'Hub Manager', location: activeHubs[0]?.name || 'Lagos' }); setShowUserModal(true); }} className={btnPrimary}><Plus size={14} className="mr-2" /> Add User</button>}
          </div>
          <div className="border rounded-lg divide-y">
            {agents.map((agent) => (
              <div key={agent.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center font-bold border">{agent.name.charAt(0)}</div>
                  <div>
                    <p className="font-medium">{agent.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${roleColorMap[agent.role] || 'bg-muted'}`}>{agent.role}</span>
                      <span className="text-xs text-muted-foreground">{agent.email} &middot; {agent.location}</span>
                    </div>
                  </div>
                </div>
                {canManageUsers && (
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingUser(agent); setShowUserModal(true); }} className="h-8 w-8 rounded-md border flex items-center justify-center hover:bg-accent"><Pencil size={14} /></button>
                    <button onClick={() => handleDeleteUser(agent.id)} className="h-8 w-8 rounded-md border flex items-center justify-center hover:bg-destructive/10 text-destructive"><Trash2 size={14} /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════ HUBS TAB ══════ */}
      {activeTab === 'Hubs' && (
        <div className="space-y-5">
          <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold flex items-center gap-2"><Building2 size={18} /> Hub Locations</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{activeHubs.length} active hub{activeHubs.length !== 1 ? 's' : ''} &middot; {hubs.length} total</p>
              </div>
              {canManageHubs && <button onClick={() => { setEditingHub({ isActive: true }); setShowHubModal(true); }} className={btnPrimary}><Plus size={14} className="mr-2" /> Add Hub</button>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {hubs.map((hub) => {
                const hubAgents = agents.filter((a) => a.location === hub.name);
                return (
                  <div key={hub.id} className={`rounded-lg border p-4 space-y-3 transition-opacity ${hub.isActive ? '' : 'opacity-50'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin size={16} className={hub.isActive ? 'text-primary' : 'text-muted-foreground'} />
                        <div>
                          <h4 className="font-semibold">{hub.name}</h4>
                          {hub.address && <p className="text-xs text-muted-foreground">{hub.address}</p>}
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${hub.isActive ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                        {hub.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {hub.phone && (
                        <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{hub.phone}</span></div>
                      )}
                      {hub.managerName && (
                        <div><span className="text-muted-foreground">Manager:</span> <span className="font-medium">{hub.managerName}</span></div>
                      )}
                      <div><span className="text-muted-foreground">Team:</span> <span className="font-medium">{hubAgents.length}</span></div>
                      <div><span className="text-muted-foreground">Since:</span> <span className="font-medium">{hub.createdDate}</span></div>
                    </div>

                    {canManageHubs && (
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <button onClick={() => { setEditingHub(hub); setShowHubModal(true); }} className="text-xs font-medium text-primary hover:underline flex items-center gap-1"><Pencil size={12} /> Edit</button>
                        <button onClick={() => handleToggleHub(hub)} className="text-xs font-medium text-muted-foreground hover:underline">
                          {hub.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        {hubAgents.length === 0 && (
                          <button onClick={() => handleDeleteHub(hub.id)} className="text-xs font-medium text-destructive hover:underline flex items-center gap-1 ml-auto"><Trash2 size={12} /> Delete</button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {!canManageHubs && (
              <p className="text-xs text-muted-foreground italic">You don&apos;t have permission to manage hubs.</p>
            )}
          </div>
        </div>
      )}

      {/* ══════ ROLES & PERMISSIONS TAB ══════ */}
      {activeTab === 'Roles & Permissions' && (
        <div className="space-y-5">
          {/* Role selector */}
          <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold flex items-center gap-2"><Shield size={18} /> Roles & Permissions</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Configure what each role can access and do across the CRM.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleResetRoles} className={btnSecondary}><RotateCcw size={14} className="mr-2" /> Reset All</button>
                {rolesDirty && <button onClick={handleSaveRoles} className={btnPrimary}><Save size={14} className="mr-2" /> Save Changes</button>}
              </div>
            </div>

            {/* Role pills */}
            <div className="flex flex-wrap gap-2">
              {ROLES.map((role) => {
                const count = (rolePerms[role] || []).length;
                return (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(role)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${selectedRole === role
                      ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                      : 'border-input hover:bg-accent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${roleColorMap[role].split(' ')[0]}`} />
                      <span>{role}</span>
                      <span className="text-[10px] text-muted-foreground font-normal">{count}/{totalPerms}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedRole === 'Company Admin' && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm">
                <Shield size={16} className="text-amber-600 shrink-0" />
                <span className="text-amber-800 dark:text-amber-300">Company Admin always has full access to all features. Permissions cannot be modified.</span>
              </div>
            )}
          </div>

          {/* Permission groups */}
          {canManageRoles ? (
            <div className="rounded-xl border bg-card shadow-sm divide-y">
              {PERMISSION_GROUPS.map((group) => {
                const isExpanded = expandedGroups.has(group.label);
                const groupPerms = group.permissions.map((p) => p.key);
                const selectedCount = groupPerms.filter((k) => selectedPerms.includes(k)).length;
                const allSelected = selectedCount === groupPerms.length;
                const someSelected = selectedCount > 0 && !allSelected;

                return (
                  <div key={group.label}>
                    {/* Group header */}
                    <div
                      className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => toggleGroup(group.label)}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleAllInGroup(group); }}
                          disabled={selectedRole === 'Company Admin'}
                          className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
                            allSelected
                              ? 'bg-primary border-primary text-white'
                              : someSelected
                              ? 'border-primary bg-primary/20'
                              : 'border-muted-foreground/30 hover:border-primary'
                          } ${selectedRole === 'Company Admin' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {allSelected && <Check size={12} strokeWidth={3} />}
                          {someSelected && !allSelected && <div className="h-0.5 w-2 bg-primary rounded" />}
                        </button>
                        <div>
                          <span className="font-semibold text-sm">{group.label}</span>
                          <span className="text-xs text-muted-foreground ml-2">{selectedCount}/{groupPerms.length}</span>
                        </div>
                      </div>
                      {isExpanded ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
                    </div>

                    {/* Individual permissions */}
                    {isExpanded && (
                      <div className="px-5 pb-4 pt-1 space-y-1 ml-8">
                        {group.permissions.map((perm) => {
                          const checked = selectedPerms.includes(perm.key);
                          return (
                            <label
                              key={perm.key}
                              className={`flex items-center gap-3 py-2 px-3 rounded-md cursor-pointer transition-colors ${
                                checked ? 'bg-primary/5' : 'hover:bg-accent/50'
                              } ${selectedRole === 'Company Admin' ? 'cursor-not-allowed opacity-70' : ''}`}
                            >
                              <button
                                onClick={() => togglePermission(perm.key)}
                                disabled={selectedRole === 'Company Admin'}
                                className={`h-4.5 w-4.5 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
                                  checked
                                    ? 'bg-primary border-primary text-white'
                                    : 'border-muted-foreground/30 hover:border-primary'
                                } ${selectedRole === 'Company Admin' ? 'opacity-50' : ''}`}
                                style={{ minWidth: '18px', minHeight: '18px', width: '18px', height: '18px' }}
                              >
                                {checked && <Check size={11} strokeWidth={3} />}
                              </button>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm">{perm.label}</span>
                                <span className="text-[10px] text-muted-foreground ml-2 font-mono">{perm.key}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border bg-card p-6 shadow-sm text-center">
              <Shield size={32} className="mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">You don&apos;t have permission to manage roles and permissions.</p>
            </div>
          )}

          {/* Save bar */}
          {rolesDirty && canManageRoles && (
            <div className="sticky bottom-4 flex items-center justify-between p-4 rounded-xl border bg-card shadow-lg">
              <p className="text-sm font-medium">Unsaved changes for <span className="text-primary">{selectedRole}</span></p>
              <div className="flex gap-2">
                <button onClick={() => { setRolePerms(getRolePermissions()); setRolesDirty(false); }} className={btnSecondary}>Discard</button>
                <button onClick={handleSaveRoles} className={btnPrimary}><Save size={14} className="mr-2" /> Save Permissions</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════ PREFERENCES TAB ══════ */}
      {activeTab === 'Preferences' && (
        <div className="rounded-xl border bg-card p-6 shadow-sm space-y-6">
          <h3 className="font-bold">Appearance</h3>
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3">{darkMode ? <Moon size={20} /> : <Sun size={20} />}<div><p className="font-medium">Dark Mode</p><p className="text-xs text-muted-foreground">Toggle between light and dark theme</p></div></div>
            <button onClick={toggleDarkMode} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${darkMode ? 'bg-primary' : 'bg-muted'}`}><span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${darkMode ? 'translate-x-6' : 'translate-x-1'}`} /></button>
          </div>
        </div>
      )}

      {/* ══════ DATA TAB ══════ */}
      {activeTab === 'Data' && (
        <div className="rounded-xl border bg-card p-6 shadow-sm space-y-6">
          <h3 className="font-bold flex items-center gap-2 text-destructive"><AlertTriangle size={18} /> Danger Zone</h3>
          {canResetData ? (
            <div className="p-4 rounded-lg border border-destructive/20 bg-destructive/5">
              <p className="font-medium text-destructive">Reset All Data</p>
              <p className="text-sm text-muted-foreground mt-1">This will permanently delete all CRM data and restore factory defaults.</p>
              <button onClick={() => setConfirmAction({ type: 'resetData' })} className="mt-4 inline-flex items-center rounded-md text-sm font-medium bg-destructive text-white hover:bg-destructive/90 h-9 px-4 py-2"><Trash2 size={14} className="mr-2" /> Reset Everything</button>
            </div>
          ) : (
            <div className="p-4 rounded-lg border bg-muted/50">
              <p className="text-sm text-muted-foreground">You don&apos;t have permission to reset application data. Contact your Company Admin.</p>
            </div>
          )}
        </div>
      )}

      {/* ══════ USER MODAL ══════ */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold">{editingUser.id ? 'Edit User' : 'Add User'}</h2><button onClick={() => setShowUserModal(false)}><X size={20} /></button></div>
            <div className="space-y-4">
              <div className="space-y-2"><label className={labelCls}>Name *</label><input type="text" value={editingUser.name || ''} onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })} className={inputCls} /></div>
              <div className="space-y-2"><label className={labelCls}>Email *</label><input type="email" value={editingUser.email || ''} onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })} className={inputCls} /></div>
              <div className="space-y-2"><label className={labelCls}>Phone</label><input type="text" value={editingUser.phone || ''} onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })} className={inputCls} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><label className={labelCls}>Role</label><select value={editingUser.role} onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as Agent['role'] })} className={inputCls}><option>Company Admin</option><option>Hub Manager</option><option>Finance</option><option>Customer Success</option></select></div>
                <div className="space-y-2"><label className={labelCls}>Hub</label>
                  <select value={editingUser.location} onChange={(e) => setEditingUser({ ...editingUser, location: e.target.value })} className={inputCls}>
                    {activeHubs.map((h) => <option key={h.id} value={h.name}>{h.name}</option>)}
                  </select>
                </div>
              </div>
              {/* Role preview */}
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Role permissions preview</p>
                <div className="flex flex-wrap gap-1">
                  {PERMISSION_GROUPS.map((group) => {
                    const groupPerms = group.permissions.map((p) => p.key);
                    const roleKey = (editingUser.role || 'Hub Manager') as RoleName;
                    const rp = rolePerms[roleKey] || [];
                    const count = groupPerms.filter((k) => rp.includes(k as Permission)).length;
                    if (count === 0) return null;
                    return (
                      <span key={group.label} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${count === groupPerms.length ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        {group.label} {count}/{groupPerms.length}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowUserModal(false)} className={btnSecondary}>Cancel</button>
              <button onClick={handleSaveUser} className={btnPrimary}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ HUB MODAL ══════ */}
      {showHubModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">{editingHub.id ? 'Edit Hub' : 'Add New Hub'}</h2>
              <button onClick={() => setShowHubModal(false)} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className={labelCls}>Hub Name *</label>
                <input type="text" value={editingHub.name || ''} onChange={(e) => setEditingHub({ ...editingHub, name: e.target.value })} placeholder="e.g. Abuja" className={inputCls} />
              </div>
              <div className="space-y-2">
                <label className={labelCls}>Address</label>
                <input type="text" value={editingHub.address || ''} onChange={(e) => setEditingHub({ ...editingHub, address: e.target.value })} placeholder="Full address" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={labelCls}>Phone</label>
                  <input type="text" value={editingHub.phone || ''} onChange={(e) => setEditingHub({ ...editingHub, phone: e.target.value })} placeholder="Hub phone" className={inputCls} />
                </div>
                <div className="space-y-2">
                  <label className={labelCls}>Manager</label>
                  <input type="text" value={editingHub.managerName || ''} onChange={(e) => setEditingHub({ ...editingHub, managerName: e.target.value })} placeholder="Manager name" className={inputCls} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="hub-active" checked={editingHub.isActive !== false} onChange={(e) => setEditingHub({ ...editingHub, isActive: e.target.checked })} className="h-4 w-4 accent-primary" />
                <label htmlFor="hub-active" className="text-sm font-medium">Active</label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowHubModal(false)} className={btnSecondary}>Cancel</button>
              <button onClick={handleSaveHub} className={btnPrimary}>Save Hub</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ CONFIRM MODAL ══════ */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle size={24} className="text-destructive" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Are you sure?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {confirmAction.type === 'deleteUser'
                    ? 'This will permanently delete this user. This action cannot be undone.'
                    : confirmAction.type === 'deleteHub'
                    ? 'This will permanently delete this hub. Ensure no team members, inventory, or customers are assigned to it.'
                    : confirmAction.type === 'resetRoles'
                    ? 'This will reset all role permissions to their factory defaults. Any custom changes will be lost.'
                    : 'This will erase all CRM data and restore factory defaults. This action cannot be undone.'}
                </p>
              </div>
              <div className="flex gap-3 w-full">
                <button onClick={() => setConfirmAction(null)} className={`flex-1 justify-center ${btnSecondary}`}>Cancel</button>
                <button onClick={executeConfirmAction} className="flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium bg-destructive text-white hover:bg-destructive/90 h-9 px-4 py-2">Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

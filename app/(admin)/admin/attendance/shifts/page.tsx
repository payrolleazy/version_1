'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Loader from '@/components/ui/Loader';
import Modal from '@/components/Modal';
import { motion } from 'framer-motion';

// --- CONFIGURATION ---
const GATEWAY_URL = '/api/a_crud_universal_pg_function_gateway';
const READ_URL = '/api/a_crud_universal_read';

const CONFIGS = {
  READ_SHIFTS: '5961077b-526a-493f-b616-c33bf057899d',
  MANAGE_SHIFT: 'ams-manage-shifts'
};

// --- TYPES ---
interface Shift {
  id: string; // uuid
  name: string;
  start_time: string; // HH:mm:ss
  end_time: string; // HH:mm:ss
  break_duration_minutes: number;
  work_days: number[]; // [0,1,2...] where 0=Sun
  crosses_midnight: boolean;
  is_active: boolean;
}

const DAYS_OF_WEEK = [
  { id: 1, label: 'Mon' },
  { id: 2, label: 'Tue' },
  { id: 3, label: 'Wed' },
  { id: 4, label: 'Thu' },
  { id: 5, label: 'Fri' },
  { id: 6, label: 'Sat' },
  { id: 0, label: 'Sun' }
];

export default function ShiftManagementPage() {
  const { session, isLoading: sessionLoading } = useSessionContext();

  // --- STATE ---
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    start_time: '09:00',
    end_time: '18:00',
    break_duration_minutes: 60,
    work_days: [1, 2, 3, 4, 5], // Default Mon-Fri
    crosses_midnight: false,
    is_active: true
  });

  // --- FETCH SHIFTS ---
  const fetchShifts = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(READ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: CONFIGS.READ_SHIFTS,
          params: { 
            // Sort by name
            orderBy: [['name', 'ASC']],
            limit: 50 
          },
          accessToken: session.access_token
        })
      });

      const result = await res.json();
      if (!result.success) throw new Error(result.message || "Failed to fetch shifts");
      
      setShifts(result.data || []);

    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) fetchShifts();
  }, [session, fetchShifts]);


  // --- FORM HANDLERS ---
  const handleOpenModal = (shift?: Shift) => {
    if (shift) {
      setEditingShift(shift);
      setFormData({
        name: shift.name,
        start_time: shift.start_time.slice(0, 5), // Trim seconds if present
        end_time: shift.end_time.slice(0, 5),
        break_duration_minutes: shift.break_duration_minutes,
        work_days: shift.work_days,
        crosses_midnight: shift.crosses_midnight,
        is_active: shift.is_active
      });
    } else {
      setEditingShift(null);
      // Reset form
      setFormData({
        name: '',
        start_time: '09:00',
        end_time: '18:00',
        break_duration_minutes: 60,
        work_days: [1, 2, 3, 4, 5],
        crosses_midnight: false,
        is_active: true
      });
    }
    setIsModalOpen(true);
  };

  const handleDayToggle = (dayId: number) => {
    setFormData(prev => {
      const currentDays = prev.work_days;
      if (currentDays.includes(dayId)) {
        return { ...prev, work_days: currentDays.filter(d => d !== dayId) };
      } else {
        return { ...prev, work_days: [...currentDays, dayId].sort() };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    
    try {
      const payload = {
        tenant_id: session!.user.user_metadata.tenant_id,
        shift_id: editingShift?.id || null, // null = CREATE, id = UPDATE
        name: formData.name,
        start_time: formData.start_time,
        end_time: formData.end_time,
        break_duration_minutes: formData.break_duration_minutes,
        work_days: formData.work_days,
        crosses_midnight: formData.crosses_midnight,
        is_active: formData.is_active
      };

      const res = await fetch(GATEWAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: CONFIGS.MANAGE_SHIFT,
          params: { p_params: payload }, // RPC wrapper usually expects p_params jsonb
          accessToken: session!.access_token
        })
      });

      const result = await res.json();
      const responseData = result.data || result;

      if (!result.success && !responseData.success) {
        throw new Error(responseData.message || "Operation failed");
      }

      // Success
      setIsModalOpen(false);
      fetchShifts();

    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setFormLoading(false);
    }
  };


  // --- RENDER ---
  if (sessionLoading) return <div className="p-8 flex justify-center"><Loader /></div>;

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Shift Management</h1>
          <p className="text-gray-500 text-sm">Configure work timings and schedules</p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          + Add New Shift
        </Button>
      </div>

      {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-6">{error}</div>}

      {/* Shifts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {shifts.map(shift => (
          <motion.div 
            key={shift.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden ${!shift.is_active ? 'opacity-75 grayscale' : ''}`}
          >
             <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-lg text-gray-900">{shift.name}</h3>
                <span className={`px-2 py-1 text-xs rounded-full ${shift.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                  {shift.is_active ? 'Active' : 'Inactive'}
                </span>
             </div>

             <div className="space-y-2 text-sm text-gray-600 mb-6">
                <div className="flex justify-between">
                   <span>Timings:</span>
                   <span className="font-medium text-gray-900">{shift.start_time.slice(0,5)} - {shift.end_time.slice(0,5)}</span>
                </div>
                <div className="flex justify-between">
                   <span>Break:</span>
                   <span>{shift.break_duration_minutes} mins</span>
                </div>
                {shift.crosses_midnight && (
                   <div className="flex items-center text-purple-600 bg-purple-50 px-2 py-1 rounded w-fit">
                     <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                     Crosses Midnight
                   </div>
                )}
             </div>

             {/* Days Indicators */}
             <div className="flex gap-1 mb-6">
                {[1,2,3,4,5,6,0].map(d => (
                  <div key={d} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${shift.work_days.includes(d) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                    {DAYS_OF_WEEK.find(day => day.id === d)?.label.charAt(0)}
                  </div>
                ))}
             </div>

             <Button variant="secondary" className="w-full" onClick={() => handleOpenModal(shift)}>
               Edit Configuration
             </Button>
          </motion.div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <Modal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          title={editingShift ? 'Edit Shift' : 'Create New Shift'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">Shift Name</label>
               <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="e.g. General Shift" />
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <Input type="time" value={formData.start_time} onChange={e => setFormData({...formData, start_time: e.target.value})} required />
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <Input type="time" value={formData.end_time} onChange={e => setFormData({...formData, end_time: e.target.value})} required />
               </div>
            </div>

            <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">Break Duration (Minutes)</label>
               <Input type="number" value={formData.break_duration_minutes} onChange={e => setFormData({...formData, break_duration_minutes: parseInt(e.target.value)})} />
            </div>

            <div>
               <label className="block text-sm font-medium text-gray-700 mb-2">Working Days</label>
               <div className="flex flex-wrap gap-2">
                 {DAYS_OF_WEEK.map(day => (
                   <button
                     key={day.id}
                     type="button"
                     onClick={() => handleDayToggle(day.id)}
                     className={`px-3 py-1.5 text-sm rounded-md border transition-all ${
                       formData.work_days.includes(day.id)
                         ? 'bg-blue-600 text-white border-blue-600'
                         : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                     }`}
                   >
                     {day.label}
                   </button>
                 ))}
               </div>
            </div>

            <div className="flex items-center gap-2 mt-2">
               <input 
                 type="checkbox" 
                 id="midnight" 
                 checked={formData.crosses_midnight} 
                 onChange={e => setFormData({...formData, crosses_midnight: e.target.checked})} 
                 className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
               />
               <label htmlFor="midnight" className="text-sm text-gray-700">Shift crosses midnight (ends next day)</label>
            </div>

            <div className="flex items-center gap-2">
               <input 
                 type="checkbox" 
                 id="active" 
                 checked={formData.is_active} 
                 onChange={e => setFormData({...formData, is_active: e.target.checked})} 
                 className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
               />
               <label htmlFor="active" className="text-sm text-gray-700">Shift is Active</label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t mt-4">
               <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
               <Button type="submit" isLoading={formLoading}>Save Shift</Button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
}
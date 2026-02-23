import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  Clock, 
  LogIn, 
  LogOut, 
  Activity, 
  Search,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  UserCheck,
  UserMinus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Employee {
  id: number;
  name: string;
  department: string;
  role: string;
  current_status: 'IN' | 'OUT' | null;
  last_event: string | null;
}

interface Log {
  id: number;
  employee_id: number;
  employee_name: string;
  department: string;
  type: 'IN' | 'OUT';
  timestamp: string;
}

export default function App() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    fetchData();
    connectWebSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  const fetchData = async () => {
    try {
      const [empRes, logRes] = await Promise.all([
        fetch('/api/status'),
        fetch('/api/logs')
      ]);
      const empData = await empRes.json();
      const logData = await logRes.json();
      setEmployees(empData);
      setLogs(logData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const connectWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'NEW_LOG') {
        const newLog = message.data;
        setLogs(prev => [newLog, ...prev].slice(0, 50));
        
        // Update employee status in the list
        setEmployees(prev => prev.map(emp => {
          if (emp.id === newLog.employee_id) {
            return {
              ...emp,
              current_status: newLog.type,
              last_event: newLog.timestamp
            };
          }
          return emp;
        }));
      }
    };

    socket.onclose = () => {
      console.log('WebSocket disconnected. Reconnecting...');
      setTimeout(connectWebSocket, 3000);
    };

    socketRef.current = socket;
  };

  const handleCheck = async (employeeId: number, type: 'IN' | 'OUT') => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, type })
      });
      if (response.ok) {
        setSelectedEmployee(null);
      }
    } catch (error) {
      console.error('Error checking in/out:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: employees.length,
    present: employees.filter(e => e.current_status === 'IN').length,
    away: employees.filter(e => e.current_status === 'OUT' || !e.current_status).length
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl">
              <Clock className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">ระบบบันทึกเวลาเข้า-ออก</h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Real-time Attendance Tracker</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-slate-600">Live Updates</span>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold">{new Date().toLocaleDateString('th-TH', { dateStyle: 'long' })}</p>
              <p className="text-xs text-slate-500">{new Date().toLocaleTimeString('th-TH', { timeStyle: 'short' })}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="bg-blue-50 p-2 rounded-lg">
                <Users className="text-blue-600 w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase">Total Employees</span>
            </div>
            <p className="text-3xl font-bold">{stats.total}</p>
            <p className="text-sm text-slate-500 mt-1">พนักงานทั้งหมดในระบบ</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="bg-emerald-50 p-2 rounded-lg">
                <UserCheck className="text-emerald-600 w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase">Present</span>
            </div>
            <p className="text-3xl font-bold text-emerald-600">{stats.present}</p>
            <p className="text-sm text-slate-500 mt-1">พนักงานที่กำลังปฏิบัติงาน</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="bg-amber-50 p-2 rounded-lg">
                <UserMinus className="text-amber-600 w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase">Away</span>
            </div>
            <p className="text-3xl font-bold text-amber-600">{stats.away}</p>
            <p className="text-sm text-slate-500 mt-1">พนักงานที่ออกไปแล้ว/ยังไม่เข้า</p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Employee List & Action */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  รายชื่อพนักงาน
                </h2>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input 
                    type="text" 
                    placeholder="ค้นหาชื่อหรือแผนก..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">พนักงาน</th>
                      <th className="px-6 py-4">แผนก / ตำแหน่ง</th>
                      <th className="px-6 py-4">สถานะปัจจุบัน</th>
                      <th className="px-6 py-4 text-right">ดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEmployees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                              {emp.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{emp.name}</p>
                              <p className="text-xs text-slate-500">ID: #{emp.id.toString().padStart(4, '0')}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium">{emp.department}</p>
                          <p className="text-xs text-slate-500">{emp.role}</p>
                        </td>
                        <td className="px-6 py-4">
                          {emp.current_status === 'IN' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">
                              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                              กำลังทำงาน
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
                              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
                              ไม่อยู่
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => setSelectedEmployee(emp)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-600" />
                  กิจกรรมล่าสุด
                </h2>
                <div className="px-2 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded uppercase tracking-wider">
                  Live
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                <AnimatePresence initial={false}>
                  {logs.map((log) => (
                    <motion.div 
                      key={log.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex gap-4 relative"
                    >
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${
                          log.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {log.type === 'IN' ? <LogIn className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                        </div>
                        <div className="w-px h-full bg-slate-100 absolute top-8"></div>
                      </div>
                      <div className="pb-4">
                        <p className="text-sm font-bold">
                          {log.employee_name}
                          <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded ${
                            log.type === 'IN' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                          }`}>
                            {log.type === 'IN' ? 'เข้างาน' : 'ออกงาน'}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{log.department}</p>
                        <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(log.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Action Modal */}
      <AnimatePresence>
        {selectedEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedEmployee(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex flex-col items-center text-center mb-8">
                  <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-2xl mb-4">
                    {selectedEmployee.name.charAt(0)}
                  </div>
                  <h3 className="text-xl font-bold">{selectedEmployee.name}</h3>
                  <p className="text-slate-500">{selectedEmployee.role} • {selectedEmployee.department}</p>
                  
                  <div className="mt-4 px-4 py-2 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-xs text-slate-400 uppercase font-bold tracking-widest mb-1">Current Status</p>
                    <p className={`text-sm font-bold ${selectedEmployee.current_status === 'IN' ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {selectedEmployee.current_status === 'IN' ? 'กำลังปฏิบัติงาน' : 'ไม่อยู่ในระบบ'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    disabled={selectedEmployee.current_status === 'IN' || isProcessing}
                    onClick={() => handleCheck(selectedEmployee.id, 'IN')}
                    className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition-all ${
                      selectedEmployee.current_status === 'IN' 
                        ? 'bg-slate-50 border-slate-100 opacity-50 cursor-not-allowed' 
                        : 'bg-emerald-50 border-emerald-100 hover:border-emerald-500 text-emerald-700'
                    }`}
                  >
                    <LogIn className="w-8 h-8" />
                    <span className="font-bold">เข้างาน</span>
                  </button>

                  <button
                    disabled={selectedEmployee.current_status === 'OUT' || !selectedEmployee.current_status || isProcessing}
                    onClick={() => handleCheck(selectedEmployee.id, 'OUT')}
                    className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition-all ${
                      selectedEmployee.current_status === 'OUT' || !selectedEmployee.current_status
                        ? 'bg-slate-50 border-slate-100 opacity-50 cursor-not-allowed' 
                        : 'bg-amber-50 border-amber-100 hover:border-amber-500 text-amber-700'
                    }`}
                  >
                    <LogOut className="w-8 h-8" />
                    <span className="font-bold">ออกงาน</span>
                  </button>
                </div>

                <button 
                  onClick={() => setSelectedEmployee(null)}
                  className="w-full mt-6 py-3 text-slate-500 font-medium hover:text-slate-800 transition-colors"
                >
                  ยกเลิก
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E2E8F0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #CBD5E1;
        }
      `}</style>
    </div>
  );
}

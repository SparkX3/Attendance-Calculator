"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { db, auth } from "@/firebase/config";
import { collection, getDocs, doc, setDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { LogOut, Calendar, CheckCircle2, XCircle, Clock, User as UserIcon, MapPin, Target, AlertCircle, Settings, Award, Undo2, ChevronDown, CheckSquare } from "lucide-react";
import { signOut } from "firebase/auth";
import Link from "next/link";

const DAYS_MAP = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const REASONS = ["Medical Leave", "Event Leave", "College Duty", "Other"];

interface Lecture {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  lectureName: string;
  facultyName: string;
  roomNumber: string;
}

interface AttendanceRecord {
  id: string;
  lectureId: string;
  subjectName: string;
  selectedDate: string;
  status: "Present" | "Absent" | "Granted" | "Not Marked";
  grantedReason?: string;
  grantedId?: string;
}

export default function Dashboard() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const [timetable, setTimetable] = useState<Lecture[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);
  const [targetAttendance, setTargetAttendance] = useState(75);
  const [fetching, setFetching] = useState(true);

  // Default to today's date
  const todayStr = new Date().toLocaleDateString('en-CA');
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);

  // Granted Modal State
  const [isGrantedModalOpen, setIsGrantedModalOpen] = useState(false);
  const [grantReason, setGrantReason] = useState(REASONS[0]);
  const [grantNote, setGrantNote] = useState("");
  const [grantStartDate, setGrantStartDate] = useState(todayStr);
  const [grantEndDate, setGrantEndDate] = useState(todayStr);
  const [grantApplyToAll, setGrantApplyToAll] = useState(true);
  const [grantSpecificLectures, setGrantSpecificLectures] = useState<string[]>([]);
  const [isGranting, setIsGranting] = useState(false);

  useEffect(() => {
    if (!user && !loading) {
      router.push("/login");
      return;
    }
    if (user) {
      fetchData();
    }
  }, [user, loading, router]);

  const fetchData = async () => {
    if (!user) return;
    setFetching(true);
    try {
      const ttSnapshot = await getDocs(collection(db, `users/${user.uid}/timetable`));
      const ttData: Lecture[] = ttSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lecture));
      setTimetable(ttData);

      const attSnapshot = await getDocs(collection(db, `users/${user.uid}/attendance`));
      const attData: AttendanceRecord[] = attSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
      setAttendance(attData);

    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setFetching(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const markAttendance = async (status: "Present" | "Absent" | "Granted", overrideDate?: string, lectureParam?: Lecture, customReason?: string, grantId?: string) => {
    if (!user) return;
    const targetLecture = lectureParam || selectedLecture;
    if (!targetLecture) return;
    
    const targetDate = overrideDate || selectedDateStr;
    const recordId = `${targetLecture.id}_${targetDate}`;
    const docRef = doc(db, `users/${user.uid}/attendance`, recordId);
    
    const dateObj = new Date(targetDate);
    const dayName = DAYS_MAP[dateObj.getDay()];

    const payload: any = {
      lectureId: targetLecture.id,
      subjectName: targetLecture.lectureName,
      selectedDate: targetDate,
      day: dayName,
      startTime: targetLecture.startTime || "00:00",
      endTime: targetLecture.endTime || "00:00",
      status,
      updatedAt: serverTimestamp(),
    };

    if (status === "Granted" && customReason) {
      payload.grantedReason = customReason;
      if (grantId) payload.grantedId = grantId;
    } else if (status === "Absent" || status === "Present") {
      // Clear granted info if reverting manually to present/absent
      payload.grantedReason = null;
      payload.grantedId = null;
    }

    try {
      // Use setDoc with merge to preserve createdAt if it exists
      await setDoc(docRef, payload, { merge: true });

      setAttendance(prev => {
        const filtered = prev.filter(r => r.id !== recordId);
        return [...filtered, { 
          id: recordId, 
          ...payload
        } as AttendanceRecord];
      });
    } catch (err) {
      console.error("Error marking attendance:", err);
      throw err;
    }
  };

  const handleGrantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsGranting(true);

    try {
      // 1. Create master grant record
      const grantRef = doc(collection(db, `users/${user.uid}/grantedAttendance`));
      const grantId = grantRef.id;
      
      const startDateObj = new Date(grantStartDate);
      const endDateObj = new Date(grantEndDate);
      const datesInRange: string[] = [];
      
      // Generate all dates in range
      let currentDate = new Date(startDateObj);
      while (currentDate <= endDateObj) {
        datesInRange.push(currentDate.toLocaleDateString('en-CA'));
        currentDate.setDate(currentDate.getDate() + 1);
      }

      await setDoc(grantRef, {
        reasonType: grantReason,
        selectedDates: datesInRange,
        lectureIds: grantApplyToAll ? null : grantSpecificLectures,
        note: grantNote,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 2. Iterate and update only "Absent" records
      for (const d of datesInRange) {
        const dObj = new Date(d);
        const dayName = DAYS_MAP[dObj.getDay()];
        
        const dayLectures = timetable.filter(l => l.day === dayName);
        for (const lec of dayLectures) {
          // If specific lectures chosen, skip if not in list
          if (!grantApplyToAll && !grantSpecificLectures.includes(lec.id)) continue;

          // Find existing record
          const existingRecord = attendance.find(r => r.lectureId === lec.id && r.selectedDate === d);
          
          // Only apply if it's explicitly "Absent"
          if (existingRecord && existingRecord.status === "Absent") {
            await markAttendance("Granted", d, lec, grantReason, grantId);
          }
        }
      }

      setIsGrantedModalOpen(false);
      // Reset form
      setGrantNote("");
      setGrantSpecificLectures([]);
      setGrantApplyToAll(true);
      
      alert("Granted Attendance applied successfully to eligible Absent records!");

    } catch (err) {
      console.error("Error granting attendance:", err);
      alert("Failed to grant attendance. Please try again.");
    }
    
    setIsGranting(false);
  };

  // --- Calculations ---

  const getSubjectStats = (subjectName: string) => {
    const records = attendance.filter(r => r.subjectName === subjectName);
    const present = records.filter(r => r.status === "Present").length;
    const absent = records.filter(r => r.status === "Absent").length;
    const granted = records.filter(r => r.status === "Granted").length;
    
    const totalConducted = present + absent + granted;
    const totalAttended = present + granted; // Granted counts as attended
    
    const percentage = totalConducted === 0 ? 0 : Math.round((totalAttended / totalConducted) * 100);

    let safeBunks = 0;
    let needed = 0;

    if (totalConducted > 0) {
      const possibleBunks = Math.floor((totalAttended * 100 / targetAttendance) - totalConducted);
      safeBunks = possibleBunks > 0 ? possibleBunks : 0;
      if (percentage < targetAttendance) {
        needed = Math.ceil((targetAttendance * totalConducted - 100 * totalAttended) / (100 - targetAttendance));
      }
    }

    return { total: totalConducted, present, absent, granted, percentage, safeBunks, needed };
  };

  const getOverallStats = () => {
    const present = attendance.filter(r => r.status === "Present").length;
    const absent = attendance.filter(r => r.status === "Absent").length;
    const granted = attendance.filter(r => r.status === "Granted").length;
    
    const totalConducted = present + absent + granted;
    const totalAttended = present + granted;
    
    const percentage = totalConducted === 0 ? 0 : Math.round((totalAttended / totalConducted) * 100);
    return { percentage, totalConducted, present, absent, granted };
  };

  const getLowAttendanceSubjects = () => {
    const uniqueSubjects = Array.from(new Set(timetable.map(l => l.lectureName)));
    const lowSubjects: {name: string, percentage: number}[] = [];
    
    uniqueSubjects.forEach(sub => {
      const stats = getSubjectStats(sub);
      if (stats.total > 0 && stats.percentage < targetAttendance) {
        lowSubjects.push({ name: sub, percentage: stats.percentage });
      }
    });
    
    return lowSubjects.sort((a, b) => a.percentage - b.percentage);
  };

  const getStatusForSelectedDate = (lectureId: string) => {
    const record = attendance.find(r => r.lectureId === lectureId && r.selectedDate === selectedDateStr);
    return record ? record.status : "Not marked";
  };

  if (fetching || loading) {
    return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div></div>;
  }

  const selectedStats = selectedLecture ? getSubjectStats(selectedLecture.lectureName) : null;
  
  const [y, m, d_val] = selectedDateStr.split('-').map(Number);
  const selectedDateObj = new Date(y, m - 1, d_val);
  const selectedDayName = DAYS_MAP[selectedDateObj.getDay()];

  const dayLectures = timetable
    .filter(l => l.day === selectedDayName)
    .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));

  const overallStats = getOverallStats();
  const lowSubjects = getLowAttendanceSubjects();
  const circleOffset = 251.2 - (251.2 * overallStats.percentage) / 100; // 2 * pi * r (r=40)

  // Unique lectures for the specific lectures checkbox in Granted modal
  const uniqueTimetableLectures = Array.from(new Set(timetable.map(l => l.id))).map(id => timetable.find(t => t.id === id)!);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 flex-col md:flex-row relative">
      
      {/* Main Area */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Header */}
        <header className="bg-white shadow-sm px-4 sm:px-6 py-4 flex justify-between items-center z-10 sticky top-0">
          <div className="flex items-center gap-3">
            <Link href="/profile" className="p-2 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 transition-colors" title="Profile Settings">
              <Settings className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900 hidden sm:block">Dashboard</h1>
          </div>

          <div className="flex items-center justify-center flex-1 sm:flex-none mx-4 gap-2">
            <div className="relative group">
              <input 
                type="date" 
                value={selectedDateStr}
                onChange={(e) => {
                  setSelectedDateStr(e.target.value);
                  setSelectedLecture(null);
                }}
                className="pl-10 pr-4 py-2 border-2 border-indigo-100 rounded-lg text-indigo-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-indigo-50/50 hover:bg-indigo-50 cursor-pointer transition-colors"
              />
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-500 pointer-events-none" />
            </div>
            
            <button 
              onClick={() => setIsGrantedModalOpen(true)}
              className="bg-purple-100 hover:bg-purple-200 text-purple-700 p-2 rounded-lg font-semibold transition-colors flex items-center gap-2 border border-purple-200"
              title="Grant Attendance"
            >
              <Award className="w-5 h-5" />
              <span className="hidden sm:block text-sm">Grant Leave</span>
            </button>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-600 hidden md:block">Hi, {profile?.fullName?.split(' ')[0] || 'Student'}</span>
            <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-red-600 transition-colors rounded-full hover:bg-gray-100" title="Logout">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-4xl mx-auto w-full flex flex-col gap-8">
          
          {/* Top Analytics Summary Section */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Overall Attendance Circle */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                 <Target className="w-32 h-32" />
              </div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Your Overall Attendance</h3>
              <div className="relative w-32 h-32">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle className="text-gray-100 stroke-current" strokeWidth="8" cx="50" cy="50" r="40" fill="transparent"></circle>
                  <circle 
                    className={`${overallStats.percentage >= targetAttendance ? 'text-green-500' : 'text-red-500'} stroke-current transition-all duration-1000 ease-out`} 
                    strokeWidth="8" 
                    strokeLinecap="round" 
                    cx="50" cy="50" r="40" fill="transparent" 
                    strokeDasharray="251.2" 
                    strokeDashoffset={circleOffset}
                  ></circle>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-3xl font-black ${overallStats.percentage >= targetAttendance ? 'text-green-600' : 'text-red-600'}`}>
                    {overallStats.percentage}%
                  </span>
                </div>
              </div>
              <div className="mt-4 flex gap-4 text-xs font-medium text-gray-500">
                <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500"/> {overallStats.present} P</span>
                <span className="flex items-center gap-1"><Award className="w-3 h-3 text-purple-500"/> {overallStats.granted} G</span>
                <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-500"/> {overallStats.absent} A</span>
              </div>
            </div>

            {/* Low Attendance Warning */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col h-full">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-400" /> Action Required
              </h3>
              
              {lowSubjects.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                  <p className="font-semibold text-gray-900">All Good!</p>
                  <p className="text-sm text-gray-500 mt-1">All your subjects are above {targetAttendance}%.</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                  {lowSubjects.map((sub, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-orange-50 border border-orange-100">
                      <div className="truncate pr-4 font-semibold text-orange-900 text-sm">
                        {sub.name}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold text-orange-700 text-sm">{sub.percentage}%</span>
                        <span className="text-[10px] uppercase font-bold bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full">Below {targetAttendance}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
          </section>

          {/* Timetable List */}
          <section className="flex flex-col space-y-6 pb-20">
            <div className="text-center sm:text-left border-b border-gray-200 pb-4">
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedDateStr === todayStr ? "Today's Schedule" : "Scheduled Classes"}
              </h2>
              <p className="text-gray-500 font-medium mt-1">{selectedDayName}, {new Date(selectedDateObj).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric'})}</p>
            </div>

            {timetable.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center shadow-sm">
                <p className="text-gray-500 mb-4">No timetable found.</p>
                <button onClick={() => router.push("/upload")} className="bg-indigo-600 text-white px-6 py-2 rounded-md font-medium">Setup Timetable</button>
              </div>
            ) : dayLectures.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center shadow-sm">
                <p className="text-gray-500">No classes scheduled for this day. Enjoy your day off! 🎉</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {dayLectures.map(lecture => {
                  const status = getStatusForSelectedDate(lecture.id);
                  const isSelected = selectedLecture?.id === lecture.id;
                  const timeRange = `${lecture.startTime || ""} - ${lecture.endTime || ""}`;
                  
                  return (
                    <div 
                      key={lecture.id}
                      onClick={() => setSelectedLecture(lecture)}
                      className={`p-5 rounded-2xl cursor-pointer transition-all border-2 relative
                        ${isSelected ? 'border-indigo-500 shadow-md transform scale-[1.01]' : 'border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-200 bg-white'}
                      `}
                    >
                      <div className={`absolute top-0 left-0 w-1.5 h-full rounded-l-2xl ${isSelected ? 'bg-indigo-500' : 'bg-transparent'}`}></div>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold text-indigo-600 mb-1 flex items-center gap-1.5">
                            <Clock className="w-4 h-4" /> {timeRange}
                          </div>
                          <h4 className="text-lg font-bold text-gray-900 leading-tight mb-1">
                            {lecture.lectureName}
                          </h4>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            {lecture.facultyName && (
                              <span className="flex items-center gap-1"><UserIcon className="w-3 h-3" /> {lecture.facultyName}</span>
                            )}
                            {lecture.roomNumber && (
                              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {lecture.roomNumber}</span>
                            )}
                          </div>
                        </div>

                        <div className={`shrink-0 inline-flex items-center justify-center gap-1.5 font-bold px-4 py-2 rounded-full border
                          ${status === 'Present' ? 'bg-green-50 text-green-700 border-green-200' : 
                            status === 'Absent' ? 'bg-red-50 text-red-700 border-red-200' : 
                            status === 'Granted' ? 'bg-purple-50 text-purple-700 border-purple-200 shadow-inner' :
                            'bg-gray-50 text-gray-600 border-gray-200'}
                        `}>
                          {status === 'Present' && <CheckCircle2 className="w-4 h-4" />}
                          {status === 'Absent' && <XCircle className="w-4 h-4" />}
                          {status === 'Granted' && <Award className="w-4 h-4" />}
                          {status === 'Not marked' && <div className="w-2 h-2 rounded-full bg-gray-400"></div>}
                          {status}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </main>
      </div>

      {/* Side Panel for Details */}
      {selectedLecture && selectedStats && (
        <aside className="w-full md:w-[400px] bg-white border-l border-gray-200 shadow-xl flex flex-col transform transition-transform duration-300 z-20 sticky top-0 h-screen md:h-auto overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1 pr-4">{selectedLecture.lectureName}</h2>
              <div className="flex items-center text-sm text-gray-500 font-medium gap-3">
                <span className="flex items-center gap-1"><Calendar className="w-4 h-4"/> {selectedDayName}</span>
                <span className="flex items-center gap-1"><Clock className="w-4 h-4"/> {selectedLecture.startTime} - {selectedLecture.endTime}</span>
              </div>
            </div>
            <button onClick={() => setSelectedLecture(null)} className="text-gray-400 hover:text-gray-600 p-1 bg-white rounded-full shadow-sm md:hidden">
               <XCircle className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 flex-1 overflow-y-auto">
            {/* Quick Actions */}
            <div className="space-y-3 mb-8">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Mark Attendance for {selectedDateStr}</h3>
              
              {getStatusForSelectedDate(selectedLecture.id) === 'Granted' ? (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center space-y-3">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 text-purple-600 rounded-full mb-1">
                     <Award className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-purple-900">Granted Attendance</h4>
                  <p className="text-xs text-purple-700 font-medium">Reason: {attendance.find(r => r.lectureId === selectedLecture.id && r.selectedDate === selectedDateStr)?.grantedReason || "Approved Leave"}</p>
                  
                  <button 
                    onClick={() => markAttendance("Absent")}
                    className="mt-2 w-full flex items-center justify-center gap-2 py-2 px-4 bg-white border border-purple-200 rounded-lg text-purple-700 font-semibold hover:bg-purple-100 transition-colors"
                  >
                    <Undo2 className="w-4 h-4" /> Undo Granted
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => markAttendance("Present")}
                    className={`flex items-center justify-center gap-2 font-semibold py-3 px-4 rounded-xl transition-all
                      ${getStatusForSelectedDate(selectedLecture.id) === 'Present' 
                        ? 'bg-green-600 text-white shadow-md shadow-green-200' 
                        : 'bg-green-50 hover:bg-green-100 text-green-700 border border-green-200'}`}
                  >
                    <CheckCircle2 className="w-5 h-5" /> Present
                  </button>
                  <button 
                    onClick={() => markAttendance("Absent")}
                    className={`flex items-center justify-center gap-2 font-semibold py-3 px-4 rounded-xl transition-all
                      ${getStatusForSelectedDate(selectedLecture.id) === 'Absent' 
                        ? 'bg-red-600 text-white shadow-md shadow-red-200' 
                        : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'}`}
                  >
                    <XCircle className="w-5 h-5" /> Absent
                  </button>
                </div>
              )}
            </div>

            {/* Lecture Info */}
            <div className="space-y-4 mb-8">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Details</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-100">
                {selectedLecture.facultyName && (
                  <div className="flex items-center gap-3 text-gray-700">
                    <UserIcon className="w-5 h-5 text-gray-400" />
                    <span className="text-sm">{selectedLecture.facultyName}</span>
                  </div>
                )}
                {selectedLecture.roomNumber && (
                  <div className="flex items-center gap-3 text-gray-700">
                    <MapPin className="w-5 h-5 text-gray-400" />
                    <span className="text-sm">Room {selectedLecture.roomNumber}</span>
                  </div>
                )}
                {!selectedLecture.facultyName && !selectedLecture.roomNumber && (
                   <span className="text-sm text-gray-400 italic">No extra details provided.</span>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Subject Stats</h3>
                <div className="flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full font-medium">
                   <Target className="w-3 h-3" /> Target {targetAttendance}%
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-5 flex items-center justify-between border-b border-gray-100">
                  <div>
                    <p className="text-4xl font-black tracking-tight" style={{ color: selectedStats.percentage >= targetAttendance ? '#10b981' : '#ef4444' }}>
                      {selectedStats.percentage}%
                    </p>
                    <p className="text-xs font-medium text-gray-500 mt-1 uppercase tracking-wide">Overall Score</p>
                  </div>
                  <div className="h-16 w-16 relative flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path className="text-gray-100" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path className="transition-all duration-500" strokeWidth="3" strokeDasharray={`${selectedStats.percentage}, 100`} stroke={selectedStats.percentage >= targetAttendance ? '#10b981' : '#ef4444'} fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 divide-x divide-gray-100 bg-gray-50">
                  <div className="p-3 text-center">
                    <p className="text-xl font-bold text-gray-900">{selectedStats.present}</p>
                    <p className="text-[10px] font-bold text-gray-500 mt-1 uppercase tracking-wider">Present</p>
                  </div>
                  <div className="p-3 text-center">
                    <p className="text-xl font-bold text-gray-900">{selectedStats.granted}</p>
                    <p className="text-[10px] font-bold text-gray-500 mt-1 uppercase tracking-wider">Granted</p>
                  </div>
                  <div className="p-3 text-center">
                    <p className="text-xl font-bold text-gray-900">{selectedStats.absent}</p>
                    <p className="text-[10px] font-bold text-gray-500 mt-1 uppercase tracking-wider">Absent</p>
                  </div>
                </div>
              </div>

              {/* Smart Insights */}
              <div className="mt-4 pb-6">
                {selectedStats.total === 0 ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600 text-center">
                    Start tracking your attendance for insights.
                  </div>
                ) : selectedStats.safeBunks > 0 ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-green-800">You are in the safe zone!</p>
                      <p className="text-sm text-green-700 mt-1">You can afford to bunk <span className="font-bold underline">{selectedStats.safeBunks}</span> more class{selectedStats.safeBunks > 1 ? 'es' : ''}.</p>
                    </div>
                  </div>
                ) : selectedStats.needed > 0 ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-red-800">Attendance Alert</p>
                      <p className="text-sm text-red-700 mt-1">You must attend the next <span className="font-bold underline">{selectedStats.needed}</span> class{selectedStats.needed > 1 ? 'es' : ''} to reach {targetAttendance}%.</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 text-center font-bold">
                    You are exactly on track!
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Granted Attendance Modal Overlay */}
      {isGrantedModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-purple-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 text-purple-600 rounded-full">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-purple-900">Request Granted Leave</h2>
                  <p className="text-xs font-medium text-purple-700">Applies to existing "Absent" records</p>
                </div>
              </div>
              <button onClick={() => setIsGrantedModalOpen(false)} className="text-purple-400 hover:text-purple-700 bg-white rounded-full p-1 shadow-sm">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleGrantSubmit} className="p-6 overflow-y-auto flex-1 space-y-6">
              
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Reason Type</label>
                <div className="relative">
                  <select 
                    className="w-full appearance-none bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-purple-500 focus:border-purple-500 block p-3 font-medium"
                    value={grantReason}
                    onChange={(e) => setGrantReason(e.target.value)}
                    required
                  >
                    {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Start Date</label>
                  <input 
                    type="date" 
                    value={grantStartDate}
                    onChange={(e) => {
                      setGrantStartDate(e.target.value);
                      if (e.target.value > grantEndDate) setGrantEndDate(e.target.value);
                    }}
                    required
                    className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-purple-500 focus:border-purple-500 block p-3 font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">End Date</label>
                  <input 
                    type="date" 
                    value={grantEndDate}
                    min={grantStartDate}
                    onChange={(e) => setGrantEndDate(e.target.value)}
                    required
                    className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-purple-500 focus:border-purple-500 block p-3 font-medium"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-gray-700">Lecture Selection</label>
                
                <label className="flex items-center gap-3 p-3 border border-purple-200 bg-purple-50/50 rounded-xl cursor-pointer hover:bg-purple-50 transition-colors">
                  <input 
                    type="radio" 
                    checked={grantApplyToAll} 
                    onChange={() => setGrantApplyToAll(true)}
                    className="w-5 h-5 text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <p className="font-bold text-gray-900">All Scheduled Lectures</p>
                    <p className="text-xs text-gray-500">Apply to all subjects marked absent on selected dates.</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                  <input 
                    type="radio" 
                    checked={!grantApplyToAll} 
                    onChange={() => setGrantApplyToAll(false)}
                    className="w-5 h-5 text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <p className="font-bold text-gray-900">Specific Subjects Only</p>
                    <p className="text-xs text-gray-500">Choose which subjects to grant attendance for.</p>
                  </div>
                </label>

                {!grantApplyToAll && (
                  <div className="mt-4 p-4 border border-gray-200 rounded-xl bg-gray-50 max-h-48 overflow-y-auto space-y-2">
                    {uniqueTimetableLectures.map(lec => (
                      <label key={lec.id} className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={grantSpecificLectures.includes(lec.id)}
                          onChange={(e) => {
                            if (e.target.checked) setGrantSpecificLectures([...grantSpecificLectures, lec.id]);
                            else setGrantSpecificLectures(grantSpecificLectures.filter(id => id !== lec.id));
                          }}
                          className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                        />
                        <span className="font-semibold text-sm text-gray-800">{lec.lectureName} ({lec.day})</span>
                      </label>
                    ))}
                    {uniqueTimetableLectures.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-2">No timetable setup yet.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Optional Note</label>
                <textarea 
                  value={grantNote}
                  onChange={(e) => setGrantNote(e.target.value)}
                  placeholder="e.g., Medical certificate attached in college portal"
                  className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-purple-500 focus:border-purple-500 block p-3 font-medium text-sm resize-none"
                  rows={2}
                />
              </div>

            </form>

            <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-4">
              <button 
                type="button" 
                onClick={() => setIsGrantedModalOpen(false)}
                className="flex-1 py-3 px-4 bg-white border border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleGrantSubmit}
                disabled={isGranting || (!grantApplyToAll && grantSpecificLectures.length === 0)}
                className="flex-1 py-3 px-4 bg-purple-600 rounded-xl font-bold text-white hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 shadow-md shadow-purple-200"
              >
                {isGranting ? "Applying..." : <><CheckSquare className="w-5 h-5"/> Apply Grant</>}
              </button>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { db, auth } from "@/firebase/config";
import { collection, getDocs, doc, setDoc, serverTimestamp, query, where } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { LogOut, Calendar, CheckCircle2, XCircle, Clock, BookOpen, User as UserIcon, MapPin, Target, AlertCircle } from "lucide-react";
import { signOut } from "firebase/auth";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface Lecture {
  id: string;
  day: string;
  time: string;
  lectureName: string;
  facultyName: string;
  roomNumber: string;
}

interface AttendanceRecord {
  id: string;
  lectureId: string;
  subjectName: string;
  date: string;
  status: "Present" | "Absent";
}

export default function Dashboard() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const [timetable, setTimetable] = useState<Lecture[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);
  const [targetAttendance, setTargetAttendance] = useState(75);
  const [fetching, setFetching] = useState(true);

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
      // Fetch Timetable
      const ttSnapshot = await getDocs(collection(db, `users/${user.uid}/timetable`));
      const ttData: Lecture[] = ttSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lecture));
      setTimetable(ttData);

      // Fetch Attendance
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

  const markAttendance = async (status: "Present" | "Absent") => {
    if (!user || !selectedLecture) return;
    
    // We'll use today's date to track
    const todayStr = new Date().toISOString().split('T')[0];
    const recordId = `${selectedLecture.id}_${todayStr}`;
    
    const docRef = doc(db, `users/${user.uid}/attendance`, recordId);
    
    try {
      await setDoc(docRef, {
        lectureId: selectedLecture.id,
        subjectName: selectedLecture.lectureName,
        date: todayStr,
        day: selectedLecture.day,
        time: selectedLecture.time,
        status,
        createdAt: serverTimestamp(),
      });

      // Optimistic UI Update
      setAttendance(prev => {
        const filtered = prev.filter(r => r.id !== recordId);
        return [...filtered, { id: recordId, lectureId: selectedLecture.id, subjectName: selectedLecture.lectureName, date: todayStr, status }];
      });
    } catch (err) {
      console.error("Error marking attendance:", err);
    }
  };

  // Calculations for selected subject
  const getSubjectStats = (subjectName: string) => {
    const records = attendance.filter(r => r.subjectName === subjectName);
    const present = records.filter(r => r.status === "Present").length;
    const total = records.length;
    const absent = total - present;
    const percentage = total === 0 ? 0 : Math.round((present / total) * 100);

    let safeBunks = 0;
    let needed = 0;

    if (total > 0) {
      const possibleBunks = Math.floor((present * 100 / targetAttendance) - total);
      safeBunks = possibleBunks > 0 ? possibleBunks : 0;
      if (percentage < targetAttendance) {
        needed = Math.ceil((targetAttendance * total - 100 * present) / (100 - targetAttendance));
      }
    }

    return { total, present, absent, percentage, safeBunks, needed };
  };

  // Get today's attendance status for a lecture box
  const getTodayStatus = (lectureId: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const record = attendance.find(r => r.lectureId === lectureId && r.date === todayStr);
    return record ? record.status : "Not marked";
  };

  if (fetching || loading) {
    return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div></div>;
  }

  const selectedStats = selectedLecture ? getSubjectStats(selectedLecture.lectureName) : null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 flex-col md:flex-row">
      
      {/* Main Timetable Area */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Header */}
        <header className="bg-white shadow-sm px-6 py-4 flex justify-between items-center z-10">
          <div className="flex items-center gap-3">
            <Calendar className="text-indigo-600 h-6 w-6" />
            <h1 className="text-xl font-bold text-gray-900">Attendance Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-600 hidden sm:block">Hello, {profile?.fullName}</span>
            <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-red-600 transition-colors rounded-full hover:bg-gray-100">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Timetable Grid */}
        <main className="flex-1 p-6">
          {timetable.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Calendar className="h-16 w-16 text-gray-300 mb-4" />
              <h2 className="text-xl font-semibold text-gray-700">No Timetable Found</h2>
              <p className="text-gray-500 mt-2 mb-6">You haven't setup your timetable yet.</p>
              <button 
                onClick={() => router.push("/upload")}
                className="bg-indigo-600 text-white px-6 py-2 rounded-md font-medium hover:bg-indigo-500"
              >
                Setup Timetable
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
              {DAYS.map(day => {
                const dayLectures = timetable.filter(l => l.day === day).sort((a, b) => a.time.localeCompare(b.time));
                return (
                  <div key={day} className="flex flex-col gap-3">
                    <h3 className="font-semibold text-center text-gray-700 bg-white py-2 rounded-md shadow-sm border border-gray-100 uppercase tracking-wide text-xs">
                      {day}
                    </h3>
                    <div className="flex flex-col gap-3">
                      {dayLectures.map(lecture => {
                        const status = getTodayStatus(lecture.id);
                        const isSelected = selectedLecture?.id === lecture.id;
                        
                        return (
                          <div 
                            key={lecture.id}
                            onClick={() => setSelectedLecture(lecture)}
                            className={`p-4 rounded-xl cursor-pointer transition-all border-2 relative
                              ${isSelected ? 'border-indigo-500 shadow-md transform scale-[1.02]' : 'border-transparent shadow-sm hover:shadow-md bg-white'}
                            `}
                          >
                            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 rounded-l-xl opacity-50"></div>
                            <div className="text-xs font-medium text-indigo-600 mb-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {lecture.time}
                            </div>
                            <h4 className="font-bold text-gray-900 leading-tight mb-2 truncate" title={lecture.lectureName}>
                              {lecture.lectureName}
                            </h4>
                            {lecture.roomNumber && (
                              <div className="text-xs text-gray-500 flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> {lecture.roomNumber}
                              </div>
                            )}
                            <div className={`mt-3 text-xs inline-flex items-center gap-1 font-medium px-2 py-1 rounded-full
                              ${status === 'Present' ? 'bg-green-100 text-green-700' : 
                                status === 'Absent' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}
                            `}>
                              {status === 'Present' && <CheckCircle2 className="w-3 h-3" />}
                              {status === 'Absent' && <XCircle className="w-3 h-3" />}
                              {status}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>

      {/* Side Panel for Details */}
      {selectedLecture && selectedStats && (
        <aside className="w-full md:w-96 bg-white border-l border-gray-200 shadow-xl flex flex-col transform transition-transform duration-300 z-20">
          <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{selectedLecture.lectureName}</h2>
              <div className="mt-2 flex items-center text-sm text-gray-600 gap-4">
                <span className="flex items-center gap-1"><Calendar className="w-4 h-4"/> {selectedLecture.day}</span>
                <span className="flex items-center gap-1"><Clock className="w-4 h-4"/> {selectedLecture.time}</span>
              </div>
            </div>
            <button onClick={() => setSelectedLecture(null)} className="text-gray-400 hover:text-gray-600 md:hidden">
               <XCircle className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 flex-1 overflow-y-auto">
            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3 mb-8">
              <button 
                onClick={() => markAttendance("Present")}
                className="flex items-center justify-center gap-2 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 font-semibold py-3 px-4 rounded-xl transition-colors"
              >
                <CheckCircle2 className="w-5 h-5" /> Present
              </button>
              <button 
                onClick={() => markAttendance("Absent")}
                className="flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold py-3 px-4 rounded-xl transition-colors"
              >
                <XCircle className="w-5 h-5" /> Absent
              </button>
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
              </div>
            </div>

            {/* Stats */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Attendance Stats</h3>
                <div className="flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full font-medium">
                   <Target className="w-3 h-3" /> Target {targetAttendance}%
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="p-5 flex items-center justify-between border-b border-gray-100">
                  <div>
                    <p className="text-3xl font-bold" style={{ color: selectedStats.percentage >= targetAttendance ? '#10b981' : '#ef4444' }}>
                      {selectedStats.percentage}%
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Overall percentage</p>
                  </div>
                  <div className="h-16 w-16 relative flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path className="text-gray-100" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path className="transition-all duration-500" strokeWidth="3" strokeDasharray={`${selectedStats.percentage}, 100`} stroke={selectedStats.percentage >= targetAttendance ? '#10b981' : '#ef4444'} fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 divide-x divide-gray-100 bg-gray-50">
                  <div className="p-4 text-center">
                    <p className="text-2xl font-semibold text-gray-900">{selectedStats.present} / {selectedStats.total}</p>
                    <p className="text-xs text-gray-500 mt-1">Classes Attended</p>
                  </div>
                  <div className="p-4 text-center">
                    <p className="text-2xl font-semibold text-gray-900">{selectedStats.absent}</p>
                    <p className="text-xs text-gray-500 mt-1">Classes Missed</p>
                  </div>
                </div>
              </div>

              {/* Smart Insights */}
              <div className="mt-4">
                {selectedStats.total === 0 ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600 text-center">
                    Start tracking your attendance for insights.
                  </div>
                ) : selectedStats.safeBunks > 0 ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-green-800">You are in the safe zone!</p>
                      <p className="text-sm text-green-700 mt-1">You can afford to bunk <span className="font-bold">{selectedStats.safeBunks}</span> more class{selectedStats.safeBunks > 1 ? 'es' : ''}.</p>
                    </div>
                  </div>
                ) : selectedStats.needed > 0 ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-800">Attendance Alert</p>
                      <p className="text-sm text-red-700 mt-1">You must attend the next <span className="font-bold">{selectedStats.needed}</span> class{selectedStats.needed > 1 ? 'es' : ''} to reach {targetAttendance}%.</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 text-center font-medium">
                    You are exactly on track!
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
// Note: I will need to make AlertCircle available from lucide-react

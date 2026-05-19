"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatTime12Hour } from "@/utils/formatTime";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/firebase/config";
import { doc, setDoc, serverTimestamp, collection, getDocs, deleteDoc } from "firebase/firestore";
import { Trash2, Plus, Check } from "lucide-react";
import { ExtractedLecture } from "@/services/timetableExtractor";

const FIXED_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function ConfirmTimetable() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [timetable, setTimetable] = useState<ExtractedLecture[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!user && !loading) {
      router.push("/login");
      return;
    }
    
    if (user) {
      loadData();
    }
  }, [user, loading, router]);

  const loadData = async () => {
    if (!user) return;
    setFetching(true);
    // 1. Try to load cached data from upload flow
    const cached = localStorage.getItem("temp_extracted_timetable");
    if (cached) {
      try {
        setTimetable(JSON.parse(cached));
        setFetching(false);
        return;
      } catch (e) {
        console.error("Cache parse error", e);
      }
    }

    // 2. If no cache, load existing timetable from Firestore
    try {
      const snap = await getDocs(collection(db, `users/${user.uid}/timetable`));
      if (!snap.empty) {
        const existingData: ExtractedLecture[] = snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            day: data.day,
            startTime: data.startTime,
            endTime: data.endTime,
            lectureName: data.lectureName,
            facultyName: data.facultyName,
            roomNumber: data.roomNumber,
          };
        });
        setTimetable(existingData);
        setIsEditMode(true); // Automatically enter edit mode if loading existing
      } else {
        setTimetable([]);
        setIsEditMode(true); // Empty state, let them edit
      }
    } catch (err) {
      console.error("Error fetching existing timetable", err);
    }
    setFetching(false);
  };

  const updateLecture = (id: string, field: keyof ExtractedLecture, value: string) => {
    setTimetable(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const deleteLecture = (id: string) => {
    setTimetable(prev => prev.filter(l => l.id !== id));
  };

  const addLecture = (day: string) => {
    const newLecture: ExtractedLecture = {
      id: `manual_${Date.now()}`,
      day,
      startTime: "09:00",
      endTime: "10:00",
      lectureName: "",
      facultyName: "",
      roomNumber: "",
    };
    setTimetable(prev => [...prev, newLecture]);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setError("");

    try {
      // 1. Wipe existing timetable to prevent orphaned deleted lectures
      const existingSnap = await getDocs(collection(db, `users/${user.uid}/timetable`));
      const deletePromises = existingSnap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);

      // 2. Save all current lectures
      const savePromises = timetable.map(async (lecture) => {
        if (!lecture.lectureName && !lecture.startTime) return;
        
        const docRef = doc(db, `users/${user.uid}/timetable`, lecture.id.startsWith('manual_') ? doc(collection(db, 'temp')).id : lecture.id);
        return setDoc(docRef, {
          day: lecture.day,
          startTime: lecture.startTime || "00:00",
          endTime: lecture.endTime || "00:00",
          lectureName: lecture.lectureName,
          facultyName: lecture.facultyName,
          roomNumber: lecture.roomNumber,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      await Promise.all(savePromises);
      localStorage.removeItem("temp_extracted_timetable");
      router.push("/dashboard");
    } catch (err: any) {
      console.error(err);
      setError("Failed to save timetable: " + err.message);
      setSaving(false);
    }
  };

  // Group timetable by day and auto-sort by startTime
  const groupedTimetable = FIXED_DAYS.map(day => {
    const dayLectures = timetable.filter(l => l.day === day).sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
    return { day, lectures: dayLectures };
  });

  const uniqueLectureNames = Array.from(new Set(timetable.map(l => l.lectureName).filter(Boolean)));

  if (fetching || loading) {
    return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div></div>;
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 w-full">
      <div className="w-full max-w-6xl rounded-2xl bg-white p-6 shadow-xl sm:p-10">
        <div className="mb-8 border-b border-gray-200 pb-6 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Review Timetable</h1>
          <p className="mt-2 text-sm text-gray-600">
            {isEditMode 
              ? "Make your manual corrections below."
              : "Is this timetable correct?"}
          </p>
        </div>

        {error && <div className="mb-6 p-4 rounded-md bg-red-50 text-red-700">{error}</div>}

        <datalist id="lecture-names">
          {uniqueLectureNames.map((name, idx) => (
            <option key={idx} value={name} />
          ))}
        </datalist>

        <div className="space-y-10">
          {groupedTimetable.map(({ day, lectures }) => (
            <div key={day} className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="bg-gray-100 px-6 py-4 flex justify-between items-center border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800">{day}</h2>
                {(isEditMode || lectures.length === 0) && (
                  <button 
                    onClick={() => addLecture(day)}
                    className="flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add Lecture
                  </button>
                )}
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 hidden sm:table">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/8">Start Time</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/8">End Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">Lecture Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">Faculty (Opt)</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">Room (Opt)</th>
                      {(isEditMode || lectures.length === 0) && <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-1/12">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {lectures.length > 0 ? (
                      lectures.map((lecture) => (
                        <tr key={lecture.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-4 whitespace-nowrap">
                            {isEditMode ? (
                              <input 
                                type="time" 
                                value={lecture.startTime} 
                                onChange={(e) => updateLecture(lecture.id, "startTime", e.target.value)}
                                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-2 py-1 text-gray-900"
                              />
                            ) : (
                              <span className="text-sm font-medium text-gray-900">{formatTime12Hour(lecture.startTime)}</span>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            {isEditMode ? (
                              <input 
                                type="time" 
                                value={lecture.endTime} 
                                onChange={(e) => updateLecture(lecture.id, "endTime", e.target.value)}
                                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-2 py-1 text-gray-900"
                              />
                            ) : (
                              <span className="text-sm font-medium text-gray-900">{formatTime12Hour(lecture.endTime)}</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {isEditMode ? (
                              <input 
                                type="text" 
                                list="lecture-names"
                                value={lecture.lectureName} 
                                onChange={(e) => updateLecture(lecture.id, "lectureName", e.target.value)}
                                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-2 py-1 text-gray-900 placeholder-gray-500"
                                placeholder="Data Structures"
                              />
                            ) : (
                              <span className="text-sm text-gray-900">{lecture.lectureName || "-"}</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {isEditMode ? (
                              <input 
                                type="text" 
                                value={lecture.facultyName} 
                                onChange={(e) => updateLecture(lecture.id, "facultyName", e.target.value)}
                                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-2 py-1 text-gray-900 placeholder-gray-500"
                              />
                            ) : (
                              <span className="text-sm text-gray-500">{lecture.facultyName || "-"}</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {isEditMode ? (
                              <input 
                                type="text" 
                                value={lecture.roomNumber} 
                                onChange={(e) => updateLecture(lecture.id, "roomNumber", e.target.value)}
                                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-2 py-1 text-gray-900 placeholder-gray-500"
                              />
                            ) : (
                              <span className="text-sm text-gray-500">{lecture.roomNumber || "-"}</span>
                            )}
                          </td>
                          {(isEditMode || lectures.length === 0) && (
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button onClick={() => deleteLecture(lecture.id)} className="text-red-600 hover:text-red-900">
                                <Trash2 className="h-5 w-5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500 italic">
                          No classes scheduled for this day.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                
                {/* Mobile Card View */}
                <div className="sm:hidden flex flex-col gap-4 p-4">
                  {lectures.length > 0 ? (
                    lectures.map((lecture) => (
                      <div key={lecture.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col gap-3 relative">
                        {(isEditMode || lectures.length === 0) && (
                          <button onClick={() => deleteLecture(lecture.id)} className="absolute top-4 right-4 text-red-500 hover:text-red-700 bg-red-50 p-1.5 rounded-md transition-colors"><Trash2 className="w-4 h-4"/></button>
                        )}
                        <div className="grid grid-cols-2 gap-3 pr-8">
                          <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Start Time</label>
                            {isEditMode ? (
                              <input type="time" value={lecture.startTime} onChange={(e) => updateLecture(lecture.id, "startTime", e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm px-2 py-1.5 text-gray-900" />
                            ) : (
                              <div className="text-sm font-medium text-gray-900 mt-1">{formatTime12Hour(lecture.startTime)}</div>
                            )}
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase">End Time</label>
                            {isEditMode ? (
                              <input type="time" value={lecture.endTime} onChange={(e) => updateLecture(lecture.id, "endTime", e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm px-2 py-1.5 text-gray-900" />
                            ) : (
                              <div className="text-sm font-medium text-gray-900 mt-1">{formatTime12Hour(lecture.endTime)}</div>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase">Lecture Name</label>
                          {isEditMode ? (
                            <input type="text" list="lecture-names" value={lecture.lectureName} onChange={(e) => updateLecture(lecture.id, "lectureName", e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm px-2 py-1.5 text-gray-900 placeholder-gray-500" placeholder="Data Structures" />
                          ) : (
                            <div className="text-sm font-medium text-gray-900 mt-1">{lecture.lectureName || "-"}</div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Faculty (Opt)</label>
                            {isEditMode ? (
                              <input type="text" value={lecture.facultyName} onChange={(e) => updateLecture(lecture.id, "facultyName", e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm px-2 py-1.5 text-gray-900 placeholder-gray-500" />
                            ) : (
                              <div className="text-sm text-gray-500 mt-1">{lecture.facultyName || "-"}</div>
                            )}
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Room (Opt)</label>
                            {isEditMode ? (
                              <input type="text" value={lecture.roomNumber} onChange={(e) => updateLecture(lecture.id, "roomNumber", e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm px-2 py-1.5 text-gray-900 placeholder-gray-500" />
                            ) : (
                              <div className="text-sm text-gray-500 mt-1">{lecture.roomNumber || "-"}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-sm text-gray-500 italic py-4">
                      No classes scheduled for this day.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4 border-t border-gray-200 pt-8">
          {!isEditMode ? (
            <>
              <button
                onClick={() => setIsEditMode(true)}
                className="w-full sm:w-auto rounded-md bg-white px-8 py-3 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
              >
                No, Edit Manually
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full sm:w-auto flex justify-center items-center rounded-md bg-indigo-600 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
              >
                {saving ? "Saving..." : <><Check className="w-5 h-5 mr-2"/> Yes, Continue</>}
              </button>
            </>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto flex justify-center items-center rounded-md bg-indigo-600 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving ? "Saving..." : <><Check className="w-5 h-5 mr-2"/> Save Timetable</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

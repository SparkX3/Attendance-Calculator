"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/firebase/config";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
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

  useEffect(() => {
    if (!user && !loading) {
      router.push("/login");
      return;
    }
    
    // Load cached data
    const cached = localStorage.getItem("temp_extracted_timetable");
    if (cached) {
      try {
        setTimetable(JSON.parse(cached));
      } catch (e) {
        setTimetable([]);
      }
    }
  }, [user, loading, router]);

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
      time: "",
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
      // Save all lectures to firestore
      const promises = timetable.map(async (lecture) => {
        // Skip empty manual rows
        if (!lecture.lectureName && !lecture.time) return;
        
        const docRef = doc(db, `users/${user.uid}/timetable`, lecture.id);
        return setDoc(docRef, {
          day: lecture.day,
          time: lecture.time,
          lectureName: lecture.lectureName,
          facultyName: lecture.facultyName,
          roomNumber: lecture.roomNumber,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      await Promise.all(promises);
      localStorage.removeItem("temp_extracted_timetable");
      router.push("/dashboard");
    } catch (err: any) {
      console.error(err);
      setError("Failed to save timetable: " + err.message);
      setSaving(false);
    }
  };

  // Group timetable by day
  const groupedTimetable = FIXED_DAYS.map(day => {
    // Filter and basic sort by time (alphabetical for now since format is unknown)
    const dayLectures = timetable.filter(l => l.day === day).sort((a, b) => a.time.localeCompare(b.time));
    return { day, lectures: dayLectures };
  });

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
                    <Plus className="h-4 w-4 mr-1" /> Add Class
                  </button>
                )}
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/6">Lecture Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">Faculty (Opt)</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">Room (Opt)</th>
                      {(isEditMode || lectures.length === 0) && <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-1/12">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {lectures.length > 0 ? (
                      lectures.map((lecture) => (
                        <tr key={lecture.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            {isEditMode ? (
                              <input 
                                type="text" 
                                value={lecture.time} 
                                onChange={(e) => updateLecture(lecture.id, "time", e.target.value)}
                                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-2 py-1"
                                placeholder="09:00 AM"
                              />
                            ) : (
                              <span className="text-sm font-medium text-gray-900">{lecture.time || "-"}</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {isEditMode ? (
                              <input 
                                type="text" 
                                value={lecture.lectureName} 
                                onChange={(e) => updateLecture(lecture.id, "lectureName", e.target.value)}
                                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-2 py-1"
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
                                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-2 py-1"
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
                                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-2 py-1"
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
                        <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500 italic">
                          No classes scheduled for this day.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
              onClick={() => setIsEditMode(false)}
              className="w-full sm:w-auto rounded-md bg-indigo-600 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              Done Editing
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

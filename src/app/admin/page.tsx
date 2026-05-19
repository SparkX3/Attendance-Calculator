"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/firebase/config";
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { ShieldAlert, Plus, Trash2, Save, Calendar, Building, BookOpen } from "lucide-react";

const FIXED_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function AdminPanel() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [presets, setPresets] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);

  // Form State
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editPresetId, setEditPresetId] = useState<string | null>(null);
  
  const [title, setTitle] = useState("");
  const [college, setCollege] = useState("");
  const [course, setCourse] = useState("");
  const [department, setDepartment] = useState("");
  const [semester, setSemester] = useState("");
  const [division, setDivision] = useState("");
  const [batch, setBatch] = useState("");

  const [lectures, setLectures] = useState<any[]>([]);

  useEffect(() => {
    if (loading) return;
    
    if (!user || user.email !== "shingolesanchit123@gmail.com") {
      alert("Unauthorized Access. Redirecting to dashboard.");
      router.push("/dashboard");
      return;
    }

    // Ensure role is "admin"
    const ensureAdminRole = async () => {
      try {
        await updateDoc(doc(db, "users", user.uid), { role: "admin" });
      } catch (err) {
        console.error("Could not set admin role", err);
      }
    };
    ensureAdminRole();
    fetchPresets();
  }, [user, loading, router]);

  const fetchPresets = async () => {
    setFetching(true);
    try {
      const snap = await getDocs(collection(db, "presetTimetables"));
      setPresets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    }
    setFetching(false);
  };

  const addLectureRow = (day: string) => {
    setLectures([
      ...lectures, 
      { id: Date.now().toString(), day, lectureName: "", startTime: "09:00", endTime: "10:00", facultyName: "", roomNumber: "" }
    ]);
  };

  const updateLecture = (id: string, field: string, value: string) => {
    setLectures(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const removeLecture = (id: string) => {
    setLectures(prev => prev.filter(l => l.id !== id));
  };

  const handleSavePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !college || !course || !semester) {
      alert("Please fill required metadata (Title, College, Course, Semester).");
      return;
    }
    if (lectures.length === 0) {
      alert("Please add at least one lecture.");
      return;
    }

    setIsSaving(true);
    try {
      if (editPresetId) {
        const updateRef = doc(db, "presetTimetables", editPresetId);
        await updateDoc(updateRef, {
          title, college, course, department, semester, division, batch,
          lectures: lectures.map(({ id, ...rest }) => rest), // remove temp id
          updatedAt: serverTimestamp(),
        });
        alert("Preset Timetable Updated!");
      } else {
        const newRef = doc(collection(db, "presetTimetables"));
        await setDoc(newRef, {
          title, college, course, department, semester, division, batch,
          lectures: lectures.map(({ id, ...rest }) => rest), // remove temp id
          createdBy: user?.email,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        alert("Preset Timetable Saved!");
      }
      
      setIsAdding(false);
      resetForm();
      fetchPresets();
    } catch (err: any) {
      alert("Error saving preset: " + err.message);
    }
    setIsSaving(false);
  };

  const handleDeletePreset = async (id: string) => {
    const confirm = window.confirm("Are you sure you want to delete this preset timetable? Students who already applied it will NOT lose their schedules.");
    if (!confirm) return;

    try {
      await deleteDoc(doc(db, "presetTimetables", id));
      fetchPresets();
    } catch (err: any) {
      alert("Error deleting preset: " + err.message);
    }
  };

  const resetForm = () => {
    setTitle("");
    setCollege("");
    setCourse("");
    setDepartment("");
    setSemester("");
    setDivision("");
    setBatch("");
    setLectures([]);
    setEditPresetId(null);
  };

  const handleEditPreset = (preset: any) => {
    setTitle(preset.title || "");
    setCollege(preset.college || "");
    setCourse(preset.course || "");
    setDepartment(preset.department || "");
    setSemester(preset.semester || "");
    setDivision(preset.division || "");
    setBatch(preset.batch || "");
    
    // Add temporary IDs back for the builder
    const mappedLectures = (preset.lectures || []).map((l: any) => ({
      ...l, id: Math.random().toString(36).substr(2, 9)
    }));
    setLectures(mappedLectures);
    
    setEditPresetId(preset.id);
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Group current builder lectures by fixed days
  const groupedBuilderLectures = FIXED_DAYS.map(day => {
    return { day, dayLectures: lectures.filter(l => l.day === day) };
  });

  if (loading || fetching) {
    return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div></div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="bg-red-600 text-white p-6 rounded-2xl shadow-lg flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ShieldAlert className="w-10 h-10" />
            <div>
              <h1 className="text-2xl font-bold">Admin Control Panel</h1>
              <p className="text-red-100 text-sm">Class Timetable Library Management</p>
            </div>
          </div>
          <button 
            onClick={() => router.push("/dashboard")}
            className="bg-red-700 hover:bg-red-800 px-4 py-2 rounded-lg font-semibold transition-colors text-sm"
          >
            Exit to Dashboard
          </button>
        </div>

        {/* Action Bar */}
        {!isAdding && (
          <div className="flex justify-end">
            <button 
              onClick={() => setIsAdding(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-md flex items-center gap-2"
            >
              <Plus className="w-5 h-5" /> Add New Preset Timetable
            </button>
          </div>
        )}

        {/* Add Preset Form */}
        {isAdding && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">{editPresetId ? "Edit Preset Timetable" : "Create Preset Timetable"}</h2>
              <button onClick={() => { setIsAdding(false); resetForm(); }} className="text-gray-500 hover:text-red-500 font-bold text-sm">Cancel</button>
            </div>
            
            <form onSubmit={handleSavePreset} className="p-6 space-y-8">
              {/* Metadata */}
              <div className="space-y-4">
                <h3 className="font-bold text-gray-700 flex items-center gap-2 border-b pb-2"><Building className="w-4 h-4"/> Institution Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Title (e.g. FY BSc CS - Div A)</label>
                    <input type="text" required value={title} onChange={e=>setTitle(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 placeholder-gray-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">College</label>
                    <input type="text" required value={college} onChange={e=>setCollege(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 placeholder-gray-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Course / Degree</label>
                    <input type="text" required value={course} onChange={e=>setCourse(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 placeholder-gray-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Semester</label>
                    <input type="text" required value={semester} onChange={e=>setSemester(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 placeholder-gray-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Department (Opt)</label>
                    <input type="text" value={department} onChange={e=>setDepartment(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 placeholder-gray-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Division (Opt)</label>
                    <input type="text" value={division} onChange={e=>setDivision(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 placeholder-gray-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Batch (Opt)</label>
                    <input type="text" value={batch} onChange={e=>setBatch(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 placeholder-gray-500" />
                  </div>
                </div>
              </div>

              {/* Fixed Days Lectures Builder */}
              <div className="space-y-6">
                <div className="border-b pb-2">
                  <h3 className="font-bold text-gray-700 flex items-center gap-2"><Calendar className="w-4 h-4"/> Lectures Schedule</h3>
                </div>
                
                {groupedBuilderLectures.map(({ day, dayLectures }) => (
                  <div key={day} className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="bg-gray-100 px-6 py-4 flex justify-between items-center border-b border-gray-200">
                      <h2 className="text-lg font-semibold text-gray-800">{day}</h2>
                      <button 
                        type="button" 
                        onClick={() => addLectureRow(day)}
                        className="flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200 transition-colors"
                      >
                        <Plus className="h-4 w-4 mr-1" /> Add Lecture
                      </button>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 hidden sm:table">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Time</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Time</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lecture Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Faculty (Opt)</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room (Opt)</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {dayLectures.length > 0 ? (
                            dayLectures.map(l => (
                              <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3 whitespace-nowrap"><input type="time" value={l.startTime} onChange={e=>updateLecture(l.id, 'startTime', e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm px-2 py-1.5 text-gray-900" /></td>
                                <td className="px-4 py-3 whitespace-nowrap"><input type="time" value={l.endTime} onChange={e=>updateLecture(l.id, 'endTime', e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm px-2 py-1.5 text-gray-900" /></td>
                                <td className="px-6 py-3 whitespace-nowrap"><input type="text" required value={l.lectureName} onChange={e=>updateLecture(l.id, 'lectureName', e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm px-2 py-1.5 text-gray-900 placeholder-gray-500" placeholder="e.g. DBMS" /></td>
                                <td className="px-6 py-3 whitespace-nowrap"><input type="text" value={l.facultyName} onChange={e=>updateLecture(l.id, 'facultyName', e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm px-2 py-1.5 text-gray-900 placeholder-gray-500" placeholder="e.g. Dr. John" /></td>
                                <td className="px-6 py-3 whitespace-nowrap"><input type="text" value={l.roomNumber} onChange={e=>updateLecture(l.id, 'roomNumber', e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm px-2 py-1.5 text-gray-900 placeholder-gray-500" placeholder="e.g. 104" /></td>
                                <td className="px-6 py-3 whitespace-nowrap text-right">
                                  <button type="button" onClick={()=>removeLecture(l.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500 italic">
                                No lectures scheduled for {day}.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                      
                      {/* Mobile Card View */}
                      <div className="sm:hidden flex flex-col gap-4 p-4">
                        {dayLectures.length > 0 ? (
                          dayLectures.map(l => (
                            <div key={l.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col gap-3 relative">
                              <button type="button" onClick={()=>removeLecture(l.id)} className="absolute top-4 right-4 text-red-500 hover:text-red-700 bg-red-50 p-1.5 rounded-md transition-colors"><Trash2 className="w-4 h-4"/></button>
                              <div className="grid grid-cols-2 gap-3 pr-8">
                                <div>
                                  <label className="text-[10px] font-bold text-gray-500 uppercase">Start Time</label>
                                  <input type="time" value={l.startTime} onChange={e=>updateLecture(l.id, 'startTime', e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm px-2 py-1.5 text-gray-900" />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-gray-500 uppercase">End Time</label>
                                  <input type="time" value={l.endTime} onChange={e=>updateLecture(l.id, 'endTime', e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm px-2 py-1.5 text-gray-900" />
                                </div>
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Lecture Name</label>
                                <input type="text" required value={l.lectureName} onChange={e=>updateLecture(l.id, 'lectureName', e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm px-2 py-1.5 text-gray-900 placeholder-gray-500" placeholder="e.g. DBMS" />
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[10px] font-bold text-gray-500 uppercase">Faculty (Opt)</label>
                                  <input type="text" value={l.facultyName} onChange={e=>updateLecture(l.id, 'facultyName', e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm px-2 py-1.5 text-gray-900 placeholder-gray-500" placeholder="e.g. Dr. John" />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-gray-500 uppercase">Room (Opt)</label>
                                  <input type="text" value={l.roomNumber} onChange={e=>updateLecture(l.id, 'roomNumber', e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm px-2 py-1.5 text-gray-900 placeholder-gray-500" placeholder="e.g. 104" />
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center text-sm text-gray-500 italic py-4">
                            No lectures scheduled for {day}.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 flex justify-end border-t border-gray-200 mt-8">
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl font-bold shadow-md flex items-center gap-2 disabled:opacity-50 transition-colors"
                >
                  <Save className="w-5 h-5" /> {isSaving ? "Saving..." : (editPresetId ? "Update Preset Timetable" : "Save Preset Timetable")}
                </button>
              </div>

            </form>
          </div>
        )}

        {/* Existing Presets List */}
        {!isAdding && (
          <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2"><BookOpen className="w-5 h-5 text-indigo-500"/> Existing Library Presets</h2>
            
            {presets.length === 0 ? (
              <p className="text-gray-500 text-center py-8 bg-gray-50 rounded-xl border border-dashed">No preset timetables found.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {presets.map(p => (
                  <div key={p.id} className="border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-shadow bg-gray-50 relative group">
                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleEditPreset(p)}
                        className="text-gray-500 hover:text-indigo-600 bg-white p-1.5 rounded-md shadow-sm border border-gray-200"
                        title="Edit Preset"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                      </button>
                      <button 
                        onClick={() => handleDeletePreset(p.id)}
                        className="text-gray-400 hover:text-red-600 bg-white p-1.5 rounded-md shadow-sm border border-gray-200"
                        title="Delete Preset"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <h3 className="font-bold text-indigo-900 text-lg mb-2 pr-8">{p.title}</h3>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p><strong>College:</strong> {p.college}</p>
                      <p><strong>Course:</strong> {p.course}</p>
                      <p><strong>Sem:</strong> {p.semester} {p.division && `| Div: ${p.division}`}</p>
                      <p><strong>Lectures:</strong> {p.lectures?.length || 0}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

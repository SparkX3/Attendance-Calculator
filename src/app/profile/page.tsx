"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { db, auth } from "@/firebase/config";
import { doc, setDoc, serverTimestamp, collection, getDocs, deleteDoc } from "firebase/firestore";
import { sendPasswordResetEmail, deleteUser } from "firebase/auth";
import { useRouter } from "next/navigation";
import { GraduationCap, Calendar, AlertTriangle, Key, Trash2, BookOpen, Download, Edit2, Check, ShieldAlert } from "lucide-react";
import { formatTime12Hour } from "@/utils/formatTime";

const FIXED_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  
  const [fullName, setFullName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [college, setCollege] = useState("");
  const [semester, setSemester] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Timetable States
  const [timetable, setTimetable] = useState<any[]>([]);
  const [presetTimetables, setPresetTimetables] = useState<any[]>([]);
  
  // Advanced Settings States
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push("/login");
    } else {
      if (profile) {
        setFullName(profile.fullName || "");
        setRollNumber(profile.rollNumber || "");
        setCollege(profile.college || "");
        setSemester(profile.semester || "");
        fetchUserTimetable();
        fetchPresets();
      } else if (user.displayName) {
        setFullName(user.displayName);
      }
    }
  }, [user, profile, router]);

  const fetchUserTimetable = async () => {
    if (!user) return;
    try {
      const snap = await getDocs(collection(db, `users/${user.uid}/timetable`));
      setTimetable(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPresets = async () => {
    try {
      const snap = await getDocs(collection(db, "presetTimetables"));
      setPresetTimetables(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setError("");

    try {
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        fullName,
        rollNumber,
        email: user.email,
        college,
        semester,
        photoURL: user.photoURL || "",
        updatedAt: serverTimestamp(),
        createdAt: profile?.createdAt || serverTimestamp(),
      });
      await refreshProfile();
      if (!profile) {
        router.push("/upload");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user || !user.email) return;
    
    // Check if user is using Google Auth
    const isGoogle = user.providerData.some(provider => provider.providerId === 'google.com');
    if (isGoogle) {
      alert("Your account uses Google Login. Password is managed securely by Google.");
      return;
    }

    setIsResetting(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      alert("Password reset link sent to your email.");
    } catch (err: any) {
      alert("Failed to send reset link: " + err.message);
    }
    setIsResetting(false);
  };

  const handleDeleteProfile = async () => {
    if (!user) return;
    if (deleteConfirmation !== "DELETE") return;
    
    const confirmFinal = window.confirm("Are you absolutely sure you want to permanently delete your account?");
    if (!confirmFinal) return;

    setIsDeleting(true);
    try {
      const uid = user.uid;
      // 1. Wipe all subcollections
      const collectionsToWipe = ["timetable", "attendance", "grantedAttendance", "academicAlerts", "uploads"];
      for (const colName of collectionsToWipe) {
        const snap = await getDocs(collection(db, `users/${uid}/${colName}`));
        const promises = snap.docs.map(d => deleteDoc(d.ref));
        await Promise.all(promises);
      }
      
      // 2. Wipe user doc
      await deleteDoc(doc(db, "users", uid));
      
      // 3. Delete Firebase Auth User
      await deleteUser(user);
      
      // Redirect happens automatically via AuthContext listener
    } catch (err: any) {
      if (err.code === "auth/requires-recent-login") {
        alert("This action requires a recent login for security. Please log out, log back in, and try again.");
      } else {
        alert("Error deleting profile: " + err.message);
      }
      setIsDeleting(false);
    }
  };

  const copyPresetTimetable = async (preset: any) => {
    if (!user) return;
    const confirmUse = window.confirm("This will replace your current timetable. Your old attendance records will remain saved by date. Continue?");
    if (!confirmUse) return;
    
    setIsCopying(true);
    try {
      // Wipe existing
      const snap = await getDocs(collection(db, `users/${user.uid}/timetable`));
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
      
      const todayStr = new Date().toLocaleDateString('en-CA');

      // Copy new
      for (const lec of preset.lectures) {
        const newRef = doc(collection(db, `users/${user.uid}/timetable`));
        await setDoc(newRef, {
          day: lec.day,
          startTime: lec.startTime || "00:00",
          endTime: lec.endTime || "00:00",
          lectureName: lec.lectureName,
          facultyName: lec.facultyName || "",
          roomNumber: lec.roomNumber || "",
          activeFromDate: todayStr,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      alert("Failed to apply timetable.");
    }
    setIsCopying(false);
  };

  // Group current timetable by day
  const groupedTimetable = FIXED_DAYS.map(day => {
    const dayLectures = timetable.filter(l => l.day === day).sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
    return { day, lectures: dayLectures };
  });

  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-4xl space-y-8">
        
        {/* Profile Basic Info */}
        <div className="rounded-2xl bg-white p-8 shadow-xl">
          <div className="mb-8 text-center flex flex-col items-center">
            <div className="mb-4 rounded-full bg-indigo-100 p-4 text-indigo-600">
              <GraduationCap className="h-10 w-10" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">{profile ? "Profile Settings" : "Complete Your Profile"}</h1>
            <p className="mt-2 text-sm text-gray-600">
              {profile ? "Update your personal details below." : "We need a few more details to set up your account."}
            </p>
            {user?.email === "shingolesanchit123@gmail.com" && (
               <button onClick={() => router.push("/admin")} className="mt-4 flex items-center gap-2 bg-red-100 text-red-700 px-4 py-2 rounded-full font-bold text-sm hover:bg-red-200 transition-colors border border-red-200">
                 <ShieldAlert className="w-4 h-4" /> Go to Admin Control Panel
               </button>
            )}
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Full Name</label>
                <input type="text" required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Roll Number</label>
                <input type="text" required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Semester</label>
                <select required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" value={semester} onChange={(e) => setSemester(e.target.value)}>
                  <option value="" disabled>Select</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s.toString()}>Semester {s}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">College Name</label>
                <input type="text" required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" value={college} onChange={(e) => setCollege(e.target.value)} />
              </div>
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}

            <div className="flex gap-4 pt-4">
              {profile && (
                <button type="button" onClick={() => router.push("/dashboard")} className="w-full rounded-md bg-white px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
                  Cancel
                </button>
              )}
              <button type="submit" disabled={loading} className="w-full rounded-md bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50">
                {loading ? "Saving..." : (profile ? "Save Changes" : "Save Profile & Continue")}
              </button>
            </div>
          </form>
        </div>

        {/* Timetable Settings (Excel View) */}
        {profile && (
          <div className="rounded-2xl bg-white p-8 shadow-xl border-t-4 border-orange-500">
            <div className="flex items-start gap-4 mb-6">
              <div className="rounded-full bg-orange-100 p-3 text-orange-600 shrink-0">
                 <Calendar className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">Timetable Settings</h2>
                <p className="mt-1 text-sm text-gray-600">View and modify your current weekly schedule.</p>
              </div>
            </div>

            {timetable.length > 0 ? (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto mb-6 border border-gray-200 rounded-xl">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Day</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Schedule</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {groupedTimetable.map(({ day, lectures }) => (
                        <tr key={day}>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-gray-900 bg-gray-50 w-32 align-top">{day}</td>
                          <td className="px-4 py-2">
                            {lectures.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {lectures.map((l: any, idx: number) => (
                                  <div key={idx} className="bg-orange-50 border border-orange-200 rounded-lg p-2 text-xs w-48 shrink-0">
                                    <div className="font-bold text-orange-900 truncate" title={l.lectureName}>{l.lectureName}</div>
                                    <div className="text-orange-700 mt-1">{formatTime12Hour(l.startTime)} - {formatTime12Hour(l.endTime)}</div>
                                    {(l.facultyName || l.roomNumber) && (
                                      <div className="text-orange-600/80 mt-1 truncate">
                                        {l.facultyName} {l.roomNumber && `| Room ${l.roomNumber}`}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400 italic py-2 block">No classes scheduled</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden flex flex-col gap-4 mb-6">
                  {groupedTimetable.map(({ day, lectures }) => (
                    <div key={day} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 font-bold text-gray-800">
                        {day}
                      </div>
                      <div className="p-4 flex flex-col gap-3">
                        {lectures.length > 0 ? (
                          lectures.map((l: any, idx: number) => (
                            <div key={idx} className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                              <div className="font-bold text-orange-900 mb-1">{l.lectureName}</div>
                              <div className="text-sm font-medium text-orange-700 flex items-center gap-2">
                                {formatTime12Hour(l.startTime)} - {formatTime12Hour(l.endTime)}
                              </div>
                              {(l.facultyName || l.roomNumber) && (
                                <div className="text-xs text-orange-600/80 mt-2 flex flex-wrap gap-x-3 gap-y-1">
                                  {l.facultyName && <span>👨‍🏫 {l.facultyName}</span>}
                                  {l.roomNumber && <span>📍 Room {l.roomNumber}</span>}
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <span className="text-sm text-gray-400 italic">No classes scheduled</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-8 text-center mb-6">
                <p className="text-gray-500">You haven't set up a timetable yet.</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4">
              <button onClick={() => { localStorage.removeItem("temp_extracted_timetable"); router.push("/upload"); }} className="flex-1 flex justify-center items-center gap-2 rounded-md bg-white border border-gray-300 px-6 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50">
                <Download className="w-4 h-4" /> Upload New Timetable
              </button>
              <button onClick={() => { localStorage.removeItem("temp_extracted_timetable"); router.push("/confirm"); }} className="flex-1 flex justify-center items-center gap-2 rounded-md bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-500">
                <Edit2 className="w-4 h-4" /> Edit Manually
              </button>
            </div>
            <div className="mt-4 bg-orange-50 text-orange-800 text-xs p-3 rounded-md flex gap-2 items-start border border-orange-200">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <p>Warning: Overwriting your timetable might misalign with your past attendance records.</p>
            </div>
          </div>
        )}

        {/* Class Timetable Library */}
        {profile && presetTimetables.length > 0 && (
          <div className="rounded-2xl bg-white p-8 shadow-xl border-t-4 border-blue-500">
            <div className="flex items-start gap-4 mb-6">
              <div className="rounded-full bg-blue-100 p-3 text-blue-600 shrink-0">
                 <BookOpen className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Class Timetable Library</h2>
                <p className="mt-1 text-sm text-gray-600">Instantly apply a pre-configured timetable uploaded by your admin.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {presetTimetables.map(preset => (
                <div key={preset.id} className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                  <h3 className="font-bold text-gray-900 text-lg mb-1">{preset.title}</h3>
                  <div className="text-xs text-gray-500 space-y-1 mb-4">
                    <p><strong>College:</strong> {preset.college}</p>
                    <p><strong>Course:</strong> {preset.course} (Sem {preset.semester})</p>
                    {preset.division && <p><strong>Div/Batch:</strong> {preset.division}</p>}
                    <p><strong>Lectures:</strong> {preset.lectures?.length || 0} classes</p>
                  </div>
                  <button 
                    onClick={() => copyPresetTimetable(preset)}
                    disabled={isCopying}
                    className="w-full flex justify-center items-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    {isCopying ? "Applying..." : <><Check className="w-4 h-4"/> Use This Timetable</>}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Advanced Settings */}
        {profile && (
          <div className="rounded-2xl bg-white shadow-xl overflow-hidden border border-gray-200">
            <div className="bg-gray-50 p-6 border-b border-gray-200 flex items-center gap-3">
              <Key className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-bold text-gray-900">Advanced Settings</h2>
            </div>
            
            <div className="p-6 space-y-8">
              {/* Reset Password */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-gray-100">
                <div>
                  <h3 className="font-bold text-gray-900">Reset Password</h3>
                  <p className="text-sm text-gray-500 mt-1">Receive an email to securely change your account password.</p>
                </div>
                <button 
                  onClick={handleResetPassword}
                  disabled={isResetting}
                  className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-gray-50 disabled:opacity-50 whitespace-nowrap"
                >
                  {isResetting ? "Sending..." : "Send Reset Link"}
                </button>
              </div>

              {/* Danger Zone */}
              <div className="bg-red-50 rounded-xl border border-red-200 p-6">
                <div className="flex items-center gap-2 text-red-700 mb-4">
                  <AlertTriangle className="w-5 h-5" />
                  <h3 className="font-bold">Danger Zone</h3>
                </div>
                <p className="text-sm text-red-800 mb-4">
                  This will permanently delete your profile, timetable, attendance records, alerts, and settings. <strong>This action cannot be undone.</strong>
                </p>
                
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-red-900">Type DELETE to confirm</label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input 
                      type="text" 
                      value={deleteConfirmation}
                      onChange={(e) => setDeleteConfirmation(e.target.value)}
                      placeholder="DELETE"
                      className="flex-1 bg-white border border-red-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent uppercase"
                    />
                    <button 
                      onClick={handleDeleteProfile}
                      disabled={isDeleting || deleteConfirmation !== "DELETE"}
                      className="flex items-center justify-center gap-2 bg-red-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-red-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      <Trash2 className="w-4 h-4" /> {isDeleting ? "Deleting..." : "Delete My Profile"}
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}

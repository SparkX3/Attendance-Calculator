"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/firebase/config";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { GraduationCap, Calendar, AlertTriangle } from "lucide-react";

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  
  const [fullName, setFullName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [college, setCollege] = useState("");
  const [semester, setSemester] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      router.push("/login");
    } else {
      if (profile) {
        setFullName(profile.fullName || "");
        setRollNumber(profile.rollNumber || "");
        setCollege(profile.college || "");
        setSemester(profile.semester || "");
      } else if (user.displayName) {
        setFullName(user.displayName);
      }
    }
  }, [user, profile, router]);

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
        // Keep createdAt if it already exists, otherwise add it.
        // setDoc with merge:true would be safer but we might need to create from scratch. 
        // We'll just set updatedAt for now.
        createdAt: profile?.createdAt || serverTimestamp(),
      });
      await refreshProfile();
      // If it's a new profile, go to upload. If existing, go back to dashboard.
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

  const handleChangeTimetable = () => {
    const confirmChange = window.confirm("Changing timetable may affect future attendance records. Do you want to continue?");
    if (confirmChange) {
      router.push("/upload");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-xl sm:p-12 mb-8">
        <div className="mb-8 text-center flex flex-col items-center">
          <div className="mb-4 rounded-full bg-indigo-100 p-4 text-indigo-600">
            <GraduationCap className="h-10 w-10" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{profile ? "Edit Profile" : "Complete Your Profile"}</h1>
          <p className="mt-2 text-sm text-gray-600">
            {profile ? "Update your details below." : "We need a few more details to set up your account."}
          </p>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">Full Name</label>
              <input
                type="text"
                id="fullName"
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="rollNumber" className="block text-sm font-medium text-gray-700">Roll Number</label>
              <input
                type="text"
                id="rollNumber"
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="semester" className="block text-sm font-medium text-gray-700">Semester</label>
              <select
                id="semester"
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
              >
                <option value="" disabled>Select</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                  <option key={s} value={s.toString()}>Semester {s}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="college" className="block text-sm font-medium text-gray-700">College Name</label>
              <input
                type="text"
                id="college"
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value={college}
                onChange={(e) => setCollege(e.target.value)}
              />
            </div>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex gap-4 pt-4">
            {profile && (
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="w-full rounded-md bg-white px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:outline-none"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? "Saving..." : (profile ? "Save Changes" : "Save Profile & Continue")}
            </button>
          </div>
        </form>
      </div>

      {profile && (
        <div className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-xl sm:p-12 border-t-4 border-orange-500">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-orange-100 p-3 text-orange-600 shrink-0">
               <Calendar className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                Timetable Settings
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                You can upload a new timetable or re-configure your current one manually. 
              </p>
              <div className="mt-4 bg-orange-50 text-orange-800 text-xs p-3 rounded-md flex gap-2 items-start border border-orange-200">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <p>Warning: Modifying your timetable might misalign with your past attendance records.</p>
              </div>
              <button
                onClick={handleChangeTimetable}
                className="mt-6 w-full sm:w-auto rounded-md bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors"
              >
                Change Timetable
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

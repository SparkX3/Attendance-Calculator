"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { storage, db } from "@/firebase/config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { UploadCloud, FileType, CheckCircle, AlertCircle } from "lucide-react";
import { extractTimetableFromImage } from "@/services/timetableExtractor";

export default function UploadTimetable() {
  const { user } = useAuth();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user && !loading) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file || !user) return;
    setLoading(true);
    setStatus("Uploading to secure storage...");

    try {
      let downloadURL = "https://placeholder-url.com/file";
      
      try {
        // 1. Upload to Firebase Storage with an 8-second timeout
        const storageRef = ref(storage, `users/${user.uid}/uploads/${Date.now()}_${file.name}`);
        
        const uploadPromise = uploadBytes(storageRef, file);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Storage Timeout. Did you enable Firebase Storage in the console?")), 8000)
        );
        
        await Promise.race([uploadPromise, timeoutPromise]);
        downloadURL = await getDownloadURL(storageRef);

        // 2. Save metadata to Firestore
        setStatus("Saving file metadata...");
        await addDoc(collection(db, `users/${user.uid}/uploads`), {
          fileName: file.name,
          fileUrl: downloadURL,
          fileType: file.type,
          uploadedAt: serverTimestamp(),
        });
      } catch (uploadError) {
        console.warn("Upload skipped or failed:", uploadError);
        // We catch the error but don't stop the flow so the user can test the app
        setStatus("Storage not ready. Proceeding with mock extraction...");
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // 3. Extract Timetable
      setStatus("AI is analyzing your timetable...");
      const extractedData = await extractTimetableFromImage(downloadURL);

      // 4. Cache data and redirect to confirmation
      localStorage.setItem("temp_extracted_timetable", JSON.stringify(extractedData));
      router.push("/confirm");

    } catch (error: any) {
      console.error("Upload failed", error);
      setStatus("Error: " + error.message);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-xl sm:p-12 text-center">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 rounded-full bg-indigo-100 p-4 text-indigo-600">
            <UploadCloud className="h-10 w-10" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Upload Timetable</h1>
          <p className="mt-2 text-sm text-gray-600">
            Upload an image, screenshot, or PDF of your timetable. Our AI will extract your classes automatically.
          </p>
        </div>

        {!loading ? (
          <div className="space-y-6">
            <div 
              className="mt-2 flex justify-center rounded-lg border border-dashed border-gray-900/25 px-6 py-10 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="text-center">
                <FileType className="mx-auto h-12 w-12 text-gray-300" aria-hidden="true" />
                <div className="mt-4 flex text-sm leading-6 text-gray-600 justify-center">
                  <span className="relative rounded-md bg-transparent font-semibold text-indigo-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2 hover:text-indigo-500">
                    {file ? file.name : "Select a file to upload"}
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="sr-only"
                    accept="image/*,application/pdf"
                    onChange={handleFileChange}
                  />
                </div>
                <p className="text-xs leading-5 text-gray-600 mt-2">PNG, JPG, PDF up to 10MB</p>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => router.push("/confirm")}
                className="w-full rounded-md bg-white px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:outline-none"
              >
                Skip & Setup Manually
              </button>
              
              <button
                onClick={handleUpload}
                disabled={!file}
                className="w-full rounded-md bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
              >
                Process Timetable
              </button>
            </div>
          </div>
        ) : (
          <div className="py-12 flex flex-col items-center justify-center space-y-6">
             <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
             <p className="text-lg font-medium text-gray-900 animate-pulse">{status}</p>
          </div>
        )}
      </div>
    </div>
  );
}

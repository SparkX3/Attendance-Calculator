// This is a modular service that can later be replaced with actual OCR/AI API (Tesseract, Vision API, Gemini, etc.)

export interface ExtractedLecture {
  id: string;
  day: string;
  time: string;
  lectureName: string;
  facultyName: string;
  roomNumber: string;
}

export const extractTimetableFromImage = async (fileUrl: string): Promise<ExtractedLecture[]> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Mock extracted data
  // Ensures days are detected and lectures are somewhat sequenced
  return [
    {
      id: "mock1",
      day: "Monday",
      time: "09:00 AM",
      lectureName: "Data Structures",
      facultyName: "Dr. Smith",
      roomNumber: "101",
    },
    {
      id: "mock2",
      day: "Monday",
      time: "11:00 AM",
      lectureName: "Operating Systems",
      facultyName: "Prof. Johnson",
      roomNumber: "102",
    },
    {
      id: "mock3",
      day: "Tuesday",
      time: "10:00 AM",
      lectureName: "Database Systems",
      facultyName: "Mr. Lee",
      roomNumber: "Lab 1",
    },
    {
      id: "mock4",
      day: "Wednesday",
      time: "09:00 AM",
      lectureName: "Data Structures (Tutorial)",
      facultyName: "Dr. Smith",
      roomNumber: "205",
    },
  ];
};

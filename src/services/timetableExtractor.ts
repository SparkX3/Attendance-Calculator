// This is a modular service that can later be replaced with actual OCR/AI API (Tesseract, Vision API, Gemini, etc.)

export interface ExtractedLecture {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
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
      startTime: "09:00",
      endTime: "10:00",
      lectureName: "Data Structures",
      facultyName: "Dr. Smith",
      roomNumber: "101",
    },
    {
      id: "mock2",
      day: "Monday",
      startTime: "11:00",
      endTime: "12:00",
      lectureName: "Operating Systems",
      facultyName: "Prof. Johnson",
      roomNumber: "102",
    },
    {
      id: "mock3",
      day: "Tuesday",
      startTime: "10:00",
      endTime: "11:00",
      lectureName: "Database Systems",
      facultyName: "Mr. Lee",
      roomNumber: "Lab 1",
    },
    {
      id: "mock4",
      day: "Wednesday",
      startTime: "09:00",
      endTime: "10:00",
      lectureName: "Data Structures (Tutorial)",
      facultyName: "Dr. Smith",
      roomNumber: "205",
    },
  ];
};

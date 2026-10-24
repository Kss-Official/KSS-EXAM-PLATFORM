import { useState, useEffect, useCallback } from "react";
import { 
  BookOpen, 
  ChevronLeft, 
  ChevronRight, 
  Flag, 
  LogOut,
  Menu
} from "lucide-react";
import type { 
  CandidateSession, 
  AutosaveStatus
} from "../../types/candidate";
import { 
  saveCandidateSession
} from "../../services/candidateSessionStorage";
import {
  startCandidateAttempt,
  saveCandidateAnswer,
  type SubmissionResponse
} from "../../services/api";
import ExamTimer from "../../components/candidate/ExamTimer";
import QuestionNavigator from "../../components/candidate/QuestionNavigator";
import SubmitConfirmationDialog from "../../components/candidate/SubmitConfirmationDialog";
import ExitConfirmationDialog from "../../components/candidate/ExitConfirmationDialog";
import kalpanaaLogo from "../../assets/kalpanaa_logo.png";

/** 60 Full Questions across 4 Dedicated Sections (15 per section) */
const DEFAULT_60_QUESTIONS = [
  // SECTION A: Quantitative Aptitude (1 - 15)
  {
    id: 1,
    section: "Section A: Quantitative Aptitude",
    questionText: "Which principle of object-oriented programming allows one class to acquire properties and methods from another class?",
    options: [
      { id: 101, optionLabel: "A", optionText: "Encapsulation" },
      { id: 102, optionLabel: "B", optionText: "Inheritance" },
      { id: 103, optionLabel: "C", optionText: "Polymorphism" },
      { id: 104, optionLabel: "D", optionText: "Abstraction" }
    ]
  },
  {
    id: 2,
    section: "Section A: Quantitative Aptitude",
    questionText: "A train running at 54 km/hr crosses a bridge of length 250 meters in 30 seconds. What is the length of the train?",
    options: [
      { id: 105, optionLabel: "A", optionText: "150 meters" },
      { id: 106, optionLabel: "B", optionText: "200 meters" },
      { id: 107, optionLabel: "C", optionText: "250 meters" },
      { id: 108, optionLabel: "D", optionText: "180 meters" }
    ]
  },
  {
    id: 3,
    section: "Section A: Quantitative Aptitude",
    questionText: "If the ratio of two numbers is 3:5 and their sum is 160, what is the value of the greater number?",
    options: [
      { id: 109, optionLabel: "A", optionText: "80" },
      { id: 110, optionLabel: "B", optionText: "100" },
      { id: 111, optionLabel: "C", optionText: "96" },
      { id: 112, optionLabel: "D", optionText: "110" }
    ]
  },
  {
    id: 4,
    section: "Section A: Quantitative Aptitude",
    questionText: "A shopkeeper sells an article for Γé╣840 gaining a profit of 20%. What was the original cost price?",
    options: [
      { id: 113, optionLabel: "A", optionText: "Γé╣700" },
      { id: 114, optionLabel: "B", optionText: "Γé╣680" },
      { id: 115, optionLabel: "C", optionText: "Γé╣720" },
      { id: 116, optionLabel: "D", optionText: "Γé╣750" }
    ]
  },
  {
    id: 5,
    section: "Section A: Quantitative Aptitude",
    questionText: "What is the compound interest on Γé╣10,000 for 2 years at an annual interest rate of 10% compounded annually?",
    options: [
      { id: 117, optionLabel: "A", optionText: "Γé╣2,000" },
      { id: 118, optionLabel: "B", optionText: "Γé╣2,100" },
      { id: 119, optionLabel: "C", optionText: "Γé╣2,050" },
      { id: 120, optionLabel: "D", optionText: "Γé╣2,200" }
    ]
  },
  {
    id: 6,
    section: "Section A: Quantitative Aptitude",
    questionText: "A vehicle covers a distance of 360 km in 4.5 hours. What is its average speed in meters per second?",
    options: [
      { id: 121, optionLabel: "A", optionText: "20 m/s" },
      { id: 122, optionLabel: "B", optionText: "22.2 m/s" },
      { id: 123, optionLabel: "C", optionText: "25 m/s" },
      { id: 124, optionLabel: "D", optionText: "18 m/s" }
    ]
  },
  {
    id: 7,
    section: "Section A: Quantitative Aptitude",
    questionText: "If 12 engineers can configure a distributed network cluster in 15 days, in how many days can 20 engineers complete it?",
    options: [
      { id: 125, optionLabel: "A", optionText: "8 days" },
      { id: 126, optionLabel: "B", optionText: "9 days" },
      { id: 127, optionLabel: "C", optionText: "10 days" },
      { id: 128, optionLabel: "D", optionText: "12 days" }
    ]
  },
  {
    id: 8,
    section: "Section A: Quantitative Aptitude",
    questionText: "What is the average of the first five prime numbers (2, 3, 5, 7, 11)?",
    options: [
      { id: 129, optionLabel: "A", optionText: "5.6" },
      { id: 130, optionLabel: "B", optionText: "5.2" },
      { id: 131, optionLabel: "C", optionText: "4.8" },
      { id: 132, optionLabel: "D", optionText: "6.2" }
    ]
  },
  {
    id: 9,
    section: "Section A: Quantitative Aptitude",
    questionText: "In a cohort of 60 candidates, 40% are placed in Cloud Ops. How many candidates are placed in other domains?",
    options: [
      { id: 133, optionLabel: "A", optionText: "24" },
      { id: 134, optionLabel: "B", optionText: "36" },
      { id: 135, optionLabel: "C", optionText: "32" },
      { id: 136, optionLabel: "D", optionText: "28" }
    ]
  },
  {
    id: 10,
    section: "Section A: Quantitative Aptitude",
    questionText: "Find the next missing number in the progression: 4, 9, 16, 25, 36, ?",
    options: [
      { id: 137, optionLabel: "A", optionText: "47" },
      { id: 138, optionLabel: "B", optionText: "49" },
      { id: 139, optionLabel: "C", optionText: "51" },
      { id: 140, optionLabel: "D", optionText: "64" }
    ]
  },
  {
    id: 11,
    section: "Section A: Quantitative Aptitude",
    questionText: "Pipe A fills a buffer pool in 6 hours, while Pipe B drains it in 9 hours. How long to fill if both operate simultaneously?",
    options: [
      { id: 141, optionLabel: "A", optionText: "15 hours" },
      { id: 142, optionLabel: "B", optionText: "18 hours" },
      { id: 143, optionLabel: "C", optionText: "12 hours" },
      { id: 144, optionLabel: "D", optionText: "14 hours" }
    ]
  },
  {
    id: 12,
    section: "Section A: Quantitative Aptitude",
    questionText: "The perimeter of a square hardware module is 64 cm. What is the surface area of this module?",
    options: [
      { id: 145, optionLabel: "A", optionText: "256 sq cm" },
      { id: 146, optionLabel: "B", optionText: "128 sq cm" },
      { id: 147, optionLabel: "C", optionText: "196 sq cm" },
      { id: 148, optionLabel: "D", optionText: "225 sq cm" }
    ]
  },
  {
    id: 13,
    section: "Section A: Quantitative Aptitude",
    questionText: "What percentage of a 2.5 GB database file is 125 MB?",
    options: [
      { id: 149, optionLabel: "A", optionText: "2.5%" },
      { id: 150, optionLabel: "B", optionText: "5%" },
      { id: 151, optionLabel: "C", optionText: "7.5%" },
      { id: 152, optionLabel: "D", optionText: "10%" }
    ]
  },
  {
    id: 14,
    section: "Section A: Quantitative Aptitude",
    questionText: "What is the diagonal length of a display panel with width 12 inches and height 5 inches?",
    options: [
      { id: 153, optionLabel: "A", optionText: "13 inches" },
      { id: 154, optionLabel: "B", optionText: "15 inches" },
      { id: 155, optionLabel: "C", optionText: "17 inches" },
      { id: 156, optionLabel: "D", optionText: "14 inches" }
    ]
  },
  {
    id: 15,
    section: "Section A: Quantitative Aptitude",
    questionText: "Evaluate the precedence expression: 48 ├╖ (6 ├ù 2) + 3 ├ù (8 - 5):",
    options: [
      { id: 157, optionLabel: "A", optionText: "13" },
      { id: 158, optionLabel: "B", optionText: "11" },
      { id: 159, optionLabel: "C", optionText: "17" },
      { id: 160, optionLabel: "D", optionText: "15" }
    ]
  },

  // SECTION B: Logical Reasoning (16 - 30)
  {
    id: 16,
    section: "Section B: Logical Reasoning",
    questionText: "Pointing to a photograph, a woman says: 'He is the only son of my father's only daughter.' How is the person related to the woman?",
    options: [
      { id: 161, optionLabel: "A", optionText: "Brother" },
      { id: 162, optionLabel: "B", optionText: "Son" },
      { id: 163, optionLabel: "C", optionText: "Nephew" },
      { id: 164, optionLabel: "D", optionText: "Father" }
    ]
  },
  {
    id: 17,
    section: "Section B: Logical Reasoning",
    questionText: "If CLOCK is coded as KCOLC in a cipher, how will WATCH be written in that same cipher?",
    options: [
      { id: 165, optionLabel: "A", optionText: "HCTAW" },
      { id: 166, optionLabel: "B", optionText: "HTCAW" },
      { id: 167, optionLabel: "C", optionText: "HACTW" },
      { id: 168, optionLabel: "D", optionText: "WHTAC" }
    ]
  },
  {
    id: 18,
    section: "Section B: Logical Reasoning",
    questionText: "Statement: 'All microservices communicate via REST. Some REST endpoints use JSON.' Which conclusion is valid?",
    options: [
      { id: 169, optionLabel: "A", optionText: "All microservices use JSON" },
      { id: 170, optionLabel: "B", optionText: "Some microservice communication uses JSON" },
      { id: 171, optionLabel: "C", optionText: "No microservices use JSON" },
      { id: 172, optionLabel: "D", optionText: "All JSON endpoints are microservices" }
    ]
  },
  {
    id: 19,
    section: "Section B: Logical Reasoning",
    questionText: "Find the odd one out among the following protocol standards:",
    options: [
      { id: 173, optionLabel: "A", optionText: "HTTP" },
      { id: 174, optionLabel: "B", optionText: "FTP" },
      { id: 175, optionLabel: "C", optionText: "SMTP" },
      { id: 176, optionLabel: "D", optionText: "JPEG" }
    ]
  },
  {
    id: 20,
    section: "Section B: Logical Reasoning",
    questionText: "A person travels 5 km North, turns right and walks 3 km, then turns right and walks 5 km. How far is he from the starting point?",
    options: [
      { id: 177, optionLabel: "A", optionText: "3 km East" },
      { id: 178, optionLabel: "B", optionText: "5 km North" },
      { id: 179, optionLabel: "C", optionText: "3 km West" },
      { id: 180, optionLabel: "D", optionText: "8 km South" }
    ]
  },
  {
    id: 21,
    section: "Section B: Logical Reasoning",
    questionText: "Complete the alphanumeric sequence: B2D, D4F, F6H, H8J, ?",
    options: [
      { id: 181, optionLabel: "A", optionText: "J10L" },
      { id: 182, optionLabel: "B", optionText: "J12K" },
      { id: 183, optionLabel: "C", optionText: "K10L" },
      { id: 184, optionLabel: "D", optionText: "I10K" }
    ]
  },
  {
    id: 22,
    section: "Section B: Logical Reasoning",
    questionText: "If '+' means multiply, '-' means divide, '├ù' means add, and '├╖' means subtract, calculate: 15 ├ù 5 + 4 - 2 ├╖ 3:",
    options: [
      { id: 185, optionLabel: "A", optionText: "22" },
      { id: 186, optionLabel: "B", optionText: "25" },
      { id: 187, optionLabel: "C", optionText: "20" },
      { id: 188, optionLabel: "D", optionText: "28" }
    ]
  },
  {
    id: 23,
    section: "Section B: Logical Reasoning",
    questionText: "In a queue of 40 developers, Rohit is 14th from the front. What is his position from the rear end?",
    options: [
      { id: 189, optionLabel: "A", optionText: "26th" },
      { id: 190, optionLabel: "B", optionText: "27th" },
      { id: 191, optionLabel: "C", optionText: "28th" },
      { id: 192, optionLabel: "D", optionText: "25th" }
    ]
  },
  {
    id: 24,
    section: "Section B: Logical Reasoning",
    questionText: "Which word cannot be formed using the letters of the keyword 'AUTHENTICATION'?",
    options: [
      { id: 193, optionLabel: "A", optionText: "NATION" },
      { id: 194, optionLabel: "B", optionText: "ACTION" },
      { id: 195, optionLabel: "C", optionText: "AUTHENTIC" },
      { id: 196, optionLabel: "D", optionText: "ROUTINE" }
    ]
  },
  {
    id: 25,
    section: "Section B: Logical Reasoning",
    questionText: "If Monday falls on January 1st of a non-leap year, which day of the week will January 31st be?",
    options: [
      { id: 197, optionLabel: "A", optionText: "Tuesday" },
      { id: 198, optionLabel: "B", optionText: "Wednesday" },
      { id: 199, optionLabel: "C", optionText: "Thursday" },
      { id: 200, optionLabel: "D", optionText: "Friday" }
    ]
  },
  {
    id: 26,
    section: "Section B: Logical Reasoning",
    questionText: "A cube has six faces painted with different colors. Red is opposite Blue. Green is between Red and Blue. What is opposite Green?",
    options: [
      { id: 201, optionLabel: "A", optionText: "Yellow or White" },
      { id: 202, optionLabel: "B", optionText: "Red" },
      { id: 203, optionLabel: "C", optionText: "Blue" },
      { id: 204, optionLabel: "D", optionText: "Cannot be determined" }
    ]
  },
  {
    id: 27,
    section: "Section B: Logical Reasoning",
    questionText: "Five nodes A, B, C, D, E are in a cluster. B is faster than A but slower than C. D is faster than E but slower than A. Which is fastest?",
    options: [
      { id: 205, optionLabel: "A", optionText: "C" },
      { id: 206, optionLabel: "B", optionText: "B" },
      { id: 207, optionLabel: "C", optionText: "D" },
      { id: 208, optionLabel: "D", optionText: "A" }
    ]
  },
  {
    id: 28,
    section: "Section B: Logical Reasoning",
    questionText: "Choose the correct analogy: Compiler : Bytecode :: Interpreter : ?",
    options: [
      { id: 209, optionLabel: "A", optionText: "Machine Code / Direct Execution" },
      { id: 210, optionLabel: "B", optionText: "Assembly" },
      { id: 211, optionLabel: "C", optionText: "High Level Syntax" },
      { id: 212, optionLabel: "D", optionText: "Linker" }
    ]
  },
  {
    id: 29,
    section: "Section B: Logical Reasoning",
    questionText: "Select the pair that exhibits the same relationship as 'ENCRYPT : DECRYPT':",
    options: [
      { id: 213, optionLabel: "A", optionText: "Compress : Decompress" },
      { id: 214, optionLabel: "B", optionText: "Store : Read" },
      { id: 215, optionLabel: "C", optionText: "Compile : Link" },
      { id: 216, optionLabel: "D", optionText: "Lock : Secure" }
    ]
  },
  {
    id: 30,
    section: "Section B: Logical Reasoning",
    questionText: "In a binary matrix of size 3x3, if each cell has either 0 or 1, what is the total number of distinct matrix configurations?",
    options: [
      { id: 217, optionLabel: "A", optionText: "512 (2^9)" },
      { id: 218, optionLabel: "B", optionText: "256 (2^8)" },
      { id: 219, optionLabel: "C", optionText: "1024 (2^10)" },
      { id: 220, optionLabel: "D", optionText: "64" }
    ]
  },

  // SECTION C: Technical Core (31 - 45)
  {
    id: 31,
    section: "Section C: Technical Core",
    questionText: "Which SQL command is commonly used to retrieve records from a database table without mutating state?",
    options: [
      { id: 221, optionLabel: "A", optionText: "SELECT" },
      { id: 222, optionLabel: "B", optionText: "FETCH ONLY" },
      { id: 223, optionLabel: "C", optionText: "OPEN TABLE" },
      { id: 224, optionLabel: "D", optionText: "PULL ROWS" }
    ]
  },
  {
    id: 32,
    section: "Section C: Technical Core",
    questionText: "Which data structure follows the Last In, First Out (LIFO) operational principle?",
    options: [
      { id: 225, optionLabel: "A", optionText: "Stack" },
      { id: 226, optionLabel: "B", optionText: "Queue" },
      { id: 227, optionLabel: "C", optionText: "Linked List" },
      { id: 228, optionLabel: "D", optionText: "Binary Tree" }
    ]
  },
  {
    id: 33,
    section: "Section C: Technical Core",
    questionText: "What is the worst-case time complexity of searching for an element in an unsorted array of size N?",
    options: [
      { id: 229, optionLabel: "A", optionText: "O(N)" },
      { id: 230, optionLabel: "B", optionText: "O(log N)" },
      { id: 231, optionLabel: "C", optionText: "O(1)" },
      { id: 232, optionLabel: "D", optionText: "O(N log N)" }
    ]
  },
  {
    id: 34,
    section: "Section C: Technical Core",
    questionText: "In Java Spring Boot, which annotation marks a class as a component providing specialized service business logic?",
    options: [
      { id: 233, optionLabel: "A", optionText: "@Service" },
      { id: 234, optionLabel: "B", optionText: "@Controller" },
      { id: 235, optionLabel: "C", optionText: "@Repository" },
      { id: 236, optionLabel: "D", optionText: "@Configuration" }
    ]
  },
  {
    id: 35,
    section: "Section C: Technical Core",
    questionText: "What is the primary role of Inversion of Control (IoC) in modern enterprise frameworks?",
    options: [
      { id: 237, optionLabel: "A", optionText: "Decouple component creation and dependency wiring" },
      { id: 238, optionLabel: "B", optionText: "Directly compile Java into byte arrays" },
      { id: 239, optionLabel: "C", optionText: "Execute load testing scenarios" },
      { id: 240, optionLabel: "D", optionText: "Encrypt database credentials" }
    ]
  },
  {
    id: 36,
    section: "Section C: Technical Core",
    questionText: "Which HTTP status code signifies that a client request lacks valid authentication credentials?",
    options: [
      { id: 241, optionLabel: "A", optionText: "401 Unauthorized" },
      { id: 242, optionLabel: "B", optionText: "403 Forbidden" },
      { id: 243, optionLabel: "C", optionText: "404 Not Found" },
      { id: 244, optionLabel: "D", optionText: "500 Internal Error" }
    ]
  },
  {
    id: 37,
    section: "Section C: Technical Core",
    questionText: "In relational database management systems, what does the ACID property 'Atomicity' guarantee?",
    options: [
      { id: 245, optionLabel: "A", optionText: "All transaction steps succeed or all are rolled back" },
      { id: 246, optionLabel: "B", optionText: "Data remains consistent across all replicas" },
      { id: 247, optionLabel: "C", optionText: "Transactions execute isolated without interference" },
      { id: 248, optionLabel: "D", optionText: "Committed data persists permanently across power loss" }
    ]
  },
  {
    id: 38,
    section: "Section C: Technical Core",
    questionText: "Which index data structure is most widely used by default in relational databases (e.g. PostgreSQL, MySQL)?",
    options: [
      { id: 249, optionLabel: "A", optionText: "B-Tree (Balanced Tree)" },
      { id: 250, optionLabel: "B", optionText: "Hash Table" },
      { id: 251, optionLabel: "C", optionText: "Binary Search Tree" },
      { id: 252, optionLabel: "D", optionText: "Trie" }
    ]
  },
  {
    id: 39,
    section: "Section C: Technical Core",
    questionText: "In React, what hook is used to perform side effects like data fetching or subscription cleanup?",
    options: [
      { id: 253, optionLabel: "A", optionText: "useEffect" },
      { id: 254, optionLabel: "B", optionText: "useState" },
      { id: 255, optionLabel: "C", optionText: "useMemo" },
      { id: 256, optionLabel: "D", optionText: "useContext" }
    ]
  },
  {
    id: 40,
    section: "Section C: Technical Core",
    questionText: "What is the key advantage of using connection pooling in backend database drivers?",
    options: [
      { id: 257, optionLabel: "A", optionText: "Reuses existing TCP connections to reduce handshake overhead" },
      { id: 258, optionLabel: "B", optionText: "Encrypts all SQL tables automatically" },
      { id: 259, optionLabel: "C", optionText: "Replaces database constraints" },
      { id: 260, optionLabel: "D", optionText: "Prevents duplicate primary key inserts" }
    ]
  },
  {
    id: 41,
    section: "Section C: Technical Core",
    questionText: "Which HTTP request method is inherently idempotent according to RFC specifications?",
    options: [
      { id: 261, optionLabel: "A", optionText: "GET and PUT" },
      { id: 262, optionLabel: "B", optionText: "POST only" },
      { id: 263, optionLabel: "C", optionText: "PATCH only" },
      { id: 264, optionLabel: "D", optionText: "CONNECT" }
    ]
  },
  {
    id: 42,
    section: "Section C: Technical Core",
    questionText: "What type of join in SQL returns all records from the left table and matched records from the right table?",
    options: [
      { id: 265, optionLabel: "A", optionText: "LEFT OUTER JOIN" },
      { id: 266, optionLabel: "B", optionText: "INNER JOIN" },
      { id: 267, optionLabel: "C", optionText: "RIGHT OUTER JOIN" },
      { id: 268, optionLabel: "D", optionText: "CROSS JOIN" }
    ]
  },
  {
    id: 43,
    section: "Section C: Technical Core",
    questionText: "In Java memory management, where are object instances allocated at runtime?",
    options: [
      { id: 269, optionLabel: "A", optionText: "Heap Memory" },
      { id: 270, optionLabel: "B", optionText: "Call Stack" },
      { id: 271, optionLabel: "C", optionText: "Register File" },
      { id: 272, optionLabel: "D", optionText: "Metaspace only" }
    ]
  },
  {
    id: 44,
    section: "Section C: Technical Core",
    questionText: "Which transport protocol guarantees ordered, reliable, and error-checked delivery of a stream of octets?",
    options: [
      { id: 273, optionLabel: "A", optionText: "TCP (Transmission Control Protocol)" },
      { id: 274, optionLabel: "B", optionText: "UDP (User Datagram Protocol)" },
      { id: 275, optionLabel: "C", optionText: "IP (Internet Protocol)" },
      { id: 276, optionLabel: "D", optionText: "ICMP" }
    ]
  },
  {
    id: 45,
    section: "Section C: Technical Core",
    questionText: "What is the primary function of a reverse proxy like NGINX in production architectures?",
    options: [
      { id: 277, optionLabel: "A", optionText: "Load balancing, SSL termination, and routing requests to internal servers" },
      { id: 278, optionLabel: "B", optionText: "Executing SQL transactions" },
      { id: 279, optionLabel: "C", optionText: "Compiling JavaScript files" },
      { id: 280, optionLabel: "D", optionText: "Managing database migrations" }
    ]
  },

  // SECTION D: Verbal Ability (46 - 60)
  {
    id: 46,
    section: "Section D: Verbal Ability",
    questionText: "Choose the word most nearly opposite in meaning (antonym) to 'EXPEDITE':",
    options: [
      { id: 281, optionLabel: "A", optionText: "Delay / Impede" },
      { id: 282, optionLabel: "B", optionText: "Accelerate" },
      { id: 283, optionLabel: "C", optionText: "Promote" },
      { id: 284, optionLabel: "D", optionText: "Dispatch" }
    ]
  },
  {
    id: 47,
    section: "Section D: Verbal Ability",
    questionText: "Select the correctly spelt word from the options below:",
    options: [
      { id: 285, optionLabel: "A", optionText: "Accommodate" },
      { id: 286, optionLabel: "B", optionText: "Acommodate" },
      { id: 287, optionLabel: "C", optionText: "Accomodate" },
      { id: 288, optionLabel: "D", optionText: "Acomodate" }
    ]
  },
  {
    id: 48,
    section: "Section D: Verbal Ability",
    questionText: "Fill in the blank with the appropriate preposition: 'The team adheres strictly _____ engineering standards.'",
    options: [
      { id: 289, optionLabel: "A", optionText: "to" },
      { id: 290, optionLabel: "B", optionText: "with" },
      { id: 291, optionLabel: "C", optionText: "at" },
      { id: 292, optionLabel: "D", optionText: "for" }
    ]
  },
  {
    id: 49,
    section: "Section D: Verbal Ability",
    questionText: "Choose the synonym for 'METICULOUS':",
    options: [
      { id: 293, optionLabel: "A", optionText: "Careful and precise" },
      { id: 294, optionLabel: "B", optionText: "Careless" },
      { id: 295, optionLabel: "C", optionText: "Hasty" },
      { id: 296, optionLabel: "D", optionText: "Uncertain" }
    ]
  },
  {
    id: 50,
    section: "Section D: Verbal Ability",
    questionText: "Identify the grammatically correct sentence:",
    options: [
      { id: 297, optionLabel: "A", optionText: "Neither the manager nor the engineers were present at the standup." },
      { id: 298, optionLabel: "B", optionText: "Neither the manager nor the engineers was present at the standup." },
      { id: 299, optionLabel: "C", optionText: "Neither the manager or the engineers was present at the standup." },
      { id: 300, optionLabel: "D", optionText: "Neither the manager nor the engineers is present at the standup." }
    ]
  },
  {
    id: 51,
    section: "Section D: Verbal Ability",
    questionText: "What does the idiom 'Bite the bullet' mean?",
    options: [
      { id: 301, optionLabel: "A", optionText: "To face an inevitable grim situation with courage" },
      { id: 302, optionLabel: "B", optionText: "To make a rash and violent decision" },
      { id: 303, optionLabel: "C", optionText: "To surrender unconditionally" },
      { id: 304, optionLabel: "D", optionText: "To celebrate an unexpected milestone" }
    ]
  },
  {
    id: 52,
    section: "Section D: Verbal Ability",
    questionText: "Choose the word that best substitutes: 'A person with extensive knowledge in many subject domains':",
    options: [
      { id: 305, optionLabel: "A", optionText: "Polymath" },
      { id: 306, optionLabel: "B", optionText: "Novice" },
      { id: 307, optionLabel: "C", optionText: "Amateur" },
      { id: 308, optionLabel: "D", optionText: "Skeptic" }
    ]
  },
  {
    id: 53,
    section: "Section D: Verbal Ability",
    questionText: "Fill in the blank: 'Had she known about the deployment schedule, she _____ notified the stakeholders.'",
    options: [
      { id: 309, optionLabel: "A", optionText: "would have" },
      { id: 310, optionLabel: "B", optionText: "will have" },
      { id: 311, optionLabel: "C", optionText: "would" },
      { id: 312, optionLabel: "D", optionText: "will" }
    ]
  },
  {
    id: 54,
    section: "Section D: Verbal Ability",
    questionText: "Choose the antonym for 'CANDID':",
    options: [
      { id: 313, optionLabel: "A", optionText: "Evasive / Deceptive" },
      { id: 314, optionLabel: "B", optionText: "Frank" },
      { id: 315, optionLabel: "C", optionText: "Honest" },
      { id: 316, optionLabel: "D", optionText: "Direct" }
    ]
  },
  {
    id: 55,
    section: "Section D: Verbal Ability",
    questionText: "Select the sentence with proper punctuation and capitalisation:",
    options: [
      { id: 317, optionLabel: "A", optionText: "The system's throughput is optimal; however, latency requires profiling." },
      { id: 318, optionLabel: "B", optionText: "The systems throughput is optimal, however latency requires profiling." },
      { id: 319, optionLabel: "C", optionText: "The system's throughput is optimal however; latency requires profiling." },
      { id: 320, optionLabel: "D", optionText: "The systems' throughput is optimal; however latency requires profiling." }
    ]
  },
  {
    id: 56,
    section: "Section D: Verbal Ability",
    questionText: "Choose the correct meaning of the phrasal verb 'Phase out':",
    options: [
      { id: 321, optionLabel: "A", optionText: "Gradually discontinue the use or production of something" },
      { id: 322, optionLabel: "B", optionText: "Suddenly introduce a new feature" },
      { id: 323, optionLabel: "C", optionText: "Temporarily pause execution" },
      { id: 324, optionLabel: "D", optionText: "Accelerate delivery" }
    ]
  },
  {
    id: 57,
    section: "Section D: Verbal Ability",
    questionText: "Fill in the blank: 'The architect was praised for her _____ approach to distributed cloud reliability.'",
    options: [
      { id: 325, optionLabel: "A", optionText: "innovative" },
      { id: 326, optionLabel: "B", optionText: "innovatively" },
      { id: 327, optionLabel: "C", optionText: "innovation" },
      { id: 328, optionLabel: "D", optionText: "innovate" }
    ]
  },
  {
    id: 58,
    section: "Section D: Verbal Ability",
    questionText: "Choose the word most similar in meaning (synonym) to 'ROBUST':",
    options: [
      { id: 329, optionLabel: "A", optionText: "Resilient and sturdy" },
      { id: 330, optionLabel: "B", optionText: "Fragile" },
      { id: 331, optionLabel: "C", optionText: "Incomplete" },
      { id: 332, optionLabel: "D", optionText: "Volatile" }
    ]
  },
  {
    id: 59,
    section: "Section D: Verbal Ability",
    questionText: "Identify the part of speech of the word 'EFFICIENTLY' in: 'The caching layer serves requests efficiently.'",
    options: [
      { id: 333, optionLabel: "A", optionText: "Adverb" },
      { id: 334, optionLabel: "B", optionText: "Adjective" },
      { id: 335, optionLabel: "C", optionText: "Noun" },
      { id: 336, optionLabel: "D", optionText: "Conjunction" }
    ]
  },
  {
    id: 60,
    section: "Section D: Verbal Ability",
    questionText: "What is the logical conclusion of the passage: 'Automated testing reduces human regression errors, enabling faster release cadences.'?",
    options: [
      { id: 337, optionLabel: "A", optionText: "Automated testing contributes to higher software deployment velocity" },
      { id: 338, optionLabel: "B", optionText: "Human testers should be completely abolished" },
      { id: 339, optionLabel: "C", optionText: "Release cadences are independent of testing" },
      { id: 340, optionLabel: "D", optionText: "Manual testing is faster than automated testing" }
    ]
  }
];

interface CandidateExamPageProps {
  initialSession: CandidateSession;
  onFinalize: (
    reason: "manual_submit" | "timer_expired" | "candidate_exit",
    backendResult?: SubmissionResponse
  ) => void;
}

export default function CandidateExamPage({
  initialSession,
  onFinalize
}: CandidateExamPageProps) {
  const [session, setSession] = useState<CandidateSession>(initialSession);
  const [idx, setIdx] = useState<number>(initialSession?.currentQuestionIndex || 0);
  const [answers, setAnswers] = useState<Record<number, number>>(
    initialSession?.answers && Object.keys(initialSession.answers).length > 0
      ? initialSession.answers
      : { 1: 2, 4: 0 }
  );
  const [flags, setFlags] = useState<number[]>(
    initialSession?.flags && initialSession.flags.length > 0
      ? initialSession.flags
      : [3]
  );

  const [backendAttemptId, setBackendAttemptId] = useState<number | undefined>(initialSession?.backendAttemptId);
  const [assignedSet, setAssignedSet] = useState<string>(initialSession?.profile?.questionSetCode || "A");
  const [questions, setQuestions] = useState<any[]>(DEFAULT_60_QUESTIONS);
  const [loadingQuestions] = useState(false);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>("saved");
  void assignedSet; void loadingQuestions; void autosaveStatus;

  // Load questions from backend attempt on mount
  useEffect(() => {
    let isCancelled = false;

    const initializeAttempt = async () => {
      const dbCandId = session?.profile?.dbCandidateId;
      const assignedExamId = session?.profile?.assignedExamId;

      if (dbCandId && assignedExamId) {
        try {
          const attemptData = await startCandidateAttempt(dbCandId, assignedExamId);
          if (!isCancelled) {
            setBackendAttemptId(attemptData.attemptId);
            setAssignedSet(attemptData.questionSetCode || "A");

            if (attemptData.questions && attemptData.questions.length > 0) {
              setQuestions(attemptData.questions);
            }

            const deadlineStr = attemptData.deadlineAt || attemptData.expiresAt;
            if (deadlineStr) {
              const serverDeadline = new Date(deadlineStr).getTime();
              setSession(prev => ({
                ...prev,
                backendAttemptId: attemptData.attemptId,
                deadline: serverDeadline
              }));
            }

            if (attemptData.answers) {
              const answersMap = attemptData.answers;
              const restoredAnswers: Record<number, number> = {};
              attemptData.questions.forEach((q, qIndex) => {
                const qKey = q.id ?? q.questionId;
                const selectedOptId = qKey !== undefined ? answersMap[qKey] : undefined;
                if (selectedOptId !== undefined && selectedOptId !== null) {
                  const optIdx = q.options.findIndex(o => (o.id ?? o.optionId) === selectedOptId);
                  if (optIdx !== -1) {
                    restoredAnswers[qIndex + 1] = optIdx;
                  }
                }
              });
              if (Object.keys(restoredAnswers).length > 0) {
                setAnswers(restoredAnswers);
              }
            }
          }
        } catch (err) {
          console.warn("[CandidateExamPage] Backend attempt lookup fallback to 60 questions pool:", err);
        }
      }
    };

    initializeAttempt();

    return () => {
      isCancelled = true;
    };
  }, []);

  const total = questions.length > 0 ? questions.length : 60;
  const answeredCount = Object.keys(answers).length;
  const currentQuestion = questions[idx] || DEFAULT_60_QUESTIONS[idx % DEFAULT_60_QUESTIONS.length];

  // Helper to determine active section info
  const getSectionInfo = (qNum: number) => {
    if (qNum <= 15) {
      return { id: "A", title: "Section A: Quantitative Aptitude", range: "1 - 15" };
    } else if (qNum <= 30) {
      return { id: "B", title: "Section B: Logical Reasoning", range: "16 - 30" };
    } else if (qNum <= 45) {
      return { id: "C", title: "Section C: Technical Core", range: "31 - 45" };
    } else {
      return { id: "D", title: "Section D: Verbal Ability", range: "46 - 60" };
    }
  };

  const handleSelectAnswer = useCallback(async (optionIndex: number) => {
    const questionNum = idx + 1;
    const updatedAnswers = { ...answers, [questionNum]: optionIndex };
    setAnswers(updatedAnswers);

    saveCandidateSession({
      ...session,
      backendAttemptId,
      answers: updatedAnswers,
      flags,
      currentQuestionIndex: idx
    });

    if (backendAttemptId && currentQuestion) {
      const qId = currentQuestion.id ?? currentQuestion.questionId ?? questionNum;
      const chosenOpt = currentQuestion.options?.[optionIndex];
      const optId = chosenOpt?.id ?? chosenOpt?.optionId ?? optionIndex;

      if (qId !== undefined && optId !== undefined) {
        setAutosaveStatus("saving");
        try {
          await saveCandidateAnswer(backendAttemptId, qId, optId);
          setAutosaveStatus("saved");
        } catch {
          setAutosaveStatus("error");
        }
      }
    }
  }, [idx, answers, session, backendAttemptId, flags, currentQuestion]);

  const handleToggleFlag = useCallback(() => {
    const questionNum = idx + 1;
    let updatedFlags: number[];
    if (flags.includes(questionNum)) {
      updatedFlags = flags.filter(f => f !== questionNum);
    } else {
      updatedFlags = [...flags, questionNum];
    }
    setFlags(updatedFlags);

    saveCandidateSession({
      ...session,
      backendAttemptId,
      answers,
      flags: updatedFlags,
      currentQuestionIndex: idx
    });
  }, [idx, flags, session, backendAttemptId, answers]);

  const handleNavigateQuestion = useCallback((targetIndex: number) => {
    if (targetIndex >= 0 && targetIndex < total) {
      setIdx(targetIndex);
      saveCandidateSession({
        ...session,
        backendAttemptId,
        answers,
        flags,
        currentQuestionIndex: targetIndex
      });
    }
  }, [total, session, backendAttemptId, answers, flags]);

  const triggerFinalization = useCallback((reason: "manual_submit" | "timer_expired" | "candidate_exit") => {
    onFinalize(reason);
  }, [onFinalize]);

  return (
    <main className="exam-fullscreen-view">
      {/* Top Navbar */}
      <header className="exam-top-nav">
        <div className="exam-nav-left">
          <img 
            src={kalpanaaLogo} 
            alt="Kalpanaa Software Solutions" 
            className="exam-nav-logo" 
          />
          <div className="exam-dept-pill">
            <BookOpen size={13} />
            <span>{session.profile.department || "Development"} ΓÇö Assessment</span>
          </div>
        </div>

        {/* Center: Section Progress Indicator */}
        <div className="exam-nav-center">
          <div className="exam-progress-bar-wrap">
            <div 
              className="exam-progress-bar-fill" 
              style={{ width: `${(((idx % 15) + 1) / 15) * 100}%` }} 
            />
          </div>
          <span className="exam-progress-label">
            Progress: <strong>{((idx % 15) + 1)} / 15</strong>
          </span>
        </div>

        {/* Right: Timer, Profile, Exit */}
        <div className="exam-nav-right">
          <ExamTimer
            deadline={session.deadline}
            isSubmitted={session.isSubmitted}
            onExpire={() => triggerFinalization("timer_expired")}
          />

          <div className="exam-user-badge">
            <span className="exam-user-avatar">
              {(session?.profile?.name?.[0] || "J").toUpperCase()}
            </span>
            <div className="exam-user-info">
              <strong className="exam-user-name">{session?.profile?.name || "Jingyasa Priyadarsini"}</strong>
              <small className="exam-user-id">{session?.profile?.candidateId || "CAND-012-09"}</small>
            </div>
          </div>

          <button
            type="button"
            className="exam-exit-button"
            onClick={() => setShowExitModal(true)}
            title="Exit assessment"
          >
            <LogOut size={13} /> Exit
          </button>
        </div>
      </header>

      {/* Main 2-Column Assessment Workspace */}
      <div className="exam-content-grid">
        {/* Left: Question Card */}
        <article className="exam-question-card">
          <div className="exam-qcard-header">
            <div className="exam-qmeta-group">
              <span className="exam-qnum-tag">
                QUESTION {String(idx + 1).padStart(2, "0")}
              </span>
              <span className="exam-qsection-tag">
                <BookOpen size={12} /> {getSectionInfo(idx + 1).title}
              </span>
            </div>

            <button
              type="button"
              className={`exam-flag-btn ${flags.includes(idx + 1) ? "flagged" : ""}`}
              onClick={handleToggleFlag}
            >
              <Flag size={13} />
              <span>Flag for review</span>
            </button>
          </div>

          <div className="exam-qbody-content">
            <h2 className="exam-question-heading">
              {currentQuestion.questionText || currentQuestion.q}
            </h2>
            <p className="exam-question-hint">Select one answer from the options below.</p>

            {/* Options List */}
            <div className="exam-options-list" role="radiogroup">
              {currentQuestion.options.map((opt: any, i: number) => {
                const isSelected = answers[idx + 1] === i;
                const label = opt.displayLabel || opt.label || opt.optionLabel || String.fromCharCode(65 + i);
                const text = typeof opt === "string" ? opt : (opt.optionText || opt.text || "");

                return (
                  <button
                    key={opt.optionId || opt.id || `${idx}-${i}`}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleSelectAnswer(i)}
                    className={`exam-option-card ${isSelected ? "selected" : ""}`}
                  >
                    <div className="exam-option-left">
                      <span className={`exam-option-letter ${isSelected ? "selected" : ""}`}>
                        {label}
                      </span>
                      <span className="exam-option-text">{text}</span>
                    </div>

                    <span className={`exam-custom-radio ${isSelected ? "selected" : ""}`}>
                      {isSelected && <span className="exam-radio-inner-dot" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Card Actions: Previous & Next */}
          <div className="exam-qcard-footer">
            <button
              type="button"
              className="exam-btn-prev"
              disabled={idx === 0}
              onClick={() => handleNavigateQuestion(idx - 1)}
            >
              <ChevronLeft size={16} /> Previous
            </button>
            <button
              type="button"
              className="exam-btn-next"
              disabled={idx === total - 1}
              onClick={() => handleNavigateQuestion(idx + 1)}
            >
              Next question <ChevronRight size={16} />
            </button>
          </div>
        </article>

        {/* Right: Question Navigator Palette & Live Proctor Feed */}
        <QuestionNavigator
          total={total}
          currentIndex={idx}
          answers={answers}
          flags={flags}
          isOpen={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          onSelectQuestion={handleNavigateQuestion}
          onRequestSubmit={() => setShowSubmitModal(true)}
        />
      </div>

      {/* Mobile Drawer Trigger */}
      <button
        type="button"
        className="mobilepalette"
        onClick={() => setPaletteOpen(true)}
      >
        <Menu size={16} /> Question navigator
      </button>

      {/* Dialogs */}
      {showSubmitModal && (
        <SubmitConfirmationDialog
          total={total}
          answeredCount={answeredCount}
          flaggedCount={flags.length}
          onCancel={() => setShowSubmitModal(false)}
          onConfirm={() => triggerFinalization("manual_submit")}
        />
      )}

      {showExitModal && (
        <ExitConfirmationDialog
          answeredCount={answeredCount}
          total={total}
          onCancel={() => setShowExitModal(false)}
          onConfirmExit={() => triggerFinalization("candidate_exit")}
        />
      )}
    </main>
  );
}

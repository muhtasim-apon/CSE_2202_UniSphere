export interface CurriculumCourse {
  code: string
  name: string
  credits: number
}

export const CURRICULUM_COURSES: Record<number, CurriculumCourse[]> = {
  1: [
    { code: 'CSE 1101', name: 'Discrete Mathematics', credits: 3.0 },
    { code: 'CSE 1103', name: 'Computational Problem Solving', credits: 3.0 },
    { code: 'CSE 1104', name: 'Computational Problem Solving Lab', credits: 1.5 },
    { code: 'EEE 1105', name: 'Electrical Circuits', credits: 3.0 },
    { code: 'EEE 1106', name: 'Electrical Circuits Lab', credits: 0.75 },
    { code: 'MATH 1107', name: 'Differential and Integral Calculus', credits: 3.0 },
    { code: 'HUM 1109', name: 'History of Emergence of Bangladesh', credits: 2.0 },
  ],
  2: [
    { code: 'CSE 1201', name: 'Structured Programming', credits: 3.0 },
    { code: 'CSE 1202', name: 'Structured Programming Lab', credits: 1.5 },
    { code: 'CSE 1203', name: 'Digital Logic Design', credits: 3.0 },
    { code: 'CSE 1204', name: 'Digital Logic Design Lab', credits: 0.75 },
    { code: 'PHY 1205', name: 'Physics', credits: 3.0 },
    { code: 'PHY 1206', name: 'Physics Lab', credits: 0.75 },
    { code: 'MATH 1207', name: 'Linear Algebra', credits: 3.0 },
    { code: 'EEE 1209', name: 'Electronic Devices and Circuits', credits: 3.0 },
    { code: 'EEE 1210', name: 'Electronic Devices and Circuits Lab', credits: 0.75 },
  ],
  3: [
    { code: 'CSE 2101', name: 'Data Structures and Algorithms', credits: 3.0 },
    { code: 'CSE 2102', name: 'Data Structures and Algorithms Lab', credits: 1.5 },
    { code: 'CSE 2103', name: 'Object Oriented Design and Programming', credits: 3.0 },
    { code: 'CSE 2104', name: 'Object Oriented Design and Programming Lab', credits: 1.5 },
    { code: 'CSE 2105', name: 'Computer Architecture and Microprocessor', credits: 3.0 },
    { code: 'CSE 2106', name: 'Microprocessor and Assembly Language Lab', credits: 1.5 },
    { code: 'MATH 2107', name: 'Differential Equations, Laplace Transform and Fourier Analysis', credits: 3.0 },
    { code: 'CSE 2109', name: 'Data and Telecommunication', credits: 3.0 },
  ],
  4: [
    { code: 'CSE 2201', name: 'Database Management System', credits: 3.0 },
    { code: 'CSE 2202', name: 'Database Management System Lab', credits: 1.5 },
    { code: 'CSE 2203', name: 'Design and Analysis of Algorithms', credits: 3.0 },
    { code: 'CSE 2204', name: 'Design and Analysis of Algorithms Lab', credits: 1.5 },
    { code: 'CSE 2205', name: 'Microcontroller and Embedded System', credits: 3.0 },
    { code: 'CSE 2206', name: 'Microcontroller and Embedded System Lab', credits: 1.5 },
    { code: 'STAT 2207', name: 'Probability and Statistics', credits: 3.0 },
    { code: 'CSE 2209', name: 'Numerical Methods', credits: 3.0 },
  ],
  5: [
    { code: 'CSE 3101', name: 'Software Engineering', credits: 3.0 },
    { code: 'CSE 3102', name: 'Software Design and Development Project', credits: 1.5 },
    { code: 'CSE 3103', name: 'Web Engineering and Technology', credits: 3.0 },
    { code: 'CSE 3104', name: 'Web Engineering and Technology Lab', credits: 1.5 },
    { code: 'CSE 3105', name: 'Algorithm Engineering', credits: 3.0 },
    { code: 'STAT 3107', name: 'Random Processes', credits: 3.0 },
    { code: 'CSE 3109', name: 'Operating System', credits: 3.0 },
    { code: 'CSE 3110', name: 'Operating System Lab', credits: 1.5 },
  ],
  6: [
    { code: 'CSE 3201', name: 'Computer Network', credits: 3.0 },
    { code: 'CSE 3202', name: 'Computer Network Lab', credits: 1.5 },
    { code: 'CSE 3203', name: 'Artificial Intelligence', credits: 3.0 },
    { code: 'CSE 3204', name: 'Artificial Intelligence Lab', credits: 1.5 },
    { code: 'CSE 3205', name: 'Information Security', credits: 3.0 },
    { code: 'CSE 3206', name: 'Information Security Lab', credits: 1.5 },
    { code: 'CSE 3207', name: 'Theory of Computation', credits: 3.0 },
  ],
  7: [
    { code: 'CSE 4100', name: 'Internship', credits: 3.0 },
    { code: 'CSE 4101', name: 'Machine Learning', credits: 3.0 },
    { code: 'CSE 4102', name: 'Machine Learning Lab', credits: 1.5 },
    { code: 'CSE 4103', name: 'Internet of Things', credits: 3.0 },
    { code: 'CSE 4104', name: 'Internet of Things Lab', credits: 1.5 },
    { code: 'HUM 4105', name: 'Professional Ethics and Environment', credits: 2.0 },
    { code: 'CSE 4110', name: 'Final Year Project Part A', credits: 2.0 },
  ],
  8: [
    { code: 'CSE 4201', name: 'Parallel and Distributed Systems', credits: 3.0 },
    { code: 'CSE 4202', name: 'Parallel and Distributed Systems Lab', credits: 1.5 },
    { code: 'MIS 4203', name: 'IT Project Management', credits: 2.0 },
    { code: 'BUS 4205', name: 'ICT Business Entrepreneurship', credits: 2.0 },
    { code: 'CSE 4210', name: 'Final Year Project Part B', credits: 4.0 },
  ],
}

export function semesterLabel(n: number): string {
  const year = Math.ceil(n / 2)
  const sem  = n % 2 === 1 ? 1 : 2
  return `Year ${year}, Semester ${sem}`
}

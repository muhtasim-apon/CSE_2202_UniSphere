export type Notice = {
  id: string
  title: string
  timestamp: string
}

export const notices: Notice[] = [
  { id: '1', title: 'Midterm exam schedule has been published', timestamp: '2 hours ago' },
  { id: '2', title: 'Holiday notice: Campus closed on Friday', timestamp: '1 day ago' },
  { id: '3', title: 'New library hours starting next week', timestamp: '3 days ago' },
]

export type ChatMessage = {
  id: string
  name: string
  initials: string
  message: string
  timestamp: string
}

export const chatMessages: ChatMessage[] = [
  { id: '1', name: 'Ayesha Rahman', initials: 'AR', message: 'Did anyone finish the data structures assignment?', timestamp: '5m ago' },
  { id: '2', name: 'Tanvir Hasan', initials: 'TH', message: 'Yes, I can share my notes after class.', timestamp: '2m ago' },
]

export type Project = {
  id: string
  name: string
  tag: string
  progress: number
}

export const projects: Project[] = [
  { id: '1', name: 'University Management System', tag: 'Web App', progress: 72 },
  { id: '2', name: 'AI Chatbot Research', tag: 'Research', progress: 45 },
  { id: '3', name: 'Mobile Attendance App', tag: 'Mobile', progress: 90 },
]

export type Achievement = {
  id: string
  label: string
}

export const achievements: Achievement[] = [
  { id: '1', label: 'Top Scorer' },
  { id: '2', label: '30-Day Streak' },
  { id: '3', label: 'Project Star' },
  { id: '4', label: 'Quiz Champion' },
]

export type Article = {
  id: string
  title: string
  source: string
  timestamp: string
}

export const articles: Article[] = [
  { id: '1', title: 'How AI is reshaping classroom learning', source: 'EduTech Daily', timestamp: 'Today' },
  { id: '2', title: 'Top 5 tools every CS student should know', source: 'TechBeat', timestamp: 'Yesterday' },
  { id: '3', title: 'Mastering time management during exams', source: 'CampusLife', timestamp: '2 days ago' },
]

export type ClassItem = {
  id: string
  name: string
  time: string
  location: string
}

export const upcomingClasses: ClassItem[] = [
  { id: '1', name: 'Database Systems', time: '10:00 AM', location: 'Room 302' },
  { id: '2', name: 'Software Engineering', time: '12:30 PM', location: 'Room 110' },
  { id: '3', name: 'Computer Networks', time: '2:00 PM', location: 'Lab 4' },
]

export const streak = {
  days: 12,
  weeklyGoalLabel: 'Weekly Goal',
  weeklyProgress: 65,
}

export const classModule = {
  teacher: "Dr. Rahman's",
  className: 'Class 2',
  href: 'https://classroom.google.com',
}

export type NavItem = {
  id: string
  label: string
}

export const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'notices', label: 'Notices' },
  { id: 'chatroom', label: 'Chatroom' },
  { id: 'projects', label: 'Projects' },
  { id: 'classes', label: 'Classes' },
  { id: 'achievements', label: 'Achievements' },
  { id: 'settings', label: 'Settings' },
]

export type UserRole = 'seeker' | 'employer';

export interface UserProfile {
  userId: string;
  role: UserRole;
  name: string;
  email: string;
  phone?: string;
  bio?: string;
  skills?: string[];
  location?: string;
  telegramId?: string;
  createdAt: string;
}

export interface Job {
  id: string;
  employerId: string;
  title: string;
  description: string;
  industry: string;
  skills: string[];
  location: {
    city: string;
    microdistrict: string;
  };
  jobType: 'full-time' | 'part-time' | 'gig' | 'internship';
  experience: 'no-experience' | '1-3-years' | '3-plus-years';
  salary?: string;
  status: 'open' | 'closed';
  createdAt: string;
}

export interface Application {
  id: string;
  jobId: string;
  seekerId: string;
  status: 'pending' | 'viewed' | 'shortlisted' | 'rejected' | 'accepted';
  message?: string;
  updatedAt: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

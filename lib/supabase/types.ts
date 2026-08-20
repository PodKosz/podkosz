import { Access, CourtType, PhotoKind, Surface } from "../types";

export type SubmissionStatus = "pending" | "approved" | "rejected";

export interface CourtRow {
  id: string;
  slug: string;
  name: string;
  city: string;
  voivodeship: string;
  lat: number;
  lng: number;
  type: CourtType;
  surface: Surface;
  hoops: number;
  lit: boolean;
  fenced: boolean;
  access: Access;
  hours: string;
  description: string;
  basket_approved: boolean;
  basket_note: string;
  funny: boolean;
  shorts_url: string;
  likes_count: number;
  added_by: string | null;
  added_by_name: string;
  created_at: string;
  court_photos?: PhotoRow[];
}

export interface PhotoRow {
  id?: string;
  kind: PhotoKind;
  storage_path: string;
  sort: number;
}

export interface SubmissionRow {
  id: string;
  status: SubmissionStatus;
  reject_reason: string | null;
  basket_approved: boolean;
  basket_note: string;
  author_id: string | null;
  author_email: string | null;
  author_name: string | null;
  name: string;
  city: string;
  voivodeship: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  type: CourtType;
  surface: Surface;
  hoops: number;
  lit: boolean;
  fenced: boolean;
  access: Access;
  hours: string;
  notes: string;
  court_id: string | null;
  created_at: string;
  submission_photos?: (PhotoRow & { id: string })[];
}

export interface ProfileRow {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  banned_at: string | null;
  banned_reason: string | null;
  nick_changed_at: string | null;
  role: "user" | "admin";
}

export interface ContributorRow {
  name: string;
  user_id: string | null;
  courts: number;
  likes: number;
}

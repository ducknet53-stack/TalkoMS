export interface User {
  uid: string;
  username: string;
  usernameLower: string;
  email: string;
  photoURL: string | null;
  about: string;
  isOnline: boolean;
  lastSeen: number;
  createdAt: number;
  isBanned?: boolean;
  bannedAt?: number;
}

export interface Chat {
  id: string;
  participants: string[];
  participantDetails: Record<string, { username: string; photoURL: string | null }>;
  lastMessage: string | null;
  lastMessageTimestamp: number | null;
  updatedAt: number;
}

export interface Message {
  id: string;
  senderId: string;
  text: string | null;
  imageUrl: string | null;
  timestamp: number;
}

export interface TypingStatus {
  isTyping: boolean;
  timestamp: number;
}

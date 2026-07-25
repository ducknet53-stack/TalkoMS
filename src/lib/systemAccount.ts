import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User } from '../types';
import { TALKO_LOGO_DATA_URL, TALKO_AI_LOGO_DATA_URL } from './assets';

export const SYSTEM_USER_ID = 'system_talko_destek';
export const TALKO_AI_USER_ID = 'system_talko_ai';

export async function ensureSystemAccount() {
  try {
    const systemRef = doc(db, 'users', SYSTEM_USER_ID);
    const systemSnap = await getDoc(systemRef);
    
    const systemUser: User = {
      uid: SYSTEM_USER_ID,
      username: 'Talko Updates',
      usernameLower: 'talko updates',
      email: 'updates@talko.app',
      photoURL: TALKO_LOGO_DATA_URL,
      about: 'Talko resmi destek ve duyuru hesabı.',
      isOnline: true,
      lastSeen: Date.now(),
      createdAt: Date.now()
    };

    if (!systemSnap.exists()) {
      await setDoc(systemRef, systemUser);
    } else {
      await updateDoc(systemRef, {
        username: 'Talko Updates',
        usernameLower: 'talko updates',
        photoURL: TALKO_LOGO_DATA_URL
      });
    }

    const aiRef = doc(db, 'users', TALKO_AI_USER_ID);
    const aiSnap = await getDoc(aiRef);

    const aiUser: User = {
      uid: TALKO_AI_USER_ID,
      username: 'Talko AI',
      usernameLower: 'talko ai',
      email: 'ai@talko.app',
      photoURL: TALKO_AI_LOGO_DATA_URL,
      about: '🤖 Resmî Yapay Zekâ Asistanı\nSorularınızı yanıtlar ve size yardımcı olur.',
      isOnline: true,
      lastSeen: Date.now(),
      createdAt: Date.now()
    };

    if (!aiSnap.exists()) {
      await setDoc(aiRef, aiUser);
    } else {
      await updateDoc(aiRef, {
        photoURL: TALKO_AI_LOGO_DATA_URL,
        about: aiUser.about
      });
    }
  } catch (err) {
    console.error('Failed to ensure system accounts:', err);
  }
}

// Function to send welcome message
export async function sendWelcomeMessageIfNeeded(userId: string, username: string, photoURL: string | null = null) {
  try {
    const chatId = [SYSTEM_USER_ID, userId].sort().join('_');
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);
    const now = Date.now();

    if (!chatSnap.exists()) {
      // Create chat
      await setDoc(chatRef, {
        id: chatId,
        participants: [SYSTEM_USER_ID, userId],
        participantDetails: {
          [SYSTEM_USER_ID]: { username: 'Talko Updates', photoURL: TALKO_LOGO_DATA_URL },
          [userId]: { username, photoURL: photoURL }
        },
        lastMessage: `Merhaba ${username}, Talko'ya hoş geldin!`,
        lastMessageTimestamp: now,
        updatedAt: now
      });

      // Create message
      const messageId = now.toString();
      const messageRef = doc(db, `chats/${chatId}/messages`, messageId);
      await setDoc(messageRef, {
        id: messageId,
        senderId: SYSTEM_USER_ID,
        text: `Merhaba ${username}, Talko'ya hoş geldin!\n\nPlatformumuz üzerinden mesajlaşabilir, fotoğraf gönderebilir ve profilinizi kişiselleştirebilirsiniz. Herhangi bir duyuru olduğunda bu sohbet üzerinden bilgilendirileceksiniz.\n\nKeyifli sohbetler!`,
        imageUrl: null,
        timestamp: now
      });
    } else {
      await updateDoc(chatRef, {
        [`participantDetails.${SYSTEM_USER_ID}.username`]: 'Talko Updates',
        [`participantDetails.${SYSTEM_USER_ID}.photoURL`]: TALKO_LOGO_DATA_URL
      });
    }
    
    // Create AI Chat
    const aiChatId = [TALKO_AI_USER_ID, userId].sort().join('_');
    const aiChatRef = doc(db, 'chats', aiChatId);
    const aiChatSnap = await getDoc(aiChatRef);
    
    if (!aiChatSnap.exists()) {
      const aiNow = Date.now() + 1000;
      await setDoc(aiChatRef, {
        id: aiChatId,
        participants: [TALKO_AI_USER_ID, userId],
        participantDetails: {
          [TALKO_AI_USER_ID]: { username: 'Talko AI', photoURL: TALKO_AI_LOGO_DATA_URL },
          [userId]: { username, photoURL: photoURL }
        },
        lastMessage: `Merhaba! Ben Talko AI. Size nasıl yardımcı olabilirim?`,
        lastMessageTimestamp: aiNow,
        updatedAt: aiNow
      });
      const aiMsgId = aiNow.toString();
      await setDoc(doc(db, `chats/${aiChatId}/messages`, aiMsgId), {
        id: aiMsgId,
        senderId: TALKO_AI_USER_ID,
        text: `Merhaba! Ben Talko AI. Size nasıl yardımcı olabilirim?`,
        imageUrl: null,
        timestamp: aiNow
      });
    } else {
      await updateDoc(aiChatRef, {
        [`participantDetails.${TALKO_AI_USER_ID}.photoURL`]: TALKO_AI_LOGO_DATA_URL
      });
    }

  } catch (err) {
    console.error('Failed to send welcome message:', err);
  }
}

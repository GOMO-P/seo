import {doc, getDoc, setDoc, updateDoc, deleteDoc} from 'firebase/firestore';
import {db} from '../config/firebase';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  bio?: string;
  photoURL?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const USERS_COLLECTION = 'users';

export const userService = {
  // Get user profile
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const docRef = doc(db, USERS_COLLECTION, uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          uid: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as UserProfile;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  },

  // Create or update user profile
  async updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
    try {
      const docRef = doc(db, USERS_COLLECTION, uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        await updateDoc(docRef, {
          ...data,
          updatedAt: new Date(),
        });
      } else {
        await setDoc(docRef, {
          ...data,
          uid,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  },

  // Delete user profile
  async deleteUserProfile(uid: string): Promise<void> {
    try {
      const docRef = doc(db, USERS_COLLECTION, uid);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting user profile:', error);
      throw error;
    }
  },
};

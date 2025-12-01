import {useState} from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  User,
  updateProfile,
  deleteUser,
} from 'firebase/auth';
import {auth} from '@/config/firebase';

interface SignUpData {
  email: string;
  password: string;
  name?: string;
}

interface SignInData {
  email: string;
  password: string;
}

export default function useAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signUp = async ({email, password, name}: SignUpData): Promise<User | null> => {
    setLoading(true);
    setError(null);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update user profile with name if provided
      if (name) {
        await updateProfile(user, {displayName: name});
      }

      setLoading(false);
      return user;
    } catch (err: any) {
      setLoading(false);

      // Handle Firebase auth errors
      let errorMessage = 'An error occurred during sign up';

      switch (err.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'This email is already registered';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password should be at least 6 characters';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection';
          break;
        default:
          errorMessage = err.message || errorMessage;
      }

      setError(errorMessage);
      return null;
    }
  };

  const signIn = async ({email, password}: SignInData): Promise<User | null> => {
    setLoading(true);
    setError(null);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      setLoading(false);
      return userCredential.user;
    } catch (err: any) {
      setLoading(false);

      let errorMessage = 'An error occurred during sign in';

      switch (err.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          errorMessage = 'Invalid email or password';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address';
          break;
        case 'auth/user-disabled':
          errorMessage = 'This account has been disabled';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection';
          break;
        default:
          errorMessage = err.message || errorMessage;
      }

      setError(errorMessage);
      return null;
    }
  };

  const logout = async (): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      await signOut(auth);
      setLoading(false);
      return true;
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'An error occurred during sign out');
      return false;
    }
  };

  const clearError = () => {
    setError(null);
  };

  const deleteAccount = async (): Promise<string | null> => {
    setLoading(true);
    setError(null);

    try {
      if (auth.currentUser) {
        await deleteUser(auth.currentUser);
        setLoading(false);
        return null; // Success
      }
      return 'No user logged in';
    } catch (err: any) {
      setLoading(false);

      let errorMessage = 'An error occurred during account deletion';

      if (err.code === 'auth/requires-recent-login') {
        errorMessage = 'Please log in again to delete your account';
      } else {
        errorMessage = err.message || errorMessage;
      }

      setError(errorMessage);
      return errorMessage; // Return error message
    }
  };

  return {
    signUp,
    signIn,
    logout,
    deleteAccount,
    loading,
    error,
    clearError,
  };
}

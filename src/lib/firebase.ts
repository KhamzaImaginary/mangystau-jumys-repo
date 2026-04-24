import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, getDocFromServer, initializeFirestore } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);

// Initialize Firestore with long polling enabled to bypass gRPC connectivity issues
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);

async function testConnection() {
  try {
    await getDocFromServer(doc(db, '_internal_', 'connection_test'));
  } catch (error: any) {
    // If it's just a permission error or doc not found, it means we reached the server
    if (error.code === 'permission-denied' || error.code === 'not-found') {
      return;
    }
    console.warn("Firestore connectivity issue:", error.message);
  }
}

testConnection();

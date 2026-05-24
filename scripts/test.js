import admin from 'firebase-admin';
import serviceAccount from '../secrets/pure-reactions-cb457c74bbbf.json' assert { type: "json" };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

db.listCollections()
  .then(collections => {
    console.log('Collections:', collections.map(c => c.id));
    process.exit(0);
  })
  .catch(err => {
    console.error('Credential check failed:', err.message);
    process.exit(1);
  });
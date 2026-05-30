# 🟣 Polygon 6th Birthday — polygon6years.firsttx.xyz

Community tool for Polygon's 6th anniversary (May 30, 2020 → May 30, 2026).

Enter your wallet → get your first Polygon transaction date → shareable card → OG Leaderboard.

## Stack
- Next.js 15 App Router
- Firebase Firestore (leaderboard)
- Polygonscan API + Polygon RPC (first-tx data)
- html2canvas (card download)
- Syne + DM Mono + Plus Jakarta Sans fonts

## Setup

```bash
cp .env.example .env.local
# fill in Firebase + Polygonscan keys
npm install
npm run dev
```

## Firebase Setup
1. Create project at console.firebase.google.com
2. Enable Firestore Database (test mode for dev)
3. Add Firestore security rules for production:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /polygon6_leaderboard/{address} {
      allow read: if true;
      allow write: if request.resource.data.address == address;
    }
  }
}
```

## Deploy
```bash
vercel --prod
# Add env vars in Vercel dashboard
```

## Credit
Built with 💜  by [@mojeebeth](https://x.com/mojeebeth)  
in celebration of six years of Polygon

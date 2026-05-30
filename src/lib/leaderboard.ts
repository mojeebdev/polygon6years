import { db } from './firebase'
import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore'

export interface LeaderboardEntry {
  address: string
  firstTxTimestamp: number
  firstTxDate: string
  era: string
  eraEmoji: string
  badgeLabel: string
  daysOnChain: number
  txCount: number | null
  submittedAt: Timestamp | null
  rank?: number
}

const COLLECTION = 'polygon6_leaderboard'

export async function submitToLeaderboard(entry: Omit<LeaderboardEntry, 'submittedAt' | 'rank'>): Promise<void> {
  const docRef = doc(db, COLLECTION, entry.address.toLowerCase())
  await setDoc(docRef, {
    ...entry,
    address: entry.address.toLowerCase(),
    submittedAt: serverTimestamp()
  }, { merge: true })
}

export async function getLeaderboard(count = 50): Promise<LeaderboardEntry[]> {
  const q = query(
    collection(db, COLLECTION),
    orderBy('firstTxTimestamp', 'asc'),
    limit(count)
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((docSnap, i) => ({
    ...docSnap.data() as LeaderboardEntry,
    rank: i + 1
  }))
}

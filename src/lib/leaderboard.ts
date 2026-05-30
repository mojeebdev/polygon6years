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
  xHandle: string | null
  firstTxTimestamp: number
  firstTxDate: string
  era: string
  eraEmoji: string
  badgeLabel: string
  daysOnChain: number
  txCount: number | null
  rankScore: number
  rankTier: string
  rankTierLabel: string
  rankTierColor: string
  submittedAt: Timestamp | null
  isGenesis?: boolean
  rank?: number
}


export const GENESIS_ENTRY: LeaderboardEntry = {
  address: '0x0000000000000000000000000000000000000000',
  xHandle: '0xPolygon',
  firstTxTimestamp: 1590969600, 
  firstTxDate: '2020-06-01T00:00:00.000Z',
  era: 'Genesis Block · The Beginning',
  eraEmoji: '🌐',
  badgeLabel: '🏛️ Genesis TX',
  daysOnChain: 2190, // 6 years
  txCount: null,
  rankScore: 1000,
  rankTier: 'S+',
  rankTierLabel: 'Genesis Tier',
  rankTierColor: '#F0ABFC',
  submittedAt: null,
  isGenesis: true,
  rank: 0,
}

const COLLECTION = 'polygon6_leaderboard'

export async function submitToLeaderboard(
  entry: Omit<LeaderboardEntry, 'submittedAt' | 'rank' | 'isGenesis'>
): Promise<void> {
  const docRef = doc(db, COLLECTION, entry.address.toLowerCase())
  await setDoc(docRef, {
    ...entry,
    address: entry.address.toLowerCase(),
    xHandle: entry.xHandle ?? null,
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
  const entries: LeaderboardEntry[] = snapshot.docs.map((docSnap, i) => ({
    ...docSnap.data() as LeaderboardEntry,
    rank: i + 1,
  }))

  
  return [GENESIS_ENTRY, ...entries]
}

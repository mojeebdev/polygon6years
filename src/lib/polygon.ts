export interface WalletData {
  address: string
  xHandle: string | null   
  firstTxHash: string | null
  firstTxDate: Date | null
  firstTxTimestamp: number | null
  txCount: number | null
  source: string
  era: string
  eraEmoji: string
  daysOnChain: number | null
  percentile: number
  badgeLabel: string
  rankScore: number
  rankTier: string
  rankTierLabel: string
  rankTierColor: string
}

const POLYGON_RPC = 'https://polygon-rpc.com'
const POLYGONSCAN_API = 'https://api.polygonscan.com/api'

export const POLYGON_BIRTHDAY = new Date('2020-05-30T00:00:00Z')
export const NOW = new Date('2026-05-30T00:00:00Z')

function getEra(date: Date): { era: string; emoji: string } {
  const yr = date.getFullYear()
  const mo = date.getMonth()

  if (yr === 2020) return { era: 'Genesis OG · Year Zero', emoji: '🏛️' }
  if (yr === 2021 && mo < 3) return { era: 'Early Adopter · Bull Dawn', emoji: '⚡' }
  if (yr === 2021 && mo < 9) return { era: 'DeFi Summer Veteran', emoji: '🔥' }
  if (yr === 2021) return { era: 'Bull Run Peak Holder', emoji: '🚀' }
  if (yr === 2022 && mo < 5) return { era: 'Peak Cycle Survivor', emoji: '🌊' }
  if (yr === 2022) return { era: 'Bear Market Entrant', emoji: '🐻' }
  if (yr === 2023) return { era: 'Bear Market Builder', emoji: '💎' }
  if (yr === 2024 && mo < 6) return { era: 'Revival Wave Rider', emoji: '🌊' }
  if (yr === 2024) return { era: 'Bull Cycle Re-entry', emoji: '🟣' }
  return { era: '2025+ Fresh Deployer', emoji: '✨' }
}

function getBadgeLabel(daysOnChain: number): string {
  if (daysOnChain >= 365 * 5) return '🏛️ Genesis OG'
  if (daysOnChain >= 365 * 4) return '⚡ Year-One Veteran'
  if (daysOnChain >= 365 * 3) return '🔥 3-Year Holder'
  if (daysOnChain >= 365 * 2) return '💎 2-Year Diamond'
  if (daysOnChain >= 365) return '🌱 1-Year Builder'
  if (daysOnChain >= 180) return '🟣 6-Month Believer'
  return '✨ New to Polygon'
}


export function calcRankScore(firstTxTimestamp: number): number {
  const chainAgeMs = NOW.getTime() - POLYGON_BIRTHDAY.getTime()
  const walletAgeMs = NOW.getTime() - firstTxTimestamp * 1000
  const ratio = Math.min(1, Math.max(0, walletAgeMs / chainAgeMs))
  return Math.round(ratio * 1000)
}

export function getRankTier(score: number): { tier: string; label: string; color: string } {
  if (score >= 950) return { tier: 'S+', label: 'Genesis Tier',   color: '#F0ABFC' }
  if (score >= 850) return { tier: 'S',  label: 'Founding Tier',  color: '#C084FC' }
  if (score >= 700) return { tier: 'A+', label: 'Pioneer Tier',   color: '#A855F7' }
  if (score >= 550) return { tier: 'A',  label: 'Veteran Tier',   color: '#7B3FE4' }
  if (score >= 400) return { tier: 'B',  label: 'Builder Tier',   color: '#6366F1' }
  if (score >= 250) return { tier: 'C',  label: 'Believer Tier',  color: '#8B8BCC' }
  return                      { tier: 'D',  label: 'Rising Tier',   color: '#6B7280' }
}

async function fetchFromPolygonscan(address: string): Promise<WalletData | null> {
  const apiKey = process.env.POLYGONSCAN_API_KEY 

  const txRes = await fetch(
    `${POLYGONSCAN_API}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=1&sort=asc&apikey=${apiKey}`,
    { signal: AbortSignal.timeout(10000) }
  )
  const txJson = await txRes.json()

  let firstTxHash: string | null = null
  let firstTxTimestamp: number | null = null

  if (txJson.status === '1' && txJson.result?.length > 0) {
    const tx = txJson.result[0]
    firstTxHash = tx.hash
    firstTxTimestamp = parseInt(tx.timeStamp)
  }

  const countRes = await fetch(
    `${POLYGONSCAN_API}?module=proxy&action=eth_getTransactionCount&address=${address}&tag=latest&apikey=${apiKey}`,
    { signal: AbortSignal.timeout(8000) }
  )
  const countJson = await countRes.json()
  const txCount = countJson.result ? parseInt(countJson.result, 16) : null

  if (!firstTxTimestamp) {
    if (txCount && txCount > 0) {
      return {
        address,
        xHandle: null,
        firstTxHash: null,
        firstTxDate: null,
        firstTxTimestamp: null,
        txCount,
        source: 'Polygonscan',
        era: 'Unknown Era',
        eraEmoji: '🟣',
        daysOnChain: null,
        percentile: 0,
        badgeLabel: '🟣 Active Wallet',
        rankScore: 0,
        rankTier: '?',
        rankTierLabel: 'Unranked',
        rankTierColor: '#4E4870',
      }
    }
    return null
  }

  const firstTxDate = new Date(firstTxTimestamp * 1000)
  const diffMs = NOW.getTime() - firstTxDate.getTime()
  const daysOnChain = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const ensAgeMs = NOW.getTime() - POLYGON_BIRTHDAY.getTime()
  const percentile = Math.min(100, Math.max(0, (diffMs / ensAgeMs) * 100))
  const { era, emoji } = getEra(firstTxDate)
  const rankScore = calcRankScore(firstTxTimestamp)
  const { tier, label, color } = getRankTier(rankScore)

  return {
    address,
    xHandle: null,
    firstTxHash,
    firstTxDate,
    firstTxTimestamp,
    txCount,
    source: 'Polygonscan',
    era,
    eraEmoji: emoji,
    daysOnChain,
    percentile,
    badgeLabel: getBadgeLabel(daysOnChain),
    rankScore,
    rankTier: tier,
    rankTierLabel: label,
    rankTierColor: color,
  }
}

async function fetchFromRPC(address: string): Promise<WalletData | null> {
  const countRes = await fetch(POLYGON_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_getTransactionCount',
      params: [address, 'latest'],
      id: 1
    }),
    signal: AbortSignal.timeout(8000)
  })
  const countJson = await countRes.json()
  const txCount = countJson.result ? parseInt(countJson.result, 16) : null

  if (!txCount || txCount === 0) return null

  return {
    address,
    xHandle: null,
    firstTxHash: null,
    firstTxDate: null,
    firstTxTimestamp: null,
    txCount,
    source: 'Polygon RPC',
    era: 'Active Wallet',
    eraEmoji: '🟣',
    daysOnChain: null,
    percentile: 0,
    badgeLabel: txCount > 0 ? '🟣 Active Wallet' : '✨ New Wallet',
    rankScore: 0,
    rankTier: '?',
    rankTierLabel: 'Unranked',
    rankTierColor: '#4E4870',
  }
}

export async function fetchWalletData(address: string): Promise<WalletData | null> {
  const sources = [
    () => fetchFromPolygonscan(address),
    () => fetchFromRPC(address),
  ]

  for (const source of sources) {
    try {
      const result = await source()
      if (result) return result
    } catch (_) {}
  }

  return null
}

export function isValidAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr)
}

export function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

// LAUNCH_TWEET_URL: replace with your actual X post URL after you publish the launch post
export const LAUNCH_TWEET_URL = 'https://x.com/mojeebeth/status/REPLACE_WITH_LAUNCH_TWEET_ID'

export function buildShareText(data: WalletData): string {
  const dateStr = data.firstTxDate
    ? data.firstTxDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'the early days'
  const yrs = data.daysOnChain ? Math.floor(data.daysOnChain / 365) : 0
  const handleLine = data.xHandle ? `@${data.xHandle.replace(/^@/, '')} ` : ''
  const rankLine = data.rankScore > 0 ? `\nRank: ${data.rankScore}/1000 · ${data.rankTier} ${data.rankTierLabel}` : ''

  return `🟣 Happy 6th Anniversary @0xPolygon!\n\n${handleLine}${shortenAddress(data.address)} has been on Polygon since ${dateStr}${yrs > 0 ? ` — ${yrs} year${yrs > 1 ? 's' : ''} on-chain` : ''}.\n\n${data.eraEmoji} ${data.era}\n${data.badgeLabel}${rankLine}\n\nWhen did YOU first go on-chain? 👇\npolygon.firsttx.xyz\n\n#Polygon6 #Polygon #Web3 #POL`
}

export function buildTweetUrl(data: WalletData, launchTweetUrl: string): string {
  const text = buildShareText(data)
  const encoded = encodeURIComponent(text)
  // quote-tweet the launch post for virality
  const quoteTweetParam = launchTweetUrl.includes('REPLACE_WITH')
    ? ''
    : `&quote_tweet_id=${launchTweetUrl.split('/status/')[1]}`
  return `https://twitter.com/intent/tweet?text=${encoded}${quoteTweetParam}`
}

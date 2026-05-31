import { NextRequest, NextResponse } from 'next/server'

const POLYGONSCAN_API = 'https://api.etherscan.io/v2/api?chainid=137'
const POLYGON_RPC = 'https://polygon-rpc.com'

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')

  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
  }

  const apiKey = process.env.POLYGONSCAN_API_KEY
  if (!apiKey) {
    return await rpcFallback(address)
  }

  try {
    const base = `${POLYGONSCAN_API}&startblock=0&endblock=99999999&page=1&offset=1&sort=asc&apikey=${apiKey}&address=${address}`
    const [txRes, internalRes, tokenRes] = await Promise.allSettled([
      fetch(`${base}&module=account&action=txlist`,         { signal: AbortSignal.timeout(10000) }).then(r => r.json()),
      fetch(`${base}&module=account&action=txlistinternal`, { signal: AbortSignal.timeout(10000) }).then(r => r.json()),
      fetch(`${base}&module=account&action=tokentx`,        { signal: AbortSignal.timeout(10000) }).then(r => r.json()),
    ])

    const allNotOk = [txRes, internalRes, tokenRes].every(
      r => r.status === 'fulfilled' && r.value?.message === 'NOTOK'
    )
    if (allNotOk) return await rpcFallback(address)

    const candidates: Array<{ hash: string; timestamp: number }> = []

    for (const result of [txRes, internalRes, tokenRes]) {
      if (result.status === 'fulfilled') {
        const json = result.value
        if (json?.status === '1' && Array.isArray(json.result) && json.result.length > 0) {
          const tx = json.result[0]
          const ts = parseInt(tx.timeStamp, 10)
          if (!isNaN(ts)) candidates.push({ hash: tx.hash, timestamp: ts })
        }
      }
    }

    const countRes = await fetch(
      `${POLYGONSCAN_API}&module=proxy&action=eth_getTransactionCount&address=${address}&tag=latest&apikey=${apiKey}`,
      { signal: AbortSignal.timeout(8000) }
    )
    const countJson = await countRes.json()
    const txCount = countJson.result ? parseInt(countJson.result, 16) : null

    if (candidates.length === 0) {
      return NextResponse.json({ source: 'Polygonscan', firstTxHash: null, firstTxTimestamp: null, txCount })
    }

    const earliest = candidates.reduce((a, b) => a.timestamp <= b.timestamp ? a : b)

    return NextResponse.json({
      source: 'Polygonscan',
      firstTxHash: earliest.hash,
      firstTxTimestamp: earliest.timestamp,
      txCount,
    })
  } catch (e) {
    console.log('route error:', e)
    return await rpcFallback(address)
  }
}

async function rpcFallback(address: string) {
  try {
    const res = await fetch(POLYGON_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionCount',
        params: [address, 'latest'],
        id: 1,
      }),
      signal: AbortSignal.timeout(8000),
    })
    const json = await res.json()
    const txCount = json.result ? parseInt(json.result, 16) : 0
    return NextResponse.json({
      source: 'Polygon RPC',
      firstTxHash: null,
      firstTxTimestamp: null,
      txCount,
    })
  } catch {
    return NextResponse.json({ error: 'All sources failed' }, { status: 502 })
  }
}

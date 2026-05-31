import { NextRequest, NextResponse } from 'next/server'

const POLYGONSCAN_API = 'https://api.polygonscan.com/api'
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
    
    const txRes = await fetch(
      `${POLYGONSCAN_API}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=1&sort=asc&apikey=${apiKey}`,
      { signal: AbortSignal.timeout(10000) }
    )
    const txJson = await txRes.json()

    let firstTxHash: string | null = null
    let firstTxTimestamp: number | null = null

    if (txJson.status === '1' && Array.isArray(txJson.result) && txJson.result.length > 0) {
      firstTxHash = txJson.result[0].hash
      firstTxTimestamp = parseInt(txJson.result[0].timeStamp, 10)
    }

    // Tx count
    const countRes = await fetch(
      `${POLYGONSCAN_API}?module=proxy&action=eth_getTransactionCount&address=${address}&tag=latest&apikey=${apiKey}`,
      { signal: AbortSignal.timeout(8000) }
    )
    const countJson = await countRes.json()
    const txCount = countJson.result ? parseInt(countJson.result, 16) : null

    // If Polygonscan returned rate-limit or error, fall back to RPC
    if (txJson.status === '0' && txJson.message === 'NOTOK') {
      return await rpcFallback(address)
    }

    return NextResponse.json({
      source: 'Polygonscan',
      firstTxHash,
      firstTxTimestamp,
      txCount,
    })
  } catch {
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
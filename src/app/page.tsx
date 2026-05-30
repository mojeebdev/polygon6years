'use client'

import { useState, useRef, useEffect } from 'react'
import { fetchWalletData, isValidAddress, shortenAddress, buildShareText, POLYGON_BIRTHDAY, NOW, type WalletData } from '@/lib/polygon'
import { submitToLeaderboard, getLeaderboard, type LeaderboardEntry } from '@/lib/leaderboard'
import html2canvas from 'html2canvas'

type Step = 'idle' | 'loading' | 'result' | 'error'

export default function Home() {
  const [input, setInput] = useState('')
  const [step, setStep] = useState<Step>('idle')
  const [loadingText, setLoadingText] = useState('Querying Polygon RPC...')
  const [errorMsg, setErrorMsg] = useState('')
  const [walletData, setWalletData] = useState<WalletData | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(true)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [copied, setCopied] = useState(false)
  const [milestoneWidth, setMilestoneWidth] = useState(0)
  const cardRef = useRef<HTMLDivElement>(null)
  const confettiRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadLeaderboard()
  }, [])

  async function loadLeaderboard() {
    try {
      setLeaderboardLoading(true)
      const entries = await getLeaderboard(50)
      setLeaderboard(entries)
    } catch (_) {}
    finally { setLeaderboardLoading(false) }
  }

  async function handleLookup() {
    const addr = input.trim()
    if (!addr) { setErrorMsg('Enter a wallet address'); setStep('error'); return }
    if (!isValidAddress(addr)) { setErrorMsg('Invalid address. Must start with 0x and be 42 characters.'); setStep('error'); return }

    setStep('loading'); setErrorMsg(''); setMilestoneWidth(0); setSubmitStatus('idle')

    const loadingSteps = ['Querying Polygon RPC...', 'Scanning first transaction...', 'Calculating your era...']
    let si = 0
    const interval = setInterval(() => { si = (si + 1) % loadingSteps.length; setLoadingText(loadingSteps[si]) }, 1800)

    try {
      const data = await fetchWalletData(addr)
      clearInterval(interval)
      if (!data) { setErrorMsg(`No on-chain activity found for ${shortenAddress(addr)} on Polygon mainnet.`); setStep('error'); return }
      setWalletData(data); setStep('result')
      setTimeout(() => fireConfetti(), 400)
      setTimeout(() => {
        const pct = data.firstTxTimestamp
          ? Math.min(100, ((NOW.getTime() - data.firstTxTimestamp * 1000) / (NOW.getTime() - POLYGON_BIRTHDAY.getTime())) * 100)
          : 0
        setMilestoneWidth(Math.max(5, pct))
      }, 700)
    } catch (_) {
      clearInterval(interval)
      setErrorMsg('Network error. Try again in a moment.')
      setStep('error')
    }
  }

  function fireConfetti() {
    if (!confettiRef.current) return
    confettiRef.current.innerHTML = ''
    const colors = ['#7B3FE4','#A855F7','#C084FC','#E879F9','#ffffff','#DDD6FE','#8B5CF6']
    for (let i = 0; i < 55; i++) {
      const el = document.createElement('div')
      const x = Math.random() * 100
      const tx = (Math.random() - 0.5) * 260
      const ty = -(Math.random() * 240 + 80)
      const rot = (Math.random() - 0.5) * 720
      const size = Math.random() * 7 + 4
      const color = colors[Math.floor(Math.random() * colors.length)]
      const isCircle = Math.random() > 0.4
      el.style.cssText = `position:absolute;left:${x}%;top:90%;background:${color};border-radius:${isCircle?'50%':'2px'};width:${size}px;height:${size*(isCircle?1:1.6)}px;opacity:0;animation:confettiFall ${Math.random()*0.8+1.4}s ease-out ${Math.random()*0.4}s forwards;--tx:${tx}px;--ty:${ty}px;--rot:${rot}deg;`
      confettiRef.current.appendChild(el)
    }
  }

  async function handleDownload() {
    if (!cardRef.current || downloadStatus === 'loading') return
    setDownloadStatus('loading')
    if (confettiRef.current) confettiRef.current.style.display = 'none'
    try {
      const canvas = await html2canvas(cardRef.current, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: null, logging: false })
      if (confettiRef.current) confettiRef.current.style.display = 'block'
      const link = document.createElement('a')
      link.download = `polygon6-${walletData!.address.slice(0,10)}.png`
      link.href = canvas.toDataURL('image/png', 1.0)
      link.click()
      setDownloadStatus('done')
      setTimeout(() => setDownloadStatus('idle'), 2500)
    } catch (_) {
      if (confettiRef.current) confettiRef.current.style.display = 'block'
      setDownloadStatus('error')
      setTimeout(() => setDownloadStatus('idle'), 2500)
    }
  }

  async function handleCopy() {
    if (!walletData) return
    const text = buildShareText(walletData)
    try { await navigator.clipboard.writeText(text) }
    catch (_) {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
    }
    setCopied(true); setTimeout(() => setCopied(false), 2200)
  }

  async function handleSubmitLeaderboard() {
    if (!walletData || !walletData.firstTxTimestamp) return
    setSubmitStatus('submitting')
    try {
      await submitToLeaderboard({
        address: walletData.address,
        firstTxTimestamp: walletData.firstTxTimestamp,
        firstTxDate: walletData.firstTxDate!.toISOString(),
        era: walletData.era, eraEmoji: walletData.eraEmoji,
        badgeLabel: walletData.badgeLabel,
        daysOnChain: walletData.daysOnChain!, txCount: walletData.txCount,
      })
      setSubmitStatus('done'); await loadLeaderboard()
    } catch (_) { setSubmitStatus('error'); setTimeout(() => setSubmitStatus('idle'), 2500) }
  }

  function handleReset() {
    setStep('idle'); setInput(''); setWalletData(null); setErrorMsg(''); setMilestoneWidth(0); setSubmitStatus('idle')
  }

  const shareText = walletData ? buildShareText(walletData) : ''
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`
  const diffYears = walletData?.daysOnChain ? (walletData.daysOnChain / 365.25) : 0

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800;900&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap');
        :root {
          --void-01:#050508;--void-02:#0C0B14;--void-03:#141220;--void-04:#1E1B2E;--void-05:#2A2640;
          --ink-primary:#F4F0FF;--ink-secondary:#9B94B8;--ink-tertiary:#4E4870;
          --accent:#7B3FE4;--accent-2:#A855F7;--accent-3:#C084FC;
          --accent-dim:rgba(123,63,228,0.12);--accent-border:rgba(123,63,228,0.3);
        }
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        body{background:var(--void-01);color:var(--ink-primary);font-family:'Plus Jakarta Sans',sans-serif;min-height:100vh;overflow-x:hidden;}
        .bg-layer{position:fixed;inset:0;pointer-events:none;z-index:0;}
        .bg-grid{background-image:radial-gradient(circle,rgba(123,63,228,0.22) 1px,transparent 1px);background-size:32px 32px;}
        .bg-vignette{background:radial-gradient(ellipse 90% 70% at 50% 50%,transparent 30%,var(--void-01) 100%);}
        .bg-glow-top{background:radial-gradient(ellipse 70% 50% at 50% -10%,rgba(123,63,228,0.22),transparent 70%);}
        .bg-glow-bot{background:radial-gradient(ellipse 60% 40% at 80% 110%,rgba(168,85,247,0.12),transparent 60%);}
        @keyframes confettiFall{0%{opacity:1;transform:translate(0,0) rotate(0deg) scale(1);}100%{opacity:0;transform:translate(var(--tx),var(--ty)) rotate(var(--rot)) scale(0.3);}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(18px);}to{opacity:1;transform:translateY(0);}}
        @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.35;}}
        @keyframes shimmer{0%{background-position:-200% center;}100%{background-position:200% center;}}
        .anim-fadeup{animation:fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) both;}
        .anim-fadeup-1{animation:fadeUp 0.7s 0.07s cubic-bezier(0.16,1,0.3,1) both;}
        .anim-fadeup-2{animation:fadeUp 0.7s 0.14s cubic-bezier(0.16,1,0.3,1) both;}
        .page-wrap{position:relative;z-index:1;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:52px 16px 60px;width:100%;}
        .anniv-pill{display:inline-flex;align-items:center;gap:8px;font-family:'Plus Jakarta Sans',sans-serif;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#C084FC;background:rgba(192,132,252,0.08);border:1px solid rgba(192,132,252,0.22);border-radius:100px;padding:7px 16px;margin-bottom:24px;}
        .anniv-pill .dot{width:6px;height:6px;border-radius:50%;background:#A855F7;animation:pulse 2s ease-in-out infinite;flex-shrink:0;}
        .hero{text-align:center;margin-bottom:36px;width:100%;max-width:640px;}
        .hero-eyebrow{display:block;font-family:'DM Mono',monospace;font-size:10px;color:#A855F7;letter-spacing:0.1em;margin-bottom:12px;opacity:0.8;}
        h1{font-family:'Syne',sans-serif;font-size:clamp(30px,8vw,72px);font-weight:900;letter-spacing:-0.03em;line-height:1.04;color:var(--ink-primary);margin-bottom:16px;}
        .gradient-text{background:linear-gradient(135deg,#A855F7 0%,#C084FC 50%,#F0ABFC 100%);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shimmer 4s linear infinite;}
        .hero-sub{font-family:'DM Mono',monospace;font-size:12px;color:var(--ink-secondary);max-width:380px;margin:0 auto;line-height:1.8;}
        .input-section{width:100%;max-width:560px;margin-bottom:12px;}
        .input-wrap{display:flex;background:var(--void-02);border:1px solid var(--void-05);border-radius:14px;overflow:hidden;transition:border-color 0.2s,box-shadow 0.2s;}
        .input-wrap:focus-within{border-color:rgba(123,63,228,0.4);box-shadow:0 0 0 3px rgba(123,63,228,0.1);}
        input[type="text"]{flex:1;min-width:0;background:transparent;border:none;outline:none;padding:15px 16px;font-family:'DM Mono',monospace;font-size:13px;color:var(--ink-primary);caret-color:#A855F7;}
        input::placeholder{color:var(--ink-tertiary);}
        .lookup-btn{padding:15px 20px;background:var(--accent);border:none;color:#fff;font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:opacity 0.2s,background 0.2s;white-space:nowrap;flex-shrink:0;}
        .lookup-btn:hover:not(:disabled){background:#A855F7;}
        .lookup-btn:disabled{opacity:0.4;cursor:not-allowed;}
        .input-hint{font-family:'DM Mono',monospace;font-size:10px;color:var(--ink-tertiary);text-align:center;margin-top:10px;}
        .error-box{font-family:'DM Mono',monospace;font-size:12px;color:#F87171;background:rgba(248,113,113,0.06);border:1px solid rgba(248,113,113,0.2);border-radius:10px;padding:12px 16px;text-align:center;margin-top:14px;animation:fadeUp 0.3s ease both;max-width:560px;width:100%;}
        .loading-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;margin-top:48px;animation:fadeIn 0.4s ease both;}
        .loading-ring{width:40px;height:40px;border:2px solid var(--void-05);border-top-color:var(--accent);border-right-color:#A855F7;border-radius:50%;animation:spin 0.7s linear infinite;}
        .loading-text{font-family:'DM Mono',monospace;font-size:12px;color:var(--ink-secondary);text-align:center;}
        .result-wrap{width:100%;max-width:560px;margin-top:32px;animation:fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) both;}
        .share-card{background:linear-gradient(140deg,#0D0A1E 0%,#100D20 50%,#0C0A1A 100%);border:1px solid rgba(123,63,228,0.28);border-radius:22px;padding:24px 22px 22px;position:relative;overflow:hidden;}
        .share-card::before{content:'';position:absolute;top:-100px;left:-80px;width:280px;height:280px;background:radial-gradient(circle,rgba(123,63,228,0.18),transparent 65%);pointer-events:none;}
        .share-card::after{content:'';position:absolute;bottom:-80px;right:-60px;width:220px;height:220px;background:radial-gradient(circle,rgba(168,85,247,0.15),transparent 65%);pointer-events:none;}
        .card-anniv-ribbon{display:flex;align-items:center;justify-content:center;gap:6px;font-family:'Plus Jakarta Sans',sans-serif;font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#C084FC;background:rgba(192,132,252,0.07);border:1px solid rgba(192,132,252,0.18);border-radius:8px;padding:8px 12px;margin-bottom:18px;flex-wrap:wrap;text-align:center;line-height:1.7;}
        .card-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:8px;}
        .polygon-logo{display:flex;align-items:center;gap:8px;font-family:'Syne',sans-serif;font-size:13px;font-weight:800;letter-spacing:-0.02em;color:var(--ink-primary);}
        .card-badge{font-family:'Plus Jakarta Sans',sans-serif;font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#C084FC;background:rgba(192,132,252,0.1);border:1px solid rgba(192,132,252,0.22);border-radius:100px;padding:4px 12px;white-space:nowrap;}
        .card-address{font-family:'Syne',sans-serif;font-size:clamp(18px,5vw,30px);font-weight:900;letter-spacing:-0.02em;color:#fff;margin-bottom:4px;word-break:break-all;line-height:1.1;}
        .card-era-row{font-family:'DM Mono',monospace;font-size:11px;color:rgba(255,255,255,0.35);font-style:italic;margin-bottom:14px;}
        .card-chips{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:16px;}
        .chip{display:inline-flex;align-items:center;gap:5px;font-family:'DM Mono',monospace;font-size:9px;color:rgba(255,255,255,0.45);background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:100px;padding:3px 10px;}
        .chip .dot{width:5px;height:5px;border-radius:50%;background:#A855F7;flex-shrink:0;}
        .stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;}
        .stat-block{background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:13px 12px;}
        .stat-label{font-family:'Plus Jakarta Sans',sans-serif;font-size:8px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.28);margin-bottom:6px;}
        .stat-value{font-family:'DM Mono',monospace;font-size:13px;color:#fff;line-height:1.2;}
        .stat-value.hero-num{font-family:'Syne',sans-serif;font-size:28px;font-weight:900;letter-spacing:-0.03em;background:linear-gradient(135deg,#A855F7,#C084FC);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
        .stat-value.purple{color:#C084FC;}
        .milestone-block{background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:12px;margin-bottom:14px;}
        .milestone-label{font-family:'Plus Jakarta Sans',sans-serif;font-size:8px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.28);margin-bottom:8px;}
        .milestone-track{position:relative;height:4px;background:rgba(255,255,255,0.06);border-radius:100px;overflow:hidden;margin-bottom:7px;}
        .milestone-fill{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#7B3FE4,#A855F7,#C084FC);border-radius:100px;transition:width 1.1s cubic-bezier(0.16,1,0.3,1);}
        .milestone-sub{font-family:'DM Mono',monospace;font-size:9px;color:rgba(255,255,255,0.28);line-height:1.6;}
        .card-footer-row{display:flex;align-items:center;justify-content:space-between;padding-top:13px;border-top:1px solid rgba(255,255,255,0.05);}
        .card-footer-url{font-family:'DM Mono',monospace;font-size:9px;color:rgba(255,255,255,0.2);}
        .card-footer-emoji{font-size:15px;letter-spacing:3px;}
        .confetti-layer{position:absolute;inset:0;pointer-events:none;overflow:hidden;border-radius:22px;}
        .card-actions{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:14px;}
        .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:14px 12px;border-radius:12px;font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;font-weight:600;cursor:pointer;border:none;text-decoration:none;transition:opacity 0.2s,transform 0.15s;letter-spacing:0.02em;white-space:nowrap;}
        .btn:hover:not(:disabled){opacity:0.82;transform:translateY(-1px);}
        .btn:disabled{opacity:0.45;cursor:not-allowed;transform:none;}
        .btn-primary{background:var(--accent);color:#fff;}
        .btn-x{background:#000;color:#fff;border:1px solid #2a2a2a;}
        .btn-ghost{background:transparent;color:var(--ink-secondary);border:1px solid var(--void-05);}
        .btn-ghost:hover:not(:disabled){border-color:rgba(123,63,228,0.3);color:var(--ink-primary);}
        .btn-purple-outline{background:transparent;color:#C084FC;border:1px solid rgba(192,132,252,0.3);}
        .btn-purple-outline:hover:not(:disabled){background:rgba(192,132,252,0.08);}
        .try-again{display:block;text-align:center;font-family:'DM Mono',monospace;font-size:11px;color:var(--ink-tertiary);margin-top:16px;cursor:pointer;text-decoration:underline;text-underline-offset:3px;transition:color 0.2s;background:none;border:none;}
        .try-again:hover{color:var(--ink-secondary);}
        .data-note{font-family:'DM Mono',monospace;font-size:10px;color:var(--ink-tertiary);text-align:center;margin-top:10px;opacity:0.6;}
        .section-divider{width:100%;max-width:760px;height:1px;background:var(--void-05);margin:56px 0 0;}
        .leaderboard-section{width:100%;max-width:760px;padding-top:48px;}
        .section-header{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:24px;gap:16px;flex-wrap:wrap;}
        .section-title{font-family:'Syne',sans-serif;font-size:clamp(22px,5vw,36px);font-weight:800;letter-spacing:-0.03em;color:var(--ink-primary);line-height:1.1;}
        .section-title span{background:linear-gradient(135deg,#A855F7,#C084FC);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
        .section-sub{font-family:'DM Mono',monospace;font-size:11px;color:var(--ink-tertiary);margin-top:6px;}
        .lb-table{width:100%;border-collapse:collapse;border:1px solid var(--void-05);border-radius:14px;overflow:hidden;}
        .lb-table thead tr{background:var(--void-03);}
        .lb-table th{font-family:'Plus Jakarta Sans',sans-serif;font-size:9px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:var(--ink-tertiary);padding:11px 14px;text-align:left;border-bottom:1px solid var(--void-05);}
        .lb-table tbody tr{background:var(--void-02);border-bottom:1px solid var(--void-04);transition:background 0.15s;}
        .lb-table tbody tr:last-child{border-bottom:none;}
        .lb-table tbody tr:hover{background:var(--void-03);}
        .lb-table tbody tr.is-you{background:rgba(123,63,228,0.06);}
        .lb-table td{padding:12px 14px;font-family:'DM Mono',monospace;font-size:12px;color:var(--ink-secondary);vertical-align:middle;}
        .lb-rank{font-family:'Syne',sans-serif;font-weight:800;font-size:14px;color:var(--ink-tertiary);width:40px;text-align:center;}
        .lb-rank.top3{color:#A855F7;}
        .lb-address{font-family:'DM Mono',monospace;font-size:12px;color:var(--ink-primary);}
        .lb-address.is-you-text{color:#C084FC;}
        .lb-era{font-size:11px;}
        .lb-badge{display:inline-flex;align-items:center;gap:4px;font-family:'Plus Jakarta Sans',sans-serif;font-size:10px;font-weight:600;color:#C084FC;background:rgba(192,132,252,0.08);border:1px solid rgba(192,132,252,0.18);border-radius:100px;padding:3px 9px;white-space:nowrap;}
        .lb-days{font-size:11px;color:var(--ink-tertiary);text-align:right;}
        .lb-empty{text-align:center;padding:48px 24px;font-family:'DM Mono',monospace;font-size:12px;color:var(--ink-tertiary);}
        .lb-loading{display:flex;justify-content:center;padding:36px;}
        footer{position:relative;z-index:1;text-align:center;padding:48px 16px 32px;font-family:'DM Mono',monospace;font-size:11px;color:var(--ink-tertiary);line-height:2;max-width:760px;width:100%;margin:0 auto;}
        footer a{color:#A855F7;text-decoration:none;}
        footer a:hover{color:#C084FC;}
        .footer-love{margin-top:10px;font-size:12px;color:var(--ink-secondary);}
        .footer-love span{color:#A855F7;}
        @media(max-width:600px){.card-actions{grid-template-columns:1fr 1fr;}.card-actions .btn:last-child{grid-column:1/-1;}.lb-table th:nth-child(3),.lb-table td:nth-child(3){display:none;}.lb-table th:nth-child(5),.lb-table td:nth-child(5){display:none;}}
        @media(max-width:420px){h1{font-size:28px;}.card-actions{grid-template-columns:1fr;}.stats-grid{grid-template-columns:1fr 1fr;}}
      `}</style>

      <div className="bg-layer bg-grid" />
      <div className="bg-layer bg-vignette" />
      <div className="bg-layer bg-glow-top" />
      <div className="bg-layer bg-glow-bot" />

      <div className="page-wrap">
        <div className="anniv-pill anim-fadeup">
          <span className="dot" />
          Happy 6th Birthday, Polygon
          <span className="dot" />
        </div>

        <div className="hero anim-fadeup-1">
          <span className="hero-eyebrow">polygon mainnet · launched may 30, 2020</span>
          <h1>When did you go<br /><span className="gradient-text">on-chain?</span></h1>
          <p className="hero-sub">Enter your wallet. We&apos;ll find your first Polygon transaction and generate a shareable 6th anniversary card.</p>
        </div>

        <div className="input-section anim-fadeup-2">
          <div className="input-wrap">
            <input
              type="text"
              placeholder="0x... your wallet address"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLookup()}
              disabled={step === 'loading'}
              autoComplete="off"
              spellCheck={false}
            />
            <button className="lookup-btn" onClick={handleLookup} disabled={step === 'loading'}>
              Look up →
            </button>
          </div>
          <p className="input-hint">Works with any EVM wallet address · Polygon PoS mainnet</p>
        </div>

        {step === 'error' && <div className="error-box">{errorMsg}</div>}

        {step === 'loading' && (
          <div className="loading-wrap">
            <div className="loading-ring" />
            <p className="loading-text">{loadingText}</p>
          </div>
        )}

        {step === 'result' && walletData && (
          <div className="result-wrap">
            <div id="share-card" className="share-card" ref={cardRef}>
              <div className="confetti-layer" ref={confettiRef} />

              <div className="card-anniv-ribbon">
                🟣 &nbsp; Happy 6th Anniversary, @0xPolygon &nbsp; · &nbsp; May 30, 2020 – May 30, 2026 &nbsp; 🟣
              </div>

              <div className="card-top">
                <div className="polygon-logo">
                  <PolygonSVG size={26} />
                  Polygon PoS
                </div>
                <span className="card-badge">{walletData.badgeLabel}</span>
              </div>

              <div className="card-address">{shortenAddress(walletData.address)}</div>
              <div className="card-era-row">{walletData.eraEmoji} {walletData.era}</div>

              <div className="card-chips">
                <span className="chip"><span className="dot" />Polygon Mainnet</span>
                {walletData.firstTxHash && <span className="chip">First Tx Verified</span>}
                {walletData.txCount && <span className="chip">{walletData.txCount.toLocaleString()} txns</span>}
              </div>

              <div className="stats-grid">
                <div className="stat-block">
                  <div className="stat-label">First Tx Date</div>
                  <div className="stat-value" style={{fontSize:'11px'}}>
                    {walletData.firstTxDate
                      ? walletData.firstTxDate.toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'})
                      : 'Active Wallet'}
                  </div>
                </div>
                <div className="stat-block">
                  <div className="stat-label">Years on Polygon</div>
                  <div className="stat-value hero-num">
                    {diffYears >= 1 ? diffYears.toFixed(1)+'y' : (walletData.daysOnChain ?? '—')+'d'}
                  </div>
                </div>
                <div className="stat-block">
                  <div className="stat-label">Days On-Chain</div>
                  <div className="stat-value">{walletData.daysOnChain ? walletData.daysOnChain.toLocaleString()+' days' : '—'}</div>
                </div>
                <div className="stat-block">
                  <div className="stat-label">Polygon Age Score</div>
                  <div className="stat-value purple">
                    {walletData.percentile < 10 ? '🏛️ Genesis OG' :
                     walletData.percentile < 25 ? '⚡ Early Mover' :
                     walletData.percentile < 45 ? '💎 Diamond Hand' :
                     walletData.percentile < 65 ? '🟣 Core Builder' : '✨ Rising User'}
                  </div>
                </div>
              </div>

              <div className="milestone-block">
                <div className="milestone-label">Time in Polygon history</div>
                <div className="milestone-track">
                  <div className="milestone-fill" style={{width:`${milestoneWidth}%`}} />
                </div>
                <div className="milestone-sub">
                  {walletData.daysOnChain
                    ? `${walletData.daysOnChain.toLocaleString()} days of on-chain activity on Polygon PoS`
                    : 'Active wallet detected on Polygon mainnet'}
                </div>
              </div>

              <div className="card-footer-row">
                <span className="card-footer-url">polygon.technology · #Polygon6</span>
                <span className="card-footer-emoji">🟣🎂✨</span>
              </div>
            </div>

            <div className="card-actions">
              <button className="btn btn-primary" onClick={handleDownload} disabled={downloadStatus === 'loading'}>
                {downloadStatus === 'loading' ? <><DownloadIcon /> Saving...</> :
                 downloadStatus === 'done' ? <>✓ Saved!</> :
                 <><DownloadIcon /> Download</>}
              </button>
              <a href={tweetUrl} className="btn btn-x" target="_blank" rel="noopener">
                <XIcon /> Share on X
              </a>
              <button className="btn btn-ghost" onClick={handleCopy}>
                {copied ? <>✓ Copied!</> : <><CopyIcon /> Copy Text</>}
              </button>
            </div>

            {walletData.firstTxTimestamp && (
              <div style={{marginTop:'12px',display:'flex',justifyContent:'center'}}>
                <button
                  className="btn btn-purple-outline"
                  onClick={handleSubmitLeaderboard}
                  disabled={submitStatus === 'submitting' || submitStatus === 'done'}
                  style={{width:'100%'}}
                >
                  {submitStatus === 'idle' && '🏆 Submit to OG Leaderboard'}
                  {submitStatus === 'submitting' && '⏳ Submitting...'}
                  {submitStatus === 'done' && '✓ On the Leaderboard!'}
                  {submitStatus === 'error' && '✗ Submit failed — try again'}
                </button>
              </div>
            )}

            <p className="data-note">{walletData.source && `Data via ${walletData.source}`}</p>
            <button className="try-again" onClick={handleReset}>← Try another wallet</button>
          </div>
        )}

        <div className="section-divider" style={{marginTop: step === 'result' ? '56px' : '72px'}} />

        <div className="leaderboard-section">
          <div className="section-header">
            <div>
              <h2 className="section-title">OG <span>Leaderboard</span></h2>
              <p className="section-sub">Earliest Polygon wallets · ranked by first on-chain activity</p>
            </div>
            <button className="btn btn-ghost" onClick={loadLeaderboard} style={{fontSize:'11px',padding:'10px 14px'}}>↻ Refresh</button>
          </div>

          <table className="lb-table">
            <thead>
              <tr>
                <th style={{textAlign:'center'}}>#</th>
                <th>Wallet</th>
                <th>Era</th>
                <th>Badge</th>
                <th style={{textAlign:'right'}}>Days On-Chain</th>
              </tr>
            </thead>
            <tbody>
              {leaderboardLoading ? (
                <tr><td colSpan={5}><div className="lb-loading"><div className="loading-ring" style={{width:28,height:28}} /></div></td></tr>
              ) : leaderboard.length === 0 ? (
                <tr><td colSpan={5}><div className="lb-empty">No entries yet. Be the first to submit! 🟣</div></td></tr>
              ) : leaderboard.map((entry, i) => {
                const isYou = walletData?.address.toLowerCase() === entry.address.toLowerCase()
                return (
                  <tr key={entry.address} className={isYou ? 'is-you' : ''}>
                    <td className={`lb-rank${i < 3 ? ' top3' : ''}`}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </td>
                    <td className={`lb-address${isYou ? ' is-you-text' : ''}`}>
                      {shortenAddress(entry.address)}{isYou ? ' (you)' : ''}
                    </td>
                    <td className="lb-era">{entry.eraEmoji} {entry.era}</td>
                    <td><span className="lb-badge">{entry.badgeLabel}</span></td>
                    <td className="lb-days">{entry.daysOnChain?.toLocaleString()} days</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <footer>
          Built for Polygon&apos;s 6th Birthday · May 30, 2026<br />
          Data from{' '}
          <a href="https://polygonscan.com" target="_blank" rel="noopener">Polygonscan</a>
          {' '}&amp;{' '}
          <a href="https://polygon-rpc.com" target="_blank" rel="noopener">Polygon RPC</a>
          <div className="footer-love">
            Built with <span>💜</span> by{' '}
            <a href="https://x.com/mojeebeth" target="_blank" rel="noopener">@mojeebeth</a>
            {' '}in celebration of six years of Polygon
          </div>
        </footer>
      </div>
    </>
  )
}

function PolygonSVG({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pg1" x1="0" y1="0" x2="38" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7B3FE4"/>
          <stop offset="100%" stopColor="#A855F7"/>
        </linearGradient>
      </defs>
      <rect width="38" height="38" rx="10" fill="url(#pg1)" opacity="0.18"/>
      <path d="M25.5 14.3l-4.8-2.8c-.44-.25-.98-.25-1.4 0l-4.8 2.8c-.44.26-.7.73-.7 1.24v5.5c0 .51.26.98.7 1.24l4.8 2.8c.44.25.98.25 1.4 0l4.8-2.8c.44-.26.7-.73.7-1.24v-5.5c0-.51-.26-.98-.7-1.24z" stroke="url(#pg1)" strokeWidth="1.5" fill="none"/>
      <circle cx="19" cy="19" r="3" fill="url(#pg1)"/>
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  )
}

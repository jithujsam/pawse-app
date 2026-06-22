import { useEffect, useRef, useState, useCallback } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Activity, Eye, Shield } from 'lucide-react'

gsap.registerPlugin(ScrollTrigger)

/* ─── Card 1: Diagnostic Shuffler ─── */
function ShufflerCard({ labels }) {
  const [items, setItems] = useState(labels)
  const cardRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    const interval = setInterval(() => {
      setItems((prev) => {
        const copy = [...prev]
        const last = copy.pop()
        copy.unshift(last)
        return copy
      })
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        containerRef.current?.children,
        { y: -10, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out', stagger: 0.06 }
      )

      ScrollTrigger.create({
        trigger: cardRef.current,
        start: 'top 85%',
        onEnter: () => {
          gsap.fromTo(
            cardRef.current,
            { y: 40, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' }
          )
        },
      })
    }, cardRef)
    return () => ctx.revert()
  }, [items])

  return (
    <div ref={cardRef} className="bg-cream border border-moss/10 rounded-[2rem] p-6 md:p-8 shadow-lg shadow-moss/5 flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-[1rem] bg-moss/10 flex items-center justify-center">
          <Eye size={18} className="text-moss" />
        </div>
        <h3 className="font-heading font-bold text-lg text-charcoal tracking-tight">
          Stops silent churn
        </h3>
      </div>
      <p className="font-mono text-xs text-charcoal/50 mb-6">
        Clients rarely cancel over bad results — they cancel from silence.
      </p>

      <div ref={containerRef} className="relative flex-1 flex flex-col gap-3 justify-center">
        {items.map((item, i) => (
          <div
            key={item}
            className="shuffler-card bg-white rounded-[1.25rem] px-4 py-3
                       border border-moss/5 shadow-sm
                       font-heading font-medium text-sm text-charcoal/80"
            style={{ zIndex: labels.length - i }}
          >
            <span className="font-mono text-xs text-clay/60 mr-3">
              {(i + 1).toString().padStart(2, '0')}
            </span>
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Card 2: Telemetry Typewriter ─── */
const messages = [
  'Campaign "Q2 Outreach" — 4,280 emails delivered',
  'Open rate: 47.3% — above benchmark by 12%',
  'Reply received: "Let\'s schedule a call"',
  'Client dashboard updated — 3 new activities',
  'Bounce rate: 1.2% — list quality check passed',
  'A/B test variant B winning by 23%',
  'Timeline: 6 new events in the last hour',
]

function TypewriterCard() {
  const [displayed, setDisplayed] = useState('')
  const [msgIndex, setMsgIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)
  const cardRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: cardRef.current,
        start: 'top 85%',
        onEnter: () => {
          gsap.fromTo(
            cardRef.current,
            { y: 40, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 0.15 }
          )
        },
      })
    }, cardRef)
    return () => ctx.revert()
  }, [])

  useEffect(() => {
    const currentMsg = messages[msgIndex]
    if (charIndex < currentMsg.length) {
      const timer = setTimeout(() => {
        setDisplayed(currentMsg.slice(0, charIndex + 1))
        setCharIndex(charIndex + 1)
      }, 25 + Math.random() * 35)
      return () => clearTimeout(timer)
    } else {
      const timer = setTimeout(() => {
        setDisplayed('')
        setCharIndex(0)
        setMsgIndex((prev) => (prev + 1) % messages.length)
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [charIndex, msgIndex])

  return (
    <div ref={cardRef} className="bg-cream border border-moss/10 rounded-[2rem] p-6 md:p-8 shadow-lg shadow-moss/5 flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-[1rem] bg-moss/10 flex items-center justify-center">
          <Activity size={18} className="text-moss" />
        </div>
        <h3 className="font-heading font-bold text-lg text-charcoal tracking-tight">
          Live visibility
        </h3>
      </div>
      <p className="font-mono text-xs text-charcoal/50 mb-6">
        No manual reports. Continuous updates, always running.
      </p>

      <div className="flex-1 bg-white rounded-[1.25rem] p-4 border border-moss/5 flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2 h-2 rounded-full bg-green-500 pulse-dot" />
          <span className="font-mono text-[10px] text-charcoal/40 uppercase tracking-widest">
            Live Feed
          </span>
        </div>
        <div className="flex-1 flex items-center font-mono text-xs text-charcoal/80 leading-relaxed">
          <span>{displayed}</span>
          <span className="typewriter-cursor inline-block w-[2px] h-[14px] bg-clay ml-[1px]" />
        </div>
      </div>
    </div>
  )
}

/* ─── Card 3: Cursor Protocol Scheduler ─── */
const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function SchedulerCard() {
  const cardRef = useRef(null)
  const svgRef = useRef(null)
  const [activeDay, setActiveDay] = useState(-1)

  useEffect(() => {
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: cardRef.current,
        start: 'top 85%',
        onEnter: () => {
          gsap.fromTo(
            cardRef.current,
            { y: 40, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 0.3 }
          )
        },
      })
    }, cardRef)
    return () => ctx.revert()
  }, [])

  useEffect(() => {
    if (!svgRef.current) return
    const cursor = svgRef.current.querySelector('#cursor')
    const dayEls = svgRef.current.querySelectorAll('.day-cell')
    const saveBtn = svgRef.current.querySelector('#save-btn')
    if (!cursor || !dayEls.length || !saveBtn) return

    const timeline = gsap.timeline({ repeat: -1, repeatDelay: 3 })
    const cellWidth = 34
    const startX = 43

    // Move to Wednesday (index 3)
    timeline.to(cursor, {
      x: startX + 3 * cellWidth,
      y: 0,
      duration: 0.8,
      ease: 'power3.out',
    })
    timeline.to(cursor, { scale: 0.95, duration: 0.15, ease: 'power2.out' })
    timeline.call(() => setActiveDay(3), [], 0)
    timeline.to(cursor, { scale: 1, duration: 0.15, ease: 'power2.out' })
    timeline.to({}, { duration: 0.5 })

    // Move to Friday (index 5)
    timeline.to(cursor, {
      x: startX + 5 * cellWidth,
      y: 0,
      duration: 0.6,
      ease: 'power3.out',
    })
    timeline.to(cursor, { scale: 0.95, duration: 0.15, ease: 'power2.out' })
    timeline.call(() => setActiveDay(5), [], 0)
    timeline.to(cursor, { scale: 1, duration: 0.15, ease: 'power2.out' })
    timeline.to({}, { duration: 0.5 })

    // Move to Save button
    timeline.to(cursor, {
      x: 220,
      y: 0,
      duration: 0.6,
      ease: 'power3.out',
    })
    timeline.to(cursor, { scale: 0.95, duration: 0.15, ease: 'power2.out' })
    timeline.to(cursor, { scale: 1, duration: 0.15, ease: 'power2.out' })
    timeline.to({}, { duration: 0.5 })
    timeline.to(cursor, { opacity: 0, duration: 0.3, ease: 'power2.out' })

    return () => timeline.kill()
  }, [])

  return (
    <div ref={cardRef} className="bg-cream border border-moss/10 rounded-[2rem] p-6 md:p-8 shadow-lg shadow-moss/5 flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-[1rem] bg-moss/10 flex items-center justify-center">
          <Shield size={18} className="text-moss" />
        </div>
        <h3 className="font-heading font-bold text-lg text-charcoal tracking-tight">
          Provable retention
        </h3>
      </div>
      <p className="font-mono text-xs text-charcoal/50 mb-6">
        Real-time proof, not promises. Trust that compounds daily.
      </p>

      <div className="flex-1 bg-white rounded-[1.25rem] p-4 border border-moss/5">
        <p className="font-mono text-[10px] text-charcoal/40 uppercase tracking-widest mb-4">
          Schedule — Weekly Review
        </p>

        <div className="relative">
          <svg ref={svgRef} viewBox="0 0 280 68" className="w-full h-auto">
            {/* Days */}
            {days.map((d, i) => (
              <g key={d}>
                <rect
                  className="day-cell"
                  x={36 + i * 34}
                  y={2}
                  width={28}
                  height={28}
                  rx={8}
                  fill={activeDay === i ? '#CC5833' : '#F2F0E9'}
                  stroke={activeDay === i ? '#CC5833' : '#E8E4DD'}
                  strokeWidth={1}
                />
                <text
                  x={36 + i * 34 + 14}
                  y={21}
                  textAnchor="middle"
                  className="font-mono text-xs"
                  fill={activeDay === i ? '#FFFFFF' : '#1A1A1A'}
                  style={{ fontSize: '11px', fontWeight: 600 }}
                >
                  {d}
                </text>
              </g>
            ))}

            {/* Save button */}
            <rect id="save-btn" x={200} y={2} width={70} height={28} rx={10} fill="#CC5833" />
            <text
              x={235}
              y={21}
              textAnchor="middle"
              fill="#FFFFFF"
              className="font-mono text-xs"
              style={{ fontSize: '10px', fontWeight: 600 }}
            >
              Save
            </text>

            {/* Animated cursor */}
            <g id="cursor" transform="translate(43, 5)">
              <path
                d="M0 0 L10 4 L6 8 L14 18 L10 20 L2 10 L0 14 Z"
                fill="#1A1A1A"
                opacity={0.85}
              />
            </g>
          </svg>

          <p className="font-mono text-[10px] text-charcoal/40 mt-3 text-center">
            {activeDay >= 0
              ? `Selected: ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][activeDay]}`
              : 'Watching availability...'}
          </p>
        </div>
      </div>
    </div>
  )
}

/* ─── Features Section ─── */
export default function Features() {
  const sectionRef = useRef(null)

  const shufflerLabels = [
    'Confidence score: 94% — client trust increasing',
    'Last contact: 2h ago — within safe window',
    'Silent risk: Low — 0 flags raised',
  ]

  return (
    <section id="features" ref={sectionRef} className="relative px-6 py-24 md:py-32 md:px-16 lg:px-24 bg-cream">
      <div className="max-w-6xl mx-auto">
        <div className="mb-16">
          <span className="font-mono text-xs text-clay/60 uppercase tracking-[0.2em]">
            01 — Capabilities
          </span>
          <h2 className="font-heading font-bold text-3xl md:text-5xl text-charcoal mt-4 tracking-tight">
            Three things Klaroh does<br />so you don't lose clients
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ShufflerCard labels={shufflerLabels} />
          <TypewriterCard />
          <SchedulerCard />
        </div>
      </div>
    </section>
  )
}

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

function RotatingHelix() {
  const svgRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to(svgRef.current?.querySelector('#helix-group'), {
        rotation: 360,
        duration: 20,
        repeat: -1,
        ease: 'none',
        transformOrigin: 'center center',
      })
    }, svgRef)
    return () => ctx.revert()
  }, [])

  return (
    <svg ref={svgRef} viewBox="0 0 200 200" className="w-32 h-32 md:w-40 md:h-40 opacity-20">
      <g id="helix-group">
        <circle cx="100" cy="100" r="60" fill="none" stroke="#F2F0E9" strokeWidth="0.5" />
        <circle cx="100" cy="100" r="40" fill="none" stroke="#F2F0E9" strokeWidth="0.5" />
        <circle cx="100" cy="100" r="80" fill="none" stroke="#F2F0E9" strokeWidth="0.3" />
        <path
          d="M40 100 Q70 60 100 100 Q130 140 160 100"
          fill="none"
          stroke="#CC5833"
          strokeWidth="1"
          opacity={0.6}
        />
        <path
          d="M40 100 Q70 140 100 100 Q130 60 160 100"
          fill="none"
          stroke="#2E4036"
          strokeWidth="1"
          opacity={0.6}
        />
      </g>
    </svg>
  )
}

function ScanningLaser() {
  const svgRef = useRef(null)
  const laserRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to(laserRef.current, {
        y: 120,
        duration: 2.5,
        repeat: -1,
        ease: 'power1.inOut',
        yoyo: true,
      })
    }, svgRef)
    return () => ctx.revert()
  }, [])

  return (
    <svg ref={svgRef} viewBox="0 0 200 160" className="w-32 h-28 md:w-40 md:h-32 opacity-20">
      {/* Grid */}
      {Array.from({ length: 5 }).map((_, row) =>
        Array.from({ length: 7 }).map((_, col) => (
          <circle
            key={`${row}-${col}`}
            cx={25 + col * 25}
            cy={20 + row * 25}
            r={2}
            fill="#F2F0E9"
            opacity={0.4}
          />
        ))
      )}
      {/* Laser line */}
      <rect
        ref={laserRef}
        x={10}
        y={0}
        width={180}
        height={2}
        fill="#CC5833"
        opacity={0.8}
        rx={1}
      />
      {/* Glow */}
      <rect
        x={10}
        y={0}
        width={180}
        height={8}
        fill="#CC5833"
        opacity={0.15}
        rx={4}
      />
    </svg>
  )
}

function PulsingWaveform() {
  const pathRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to(pathRef.current, {
        strokeDashoffset: -400,
        duration: 2,
        repeat: -1,
        ease: 'none',
      })
    })

    const path = pathRef.current
    if (path) {
      const length = path.getTotalLength()
      path.style.strokeDasharray = length
      path.style.strokeDashoffset = 0
    }

    return () => ctx.revert()
  }, [])

  return (
    <svg viewBox="0 0 240 100" className="w-36 h-16 md:w-48 md:h-20 opacity-20">
      <path
        ref={pathRef}
        d="M10 50 Q20 20 30 50 T50 50 T70 50 T90 50 T110 50 T130 50 T150 50 T170 50 T190 50 T210 50 T230 50"
        fill="none"
        stroke="#CC5833"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Baseline */}
      <line x1="10" y1="50" x2="230" y2="50" stroke="#F2F0E9" strokeWidth="0.3" opacity={0.3} />
    </svg>
  )
}

const steps = [
  {
    num: '01',
    title: 'Connect',
    desc: 'Link your campaign data in seconds. Import from any major email platform.',
    Svg: RotatingHelix,
  },
  {
    num: '02',
    title: 'Monitor',
    desc: 'Live activity timeline tracks every open, reply, and milestone. Zero manual work.',
    Svg: ScanningLaser,
  },
  {
    num: '03',
    title: 'Retain',
    desc: 'Clients see their dashboard — trust compounds daily. Silent churn never starts.',
    Svg: PulsingWaveform,
  },
]

export default function Protocol() {
  const sectionRef = useRef(null)
  const cardsRef = useRef([])

  useEffect(() => {
    const ctx = gsap.context(() => {
      cardsRef.current.forEach((card, i) => {
        if (!card) return
        const numEl = card.querySelector('.step-num')
        const titleEl = card.querySelector('.step-title')
        const descEl = card.querySelector('.step-desc')

        ScrollTrigger.create({
          trigger: card,
          start: 'top 75%',
          end: 'bottom 25%',
          onEnter: () => {
            gsap.fromTo(
              [numEl, titleEl, descEl],
              { y: 30, opacity: 0 },
              {
                y: 0,
                opacity: 1,
                duration: 0.6,
                ease: 'power3.out',
                stagger: 0.12,
              }
            )
          },
        })

        // Stacking effect
        ScrollTrigger.create({
          trigger: card,
          start: 'top 10%',
          end: 'bottom 10%',
          onUpdate: (self) => {
            const progress = self.progress
            const prevCard = cardsRef.current[i - 1]
            if (prevCard) {
              const scale = 1 - progress * 0.1
              const blur = progress * 20
              const opacity = 1 - progress * 0.5
              gsap.set(prevCard, {
                scale: Math.max(scale, 0.9),
                filter: `blur(${blur}px)`,
                opacity: Math.max(opacity, 0.5),
              })
            }
            if (i === cardsRef.current.length - 1) {
              const nextCard = cardsRef.current[i + 1]
              if (nextCard) {
                gsap.set(nextCard, { opacity: 1, scale: 1, filter: 'blur(0px)' })
              }
            }
          },
        })
      })
    }, sectionRef)
    return () => ctx.revert()
  }, [])

  return (
    <section
      id="protocol"
      ref={sectionRef}
      className="relative bg-cream pt-24 pb-8"
    >
      <div className="px-6 md:px-16 lg:px-24 mb-16">
        <span className="font-mono text-xs text-clay/60 uppercase tracking-[0.2em]">
          03 — Protocol
        </span>
        <h2 className="font-heading font-bold text-3xl md:text-5xl text-charcoal mt-4 tracking-tight">
          How it works
        </h2>
      </div>

      {steps.map((step, i) => {
        const SvgComponent = step.Svg
        return (
          <div
            key={step.num}
            ref={(el) => (cardsRef.current[i] = el)}
            className="sticky top-0 min-h-[80dvh] md:min-h-[70dvh] flex items-center
                       px-6 md:px-16 lg:px-24"
            style={{ zIndex: 30 - i }}
          >
            <div
              className="w-full bg-charcoal rounded-[3rem] p-8 md:p-16
                          border border-moss/20 shadow-2xl shadow-moss/20"
            >
              <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-start gap-8 md:gap-16">
                <div className="flex-1">
                  <span className="step-num font-mono text-sm text-clay/60">{step.num}</span>
                  <h3 className="step-title font-heading font-bold text-3xl md:text-5xl text-cream mt-3 tracking-tight">
                    {step.title}
                  </h3>
                  <p className="step-desc font-heading text-base md:text-lg text-cream/50 mt-4 max-w-md leading-relaxed">
                    {step.desc}
                  </p>
                </div>
                <div className="flex-shrink-0 flex items-center justify-center w-full md:w-auto">
                  <SvgComponent />
                </div>
              </div>
            </div>
          </div>
        )
      })}

      <div className="h-[40dvh]" />
    </section>
  )
}

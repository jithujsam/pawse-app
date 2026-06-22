import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export default function Philosophy() {
  const sectionRef = useRef(null)
  const line1Ref = useRef(null)
  const line2Ref = useRef(null)
  const textRef = useRef(null)
  const imgRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Parallax the background image
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: (self) => {
          if (imgRef.current) {
            imgRef.current.style.transform = `translateY(${self.progress * 30 - 15}px)`
          }
        },
      })

      // Reveal text lines on scroll
      const lines = textRef.current?.querySelectorAll('.reveal-line')
      if (lines) {
        ScrollTrigger.create({
          trigger: sectionRef.current,
          start: 'top 70%',
          onEnter: () => {
            gsap.fromTo(
              lines,
              { y: 40, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', stagger: 0.2 }
            )
          },
        })
      }
    }, sectionRef)
    return () => ctx.revert()
  }, [])

  return (
    <section
      id="philosophy"
      ref={sectionRef}
      className="relative overflow-hidden bg-charcoal py-24 md:py-40 px-6 md:px-16 lg:px-24"
    >
      {/* Parallax texture image */}
      <div className="absolute inset-0 overflow-hidden">
        <img
          ref={imgRef}
          src="https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1600&q=80"
          alt=""
          className="w-full h-[130%] object-cover opacity-[0.06]"
        />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto">
        <div className="mb-8">
          <span className="font-mono text-xs text-clay/40 uppercase tracking-[0.2em]">
            02 — Philosophy
          </span>
        </div>

        <div ref={textRef} className="space-y-8 md:space-y-12">
          <p className="reveal-line font-heading text-xl md:text-2xl text-cream/40 max-w-2xl leading-relaxed">
            Most agencies focus on: sending more outreach, refining sequences, and hitting higher reply rates.
          </p>

          <p className="reveal-line font-drama italic text-4xl md:text-6xl lg:text-7xl text-cream max-w-4xl leading-[1.15]">
            We focus on:{' '}
            <span className="text-clay">making every client feel<br />every win in real time.</span>
          </p>

          <p className="reveal-line font-mono text-sm text-cream/30 max-w-xl leading-relaxed">
            Retention is not a monthly check-in call. It is a continuous signal
            that compounds trust daily — or erodes it through silence.
          </p>
        </div>
      </div>
    </section>
  )
}

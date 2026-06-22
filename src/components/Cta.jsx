import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ArrowRight, Sparkles } from 'lucide-react'

gsap.registerPlugin(ScrollTrigger)

export default function Cta() {
  const sectionRef = useRef(null)
  const contentRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'top 80%',
        onEnter: () => {
          gsap.fromTo(
            contentRef.current?.children,
            { y: 40, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', stagger: 0.12 }
          )
        },
      })
    }, sectionRef)
    return () => ctx.revert()
  }, [])

  return (
    <section
      id="cta"
      ref={sectionRef}
      className="relative px-6 py-24 md:py-32 md:px-16 lg:px-24 bg-cream"
    >
      <div className="max-w-4xl mx-auto text-center">
        <div ref={contentRef} className="space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-[1rem] bg-moss/5 border border-moss/10">
            <Sparkles size={14} className="text-clay" />
            <span className="font-mono text-xs text-charcoal/50 uppercase tracking-wider">
              Early access — limited spots
            </span>
          </div>

          <h2 className="font-heading font-bold text-3xl md:text-5xl lg:text-6xl text-charcoal tracking-tight leading-[1.1]">
            Stop losing clients to<br />
            <span className="text-clay">silence you never heard.</span>
          </h2>

          <p className="font-heading text-base md:text-lg text-charcoal/50 max-w-xl mx-auto leading-relaxed">
            Join the waitlist. Be the first to give your clients a live window
            into every campaign win — and never let doubt build quietly again.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <a
              href="#"
              className="magnetic-btn relative inline-flex items-center gap-2 px-8 py-4
                         rounded-[1.5rem] bg-clay text-white font-heading font-semibold
                         text-base tracking-wide hover:bg-clay/90 group"
            >
              <span className="btn-bg" />
              <span className="relative z-10">Join the waitlist</span>
              <ArrowRight
                size={16}
                className="relative z-10 transition-transform duration-300 group-hover:translate-x-1"
              />
            </a>
            <span className="font-mono text-xs text-charcoal/40">
              No spam. No pitch decks. Just early access.
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

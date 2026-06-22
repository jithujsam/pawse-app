import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Features from './components/Features'
import Philosophy from './components/Philosophy'
import Protocol from './components/Protocol'
import Cta from './components/Cta'
import Footer from './components/Footer'

export default function App() {
  return (
    <div className="noise-overlay relative min-h-screen bg-cream text-charcoal overflow-x-hidden">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Philosophy />
        <Protocol />
        <Cta />
      </main>
      <Footer />
    </div>
  )
}

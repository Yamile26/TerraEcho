
import { useEffect, useState } from 'react'

import './App.css'
import astracomLogo from './assets/astracom-logo.png'
import MapView from './components/MapView'
import AudioPlayer from './components/AudioPlayer'

function App() {
  const [weeks, setWeeks] = useState([])
  const [selectedWeek, setSelectedWeek] = useState(0)
  const [loadingData, setLoadingData] = useState(true)
  const [dataError, setDataError] = useState('')

  // Carga los datos semanales de TerraEcho.
  useEffect(() => {
    fetch('/data/terraecho_2026.json')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Could not load TerraEcho data.')
        }

        return response.json()
      })
      .then((data) => {
        setWeeks(data.weeks || [])
        setLoadingData(false)
      })
      .catch((error) => {
        setDataError(error.message)
        setLoadingData(false)
      })
  }, [])

  // Obtiene los datos de la semana actualmente seleccionada.
  const selectedWeekData = weeks[selectedWeek] || null

  return (
    <main className="app">

      {/* NAVEGACIÓN */}
      <header className="navbar">
        <a href="#home" className="brand">
          <span className="brand-symbol">◉</span>
          <span>
            TERRA<span className="highlight">ECHO</span>
          </span>
        </a>

        <nav>
          <a href="#home">Home</a>
          <a href="#explore">Explore</a>
          <a href="#listen">Listen</a>
          <a href="#about">About</a>
        </nav>

        <div className="team-logo">
          <img src={astracomLogo} alt="AstraCom" />
        </div>
      </header>

      {/* INICIO */}
      <section className="hero-section" id="home">

        <div className="hero-content">
          <div className="status-label">
            <span className="status-dot"></span>
            NASA SPACE APPS CHALLENGE 2026
          </div>

          <h1>
            Hear when the forest
            <br />
            burns out of <span className="highlight">tune.</span>
          </h1>

          <p className="hero-description">
            Discover the hidden patterns of environmental change
            through satellite data, sound and interactive visualization.
          </p>

          <div className="hero-actions">
            <a href="#explore" className="explore-button">
              Explore TerraEcho <span>→</span>
            </a>

            <a href="#about" className="secondary-button">
              Discover the project
            </a>
          </div>

          <div className="hero-caption">
            <span>01 / EARTH OBSERVATION</span>
            <span>PERU · 2012—2026</span>
          </div>
        </div>

        {/* VISUALIZACIÓN ESPACIAL */}
        <div className="hero-visual">
          <div className="orbit orbit-one"></div>
          <div className="orbit orbit-two"></div>

          <div className="planet">
            <div className="planet-glow"></div>
            <span className="planet-label">EARTH</span>
          </div>

          <div className="visual-caption">
            <span>LISTEN TO THE PLANET</span>
            <span>DATA BECOMES SOUND</span>
          </div>
        </div>

      </section>

      {/* MAPA INTERACTIVO */}
      <section className="map-section" id="explore">

        <div className="section-heading">
          <div>
            <p className="eyebrow">01 — ENVIRONMENTAL MONITORING</p>
            <h2>Peru in <span className="highlight">focus.</span></h2>
            <p>
              Explore thermal anomalies detected by satellite observations.
            </p>
          </div>

          <span className="section-tag">NASA FIRMS DATA</span>
        </div>

        {loadingData && (
          <div className="map-message">
            Loading satellite data...
          </div>
        )}

        {dataError && (
          <div className="map-message">
            Error: {dataError}
          </div>
        )}

        {!loadingData && !dataError && weeks.length > 0 && (
          <MapView
            weeks={weeks}
            selectedWeek={selectedWeek}
            onWeekChange={setSelectedWeek}
          />
        )}

        {!loadingData && !dataError && weeks.length === 0 && (
          <div className="map-message">
            No weekly data available.
          </div>
        )}

      </section>

      {/* CÓMO INTERPRETAR EL MAPA */}
      <section className="legend-section">

        <div className="legend-heading">
          <p className="eyebrow">HOW TO READ THE MAP</p>
          <h2>Understanding the <span className="highlight">signals.</span></h2>
          <p>
            Learn what each color represents in TerraEcho's
            thermal anomaly visualization.
          </p>
        </div>

        <div className="legend-cards">

          <div className="legend-card">
            <span className="legend-dot normal-dot"></span>
            <h3>Normal</h3>
            <p>
              Activity within the usual range.
              No significant anomaly detected by the model.
            </p>
          </div>

          <div className="legend-card">
            <span className="legend-dot elevated-dot"></span>
            <h3>Elevated</h3>
            <p>
              Thermal activity above the usual range
              compared with historical observations.
            </p>
          </div>

          <div className="legend-card">
            <span className="legend-dot critical-dot"></span>
            <h3>Critical</h3>
            <p>
              High anomaly according to the model,
              indicating an unusual level of thermal activity.
            </p>
          </div>

        </div>

        <div className="legend-note">
          <span>ⓘ</span>
          Thermal anomalies detected by satellites do not
          necessarily represent confirmed wildfires.
        </div>

      </section>

      {/* REPRODUCTOR DE SONIFICACIÓN */}
      <AudioPlayer selectedWeekData={selectedWeekData} />

      {/* INFORMACIÓN DEL PROYECTO */}
      <section className="about-section" id="about">
        <p className="eyebrow">03 — ABOUT THE PROJECT</p>

        <h2>
          Turning satellite data into a new way of listening.
        </h2>

        <p>
          TerraEcho transforms environmental data into sound,
          revealing unusual patterns in thermal activity across Peru.
        </p>

        <div className="about-team">
          <img src={astracomLogo} alt="Team AstraCom" />
          <span>Created by Team AstraCom</span>
        </div>
      </section>

      {/* PIE DE PÁGINA */}
      <footer>
        <span>TerraEcho © 2026</span>
        <span>Powered by NASA FIRMS data</span>
        <span>TEAM ASTRACOM</span>
      </footer>

    </main>
  )
}

export default App

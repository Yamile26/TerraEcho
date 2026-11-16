
import { useEffect, useRef, useState } from 'react'
import './AudioPlayer.css'

const audioFiles = {
  2025: '/audio/terraecho_2025.wav',
  2026: '/audio/terraecho_2026.wav',
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00'

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

function midiToFrequency(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

function AudioPlayer({ selectedWeekData }) {
  const audioRef = useRef(null)
  const audioContextRef = useRef(null)
  const activeNodesRef = useRef([])
  const stopTimerRef = useRef(null)

  const [mode, setMode] = useState('annual')
  const [year, setYear] = useState('2026')
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.75)
  const [error, setError] = useState('')

  // Detiene todos los sonidos semanales.
  function stopWeeklySound() {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current)
      stopTimerRef.current = null
    }

    activeNodesRef.current.forEach((node) => {
      try {
        node.stop()
      } catch {
        // El sonido ya había terminado.
      }

      try {
        node.disconnect()
      } catch {
        // El nodo ya estaba desconectado.
      }
    })

    activeNodesRef.current = []
  }

  function stopAllAudio() {
    if (audioRef.current) {
      audioRef.current.pause()
    }

    stopWeeklySound()
    setIsPlaying(false)
  }

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume])

  useEffect(() => {
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setError('')

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.load()
    }
  }, [year])

  useEffect(() => {
    return () => {
      stopWeeklySound()

      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  // Crea una nota con pulsos y envolvente de volumen.
  function createPulsedNote({
    context,
    destination,
    frequency,
    detune,
    pan,
    gain,
    density,
    dissonance,
    startTime,
    durationSeconds,
    interval = 0,
    partnerGain = 0
  }) {
    const pulseCount = Math.max(1, Math.min(Math.round(density), 4))
    const pulseSpacing = durationSeconds / pulseCount
    const pulseDuration = Math.min(0.42, pulseSpacing * 0.72)

    // La disonancia modifica el timbre.
    let waveform = 'sine'

    if (dissonance >= 0.66) {
      waveform = 'sawtooth'
    } else if (dissonance >= 0.33) {
      waveform = 'triangle'
    }

    for (let pulse = 0; pulse < pulseCount; pulse++) {
      const pulseStart = startTime + pulse * pulseSpacing
      const pulseEnd = pulseStart + pulseDuration

      const oscillator = context.createOscillator()
      const envelope = context.createGain()
      const panner = context.createStereoPanner()

      oscillator.type = waveform
      oscillator.frequency.value = frequency
      oscillator.detune.value = detune

      panner.pan.value = pan

      const amplitude = gain * (0.035 + dissonance * 0.025)

      envelope.gain.setValueAtTime(0, pulseStart)
      envelope.gain.linearRampToValueAtTime(
        amplitude,
        pulseStart + 0.035
      )
      envelope.gain.setValueAtTime(
        amplitude,
        Math.max(pulseStart + 0.04, pulseEnd - 0.06)
      )
      envelope.gain.linearRampToValueAtTime(0, pulseEnd)

      oscillator.connect(envelope)
      envelope.connect(panner)
      panner.connect(destination)

      oscillator.start(pulseStart)
      oscillator.stop(pulseEnd)

      activeNodesRef.current.push(oscillator, envelope, panner)

      // Segunda nota determinada por el intervalo musical del JSON.
      if (partnerGain > 0.02 && interval > 0) {
        const partner = context.createOscillator()
        const partnerEnvelope = context.createGain()
        const partnerPanner = context.createStereoPanner()

        partner.type = waveform
        partner.frequency.value = midiToFrequency(
          69 + 12 * Math.log2(frequency / 440) + interval
        )
        partner.detune.value = detune

        partnerPanner.pan.value = pan

        const partnerAmplitude =
          amplitude * partnerGain * 0.65

        partnerEnvelope.gain.setValueAtTime(0, pulseStart)
        partnerEnvelope.gain.linearRampToValueAtTime(
          partnerAmplitude,
          pulseStart + 0.035
        )
        partnerEnvelope.gain.setValueAtTime(
          partnerAmplitude,
          Math.max(pulseStart + 0.04, pulseEnd - 0.06)
        )
        partnerEnvelope.gain.linearRampToValueAtTime(0, pulseEnd)

        partner.connect(partnerEnvelope)
        partnerEnvelope.connect(partnerPanner)
        partnerPanner.connect(destination)

        partner.start(pulseStart)
        partner.stop(pulseEnd)

        activeNodesRef.current.push(
          partner,
          partnerEnvelope,
          partnerPanner
        )
      }
    }
  }

  // Genera el paisaje sonoro de la semana seleccionada.
  async function playWeeklySound() {
    if (!selectedWeekData) {
      setError('Weekly data is not available.')
      return
    }

    if (selectedWeekData.data_gap) {
      setError('There is no reliable satellite data for this week.')
      return
    }

    const cells = selectedWeekData.cells || []

    if (cells.length === 0) {
      setError('There are no thermal detections to sonify this week.')
      return
    }

    stopAllAudio()
    setError('')

    try {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext

      if (!AudioContextClass) {
        throw new Error('Web Audio API is not supported by this browser.')
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass()
      }

      const context = audioContextRef.current

      if (context.state === 'suspended') {
        await context.resume()
      }

      const masterGain = context.createGain()

      masterGain.gain.value = Math.max(
        0,
        Math.min(volume, 1)
      ) * 0.18

      masterGain.connect(context.destination)

      const durationSeconds = 6
      const startTime = context.currentTime + 0.08

      // Priorizamos las celdas con mayor contribución sonora.
      const selectedCells = [...cells]
        .sort((a, b) => (Number(b.gain) || 0) - (Number(a.gain) || 0))
        .slice(0, 18)

      selectedCells.forEach((cell, index) => {
        const midi = Number(cell.midi)

        if (!Number.isFinite(midi)) return

        const frequency = midiToFrequency(midi)

        const gain = Math.max(
          0.01,
          Math.min(Number(cell.gain) || 0.1, 1)
        )

        const density = Math.max(
          1,
          Math.min(Number(cell.density) || 1, 4)
        )

        const dissonance = Math.max(
          0,
          Math.min(Number(cell.dissonance) || 0, 1)
        )

        const pan = Math.max(
          -1,
          Math.min(Number(cell.pan) || 0, 1)
        )

        const detune = Number(cell.detune) || 0
        const interval = Number(cell.interval) || 7

        const partnerGain = Math.max(
          0,
          Math.min(Number(cell.partner_gain) || 0, 1)
        )

        createPulsedNote({
          context,
          destination: masterGain,
          frequency,
          detune,
          pan,
          gain,
          density,
          dissonance,
          startTime: startTime + (index % 6) * 0.035,
          durationSeconds,
          interval,
          partnerGain
        })
      })

      setIsPlaying(true)

      stopTimerRef.current = setTimeout(() => {
        activeNodesRef.current = []
        masterGain.disconnect()
        stopTimerRef.current = null
        setIsPlaying(false)
      }, durationSeconds * 1000 + 300)

    } catch (err) {
      stopWeeklySound()
      setIsPlaying(false)
      setError(err.message || 'The weekly sound could not be generated.')
    }
  }

  async function togglePlayback() {
    if (mode === 'weekly') {
      if (isPlaying) {
        stopWeeklySound()
        setIsPlaying(false)
      } else {
        await playWeeklySound()
      }

      return
    }

    const audio = audioRef.current
    if (!audio) return

    if (audio.paused) {
      try {
        setError('')
        await audio.play()
        setIsPlaying(true)
      } catch {
        setIsPlaying(false)
        setError('The audio could not be played. Please check that the file is available.')
      }
    } else {
      audio.pause()
      setIsPlaying(false)
    }
  }

  function handleTimeUpdate() {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  function handleLoadedMetadata() {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }

  function handleSeek(event) {
    const newTime = Number(event.target.value)

    if (audioRef.current) {
      audioRef.current.currentTime = newTime
      setCurrentTime(newTime)
    }
  }

  function handleEnded() {
    setIsPlaying(false)
    setCurrentTime(0)
  }

  function handleModeChange(newMode) {
    stopAllAudio()
    setMode(newMode)
    setCurrentTime(0)
    setDuration(0)
    setError('')
  }

  const weekNumber = selectedWeekData
    ? (selectedWeekData.week ?? 0) + 1
    : '—'

  const weeklyUnavailable =
    !selectedWeekData ||
    selectedWeekData.data_gap ||
    !(selectedWeekData.cells || []).length

  return (
    <section className="audio-section" id="listen">

      <div className="audio-heading">
        <p className="eyebrow">02 — LISTEN TO THE DATA</p>

        <h2>
          Hear the <span className="highlight">Earth.</span>
        </h2>

        <p>
          Explore the sound generated from satellite observations
          of thermal activity across Peru.
        </p>
      </div>

      <div className="audio-player">

        <div className="audio-mode-selector">
          <button
            type="button"
            className={mode === 'annual' ? 'active' : ''}
            onClick={() => handleModeChange('annual')}
          >
            Annual sonification
          </button>

          <button
            type="button"
            className={mode === 'weekly' ? 'active' : ''}
            onClick={() => handleModeChange('weekly')}
          >
            Weekly sonification
          </button>
        </div>

        <div className="audio-player-top">

          <div className="audio-track-info">
            <span className="audio-status-dot"></span>

            <div>
              <span className="audio-label">TERRAECHO SONIFICATION</span>

              <h3>
                {mode === 'annual'
                  ? `Thermal activity · ${year}`
                  : `Thermal activity · Week ${weekNumber}`}
              </h3>
            </div>
          </div>

          {mode === 'annual' ? (
            <label className="audio-year-selector">
              <span>YEAR</span>

              <select
                value={year}
                onChange={(event) => setYear(event.target.value)}
              >
                <option value="2025">2025</option>
                <option value="2026">2026</option>
              </select>
            </label>
          ) : (
            <div className="audio-year-selector">
              <span>SELECTED WEEK</span>
              <strong>W{weekNumber}</strong>
            </div>
          )}

        </div>

        <div className="audio-visual">
          <div className={`audio-wave ${isPlaying ? 'is-playing' : ''}`}>
            {Array.from({ length: 48 }, (_, index) => (
              <span
                key={index}
                style={{
                  '--bar-height': `${18 + ((index * 17 + 23) % 65)}%`,
                  '--bar-delay': `${(index % 12) * 0.06}s`,
                }}
              />
            ))}
          </div>

          <span className="wave-caption">
            {mode === 'annual'
              ? 'ANNUAL DATA BECOMES SOUND'
              : 'WEEKLY DATA BECOMES SOUND'}
          </span>
        </div>

        {mode === 'annual' && (
          <>
            <audio
              ref={audioRef}
              src={audioFiles[year]}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleEnded}
              onError={() => {
                setIsPlaying(false)
                setError('Audio file not found. Check the file inside web/public/audio.')
              }}
              preload="metadata"
            />

            <div className="audio-progress">
              <input
                type="range"
                min="0"
                max={duration || 0}
                step="0.1"
                value={Math.min(currentTime, duration || 0)}
                onChange={handleSeek}
                aria-label="Audio progress"
                className="progress-slider"
                style={{
                  '--progress': duration
                    ? `${(currentTime / duration) * 100}%`
                    : '0%',
                }}
              />

              <div className="audio-time">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </>
        )}

        {mode === 'weekly' && (
          <div className="weekly-audio-info">
            {selectedWeekData?.data_gap ? (
              <p>No reliable satellite data is available for this week.</p>
            ) : weeklyUnavailable ? (
              <p>No thermal detections available for this week.</p>
            ) : (
              <p>
                Sound generated from {selectedWeekData.cells.length} spatial
                cells using their musical parameters.
              </p>
            )}

            <span>APPROXIMATE DURATION · 6 SECONDS</span>
          </div>
        )}

        <div className="audio-controls">

          <button
            type="button"
            className="play-button"
            onClick={togglePlayback}
            disabled={mode === 'weekly' && weeklyUnavailable}
            aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
          >
            {isPlaying ? 'Ⅱ' : '▶'}
          </button>

          <span className="playback-label">
            {isPlaying ? 'NOW PLAYING' : 'READY TO LISTEN'}
          </span>

          <div className="volume-control">
            <span aria-hidden="true">VOL</span>

            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(event) => setVolume(Number(event.target.value))}
              aria-label="Volume"
            />
          </div>

        </div>

        {error && <p className="audio-error">{error}</p>}

      </div>

      <p className="audio-note">
        Sound generated from the team's processed NASA FIRMS data.
        Thermal detections are not necessarily confirmed wildfires.
      </p>

    </section>
  )
}

export default AudioPlayer


import { useEffect, useState } from 'react'

import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup
} from 'react-leaflet'

import 'leaflet/dist/leaflet.css'

function MapView({
  weeks: externalWeeks,
  selectedWeek: externalSelectedWeek,
  onWeekChange
}) {
  const [internalWeeks, setInternalWeeks] = useState([])
  const [internalSelectedWeek, setInternalSelectedWeek] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Comprueba si App.jsx está controlando los datos.
  const isControlled = Array.isArray(externalWeeks)

  const weeks = isControlled ? externalWeeks : internalWeeks

  const selectedWeek = isControlled
    ? (externalSelectedWeek ?? 0)
    : internalSelectedWeek

  // Actualiza la semana seleccionada.
  function handleWeekChange(index) {
    if (!Number.isInteger(index) || index < 0 || index >= weeks.length) {
      return
    }

    if (!isControlled) {
      setInternalSelectedWeek(index)
    }

    if (onWeekChange) {
      onWeekChange(index)
    }
  }

  // Carga de respaldo si App.jsx no envía los datos.
  useEffect(() => {
    if (isControlled) return

    fetch('/data/terraecho_2026.json')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Could not load satellite data')
        }

        return response.json()
      })
      .then((data) => {
        setInternalWeeks(data.weeks || [])
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [isControlled])

  if (!isControlled && loading) {
    return <div className="map-message">Loading satellite data...</div>
  }

  if (!isControlled && error) {
    return <div className="map-message">Error: {error}</div>
  }

  if (weeks.length === 0) {
    return <div className="map-message">No weekly data available.</div>
  }

  // Evita seleccionar una posición que no exista.
  const safeSelectedWeek = Math.max(
    0,
    Math.min(selectedWeek, weeks.length - 1)
  )

  const weekData = weeks[safeSelectedWeek]
  const cells = weekData.cells || []

  const getColor = (level) => {
    if (level === 'critical') return '#ff5b64'
    if (level === 'elevated') return '#ffbd59'
    return '#00cfff'
  }

  const countryLevel = weekData.country?.level || 'no_data'

  const formatLevel = (level) => {
    const labels = {
      normal: 'Normal',
      elevated: 'Elevated',
      critical: 'Critical',
      no_data: 'No data'
    }

    return labels[level] || level
  }

  // Dimensiones de la gráfica.
  const chartWidth = 1000
  const chartHeight = 390
  const chartLeft = 95
  const chartRight = 970
  const chartTop = 35
  const chartBottom = 285

  // Escala basada en las semanas con datos.
  const validCounts = weeks
    .filter((week) => !week.data_gap)
    .map((week) => week.country?.count ?? 0)

  const maxCount = Math.max(...validCounts, 1)

  const getX = (index) => {
    if (weeks.length <= 1) return chartLeft

    return chartLeft +
      (index / (weeks.length - 1)) *
      (chartRight - chartLeft)
  }

  const getY = (count) => {
    return chartBottom -
      (count / maxCount) *
      (chartBottom - chartTop)
  }

  return (
    <div className="map-wrapper">

      {/* SELECTOR SEMANAL */}
      <div className="weekly-controls">

        <div>
          <label htmlFor="week-selector">SELECT WEEK</label>

          <select
            id="week-selector"
            value={safeSelectedWeek}
            onChange={(event) =>
              handleWeekChange(Number(event.target.value))
            }
          >
            {weeks.map((week, index) => (
              <option key={index} value={index}>
                Week {index + 1} — {week.start_date}
                {week.data_gap ? ' (No data)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="weekly-summary">

          <div>
            <span>HOTSPOTS</span>
            <strong>
              {weekData.country?.count?.toLocaleString('en-US') ?? '—'}
            </strong>
          </div>

          <div>
            <span>ANOMALY LEVEL</span>
            <strong className={`level-${countryLevel}`}>
              {formatLevel(countryLevel)}
            </strong>
          </div>

        </div>
      </div>

      {/* INFORMACIÓN DEL MAPA */}
      <div className="map-info">

        <div className="map-source">
          <span className="status-dot"></span>
          <span>NASA FIRMS · VIIRS 375 m</span>
        </div>

        <div className="map-date">
          WEEK OF {weekData.start_date}
        </div>

      </div>

      {/* MAPA INTERACTIVO */}
      <MapContainer
        center={[-9.19, -75.015]}
        zoom={5}
        scrollWheelZoom={true}
        className="terra-map"
      >

        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {cells.map((cell) => (
          <CircleMarker
            key={`${cell.lat}-${cell.lon}`}
            center={[cell.lat, cell.lon]}
            radius={Math.min(5 + cell.count * 0.25, 13)}
            pathOptions={{
              color: getColor(cell.level),
              fillColor: getColor(cell.level),
              fillOpacity: 0.75,
              weight: 1
            }}
          >

            <Popup>
              <strong>Thermal anomaly</strong>
              <br />
              Latitude: {cell.lat}
              <br />
              Longitude: {cell.lon}
              <br />
              Detections: {cell.count}
              <br />
              FRP: {cell.frp} MW
              <br />
              Anomaly score: {cell.z}
              <br />
              Level: {formatLevel(cell.level)}
            </Popup>

          </CircleMarker>
        ))}

      </MapContainer>

      {/* AVISO DE AUSENCIA DE DATOS */}
      {weekData.data_gap && (
        <div className="data-gap-message">
          <strong>Satellite data gap</strong>
          <p>
            No reliable satellite record is available for this week.
            This does not mean there was no thermal activity.
          </p>
        </div>
      )}

      {/* LEYENDA */}
      <div className="map-legend">
        <span><i className="legend-normal"></i> Normal</span>
        <span><i className="legend-elevated"></i> Elevated</span>
        <span><i className="legend-critical"></i> Critical</span>
      </div>

      {/* GRÁFICA TEMPORAL */}
      <section className="activity-chart">

        <div className="chart-heading">

          <div>
            <p className="eyebrow">TEMPORAL ANALYSIS · 2026</p>

            <h2>
              Thermal activity <span className="highlight">over time.</span>
            </h2>

            <p>
              Weekly thermal detections recorded across Peru.
            </p>
          </div>

          {/* INDICADOR DE SEMANA SELECCIONADA */}
          <div className="chart-current">
            <span>SELECTED WEEK</span>
            <strong>W{safeSelectedWeek + 1}</strong>
            <small>{weekData.start_date}</small>
          </div>

        </div>

        <div className="chart-instructions">
          <span className="chart-dot"></span>
          Select a point to explore that week on the map.
        </div>

        <div className="chart-scroll">

          <svg
            className="activity-svg"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            role="img"
            aria-label="Weekly thermal detections across Peru during 2026"
          >

            {/* LÍNEAS HORIZONTALES Y ESCALA */}
            {[0, 1, 2, 3, 4].map((step) => {
              const y = chartTop +
                (step / 4) * (chartBottom - chartTop)

              const value = Math.round(
                maxCount * (1 - step / 4)
              )

              return (
                <g key={step}>
                  <line
                    x1={chartLeft}
                    y1={y}
                    x2={chartRight}
                    y2={y}
                    stroke="#203b55"
                    strokeWidth="1"
                    strokeDasharray="4 6"
                  />

                  <text
                    x="78"
                    y={y + 4}
                    textAnchor="end"
                    fill="#7896b2"
                    fontSize="11"
                  >
                    {value.toLocaleString('en-US')}
                  </text>
                </g>
              )
            })}

            {/* LÍNEA DE ACTIVIDAD SEMANAL */}
            {weeks.slice(1).map((week, index) => {
              const previousWeek = weeks[index]
              const currentIndex = index + 1

              if (previousWeek.data_gap || week.data_gap) {
                return null
              }

              return (
                <line
                  key={`line-${currentIndex}`}
                  x1={getX(index)}
                  y1={getY(previousWeek.country?.count ?? 0)}
                  x2={getX(currentIndex)}
                  y2={getY(week.country?.count ?? 0)}
                  stroke="#00cfff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              )
            })}

            {/* PUNTOS INTERACTIVOS */}
            {weeks.map((week, index) => {
              if (week.data_gap) return null

              const isSelected = safeSelectedWeek === index
              const count = week.country?.count ?? 0

              return (
                <g
                  key={`point-${index}`}
                  onClick={() => handleWeekChange(index)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      handleWeekChange(index)
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Week ${index + 1}, ${count} detections`}
                  style={{ cursor: 'pointer' }}
                >

                  {/* ZONA DE CLIC AMPLIADA */}
                  <circle
                    cx={getX(index)}
                    cy={getY(count)}
                    r="14"
                    fill="transparent"
                    pointerEvents="all"
                  />

                  {isSelected && (
                    <circle
                      cx={getX(index)}
                      cy={getY(count)}
                      r="8"
                      fill="#00cfff"
                      opacity="0.18"
                      pointerEvents="none"
                    />
                  )}

                  <circle
                    cx={getX(index)}
                    cy={getY(count)}
                    r={isSelected ? 4 : 2.5}
                    fill={isSelected ? '#ffffff' : '#00cfff'}
                    stroke="#00cfff"
                    strokeWidth="1.5"
                    pointerEvents="none"
                  />

                  <title>
                    Week {index + 1}: {count} detections
                  </title>

                </g>
              )
            })}

            {/* ETIQUETAS DE SEMANAS */}
            {weeks.map((week, index) => {
              if (index % 4 !== 0 && index !== weeks.length - 1) {
                return null
              }

              return (
                <text
                  key={`label-${index}`}
                  x={getX(index)}
                  y="310"
                  textAnchor="middle"
                  fill="#7896b2"
                  fontSize="11"
                >
                  W{index + 1}
                </text>
              )
            })}

            {/* EJE VERTICAL */}
            <text
              x="18"
              y={(chartTop + chartBottom) / 2}
              textAnchor="middle"
              fill="#a9c0d4"
              fontSize="12"
              letterSpacing="1"
              transform={`rotate(-90 18 ${(chartTop + chartBottom) / 2})`}
            >
              THERMAL DETECTIONS
            </text>

            {/* EJE HORIZONTAL */}
            <text
              x={(chartLeft + chartRight) / 2}
              y="355"
              textAnchor="middle"
              fill="#a9c0d4"
              fontSize="12"
              letterSpacing="1.5"
            >
              WEEKS OF 2026
            </text>

            {/* EJE INFERIOR */}
            <line
              x1={chartLeft}
              y1={chartBottom}
              x2={chartRight}
              y2={chartBottom}
              stroke="#34516c"
              strokeWidth="1"
            />

          </svg>

        </div>

        <div className="chart-footer">
          <span>WEEKLY DATA · 2026</span>
          <span>THERMAL DETECTIONS · NASA FIRMS</span>
        </div>

      </section>

    </div>
  )
}

export default MapView

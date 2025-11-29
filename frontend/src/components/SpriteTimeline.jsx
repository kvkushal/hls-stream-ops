import { useState } from 'react'

const API_URL = 'http://localhost:5000'

function SpriteTimeline({ sprites }) {
  const [selectedSprite, setSelectedSprite] = useState(null)

  if (!sprites || sprites.length === 0) {
    return null
  }

  return (
    <div className="sprite-timeline-section">
      <h3>Thumbnails Timeline</h3>
      
      <div className="sprite-strip">
        {sprites.map((sprite, index) => (
          <div 
            key={index} 
            className="sprite-thumb"
            onClick={() => setSelectedSprite(sprite)}
            onMouseEnter={(e) => {
              e.currentTarget.querySelector('.sprite-preview').style.display = 'block'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.querySelector('.sprite-preview').style.display = 'none'
            }}
          >
            <img 
              src={`${API_URL}${sprite.path}`} 
              alt={`Sprite ${index}`}
              onError={(e) => {
                e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="160" height="90"%3E%3Crect fill="%232a3142" width="160" height="90"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%235a5d6a" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E'
              }}
            />
            <div className="sprite-time">{sprite.timeCode}</div>
            
            {/* Hover preview */}
            <div className="sprite-preview">
              <img 
                src={`${API_URL}${sprite.path}`} 
                alt="Preview"
              />
            </div>
          </div>
        ))}
      </div>

      {selectedSprite && (
        <div className="sprite-modal" onClick={() => setSelectedSprite(null)}>
          <div className="sprite-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="sprite-modal-close" onClick={() => setSelectedSprite(null)}>
              ✕
            </button>
            <img src={`${API_URL}${selectedSprite.path}`} alt="Full sprite" />
            <div className="sprite-modal-info">
              <span>Time: {selectedSprite.timeCode}</span>
              <span>Captured: {new Date(selectedSprite.timestamp).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SpriteTimeline
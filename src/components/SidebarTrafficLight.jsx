import React from 'react'
import trafficLight from '../assets/ppg-trafficlight.png'

export default function SidebarTrafficLight() {
  return (
    <div className="sidebar-traffic-wrap" aria-hidden="true">
      <div className="traffic-stack">
        <div className="traffic-art">
          <img
            src={trafficLight}
            alt=""
            className="traffic-img"
            loading="lazy"
            draggable="false"
          />

          {/* Only the green lens blinks */}
          <span className="traffic-light traffic-green" />
        </div>
      </div>
    </div>
  )
}

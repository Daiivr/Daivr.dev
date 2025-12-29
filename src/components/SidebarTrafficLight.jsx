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

        {/* reflection */}
        <div className="traffic-art traffic-art-reflection" aria-hidden="true">
          <img
            src={trafficLight}
            alt=""
            className="traffic-img"
            loading="lazy"
            draggable="false"
          />
          <span className="traffic-light traffic-green" />
        </div>
      </div>
    </div>
  )
}

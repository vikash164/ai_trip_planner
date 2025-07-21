"use client";
import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the Globe component with ssr: false to disable SSR
const Globe = dynamic(() => import('react-globe.gl'), { ssr: false });

const Hero = () => {
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const [bgColor, setBgColor] = useState('rgba(0, 0, 0, 0.8)'); // Default background color

  // Update window size on component mount and when window is resized
  useEffect(() => {
    const updateWindowSize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateWindowSize();
    window.addEventListener('resize', updateWindowSize);

    return () => {
      window.removeEventListener('resize', updateWindowSize);
    };
  }, []);

  // Change background color when hovering over content
  const handleMouseEnter = () => {
    setBgColor('rgba(56, 66, 116, 0.8)');
  };

  const handleMouseLeave = () => {
    setBgColor('rgba(0, 0, 0, 0.8)');
  };

  return (
    <section style={{ display: 'flex', width: '100%', height: '100vh' }}>
      {/* Left Content */}
      <div
        style={{
          flex: 1, // Takes up the left side
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: '2rem',
          color: 'white',
          transition: 'background-color 0.5s ease', // Smooth transition for background color
          backgroundColor: bgColor,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <h1
          style={{
            fontSize: '3rem',
            fontWeight: 'bold',
            marginBottom: '1.5rem',
            color: 'lightgray',
            animation: 'fadeIn 1s ease-in-out',
          }}
        >
          AI Trip Planner
        </h1>
        <p
          style={{
            fontSize: '1.25rem',
            color: 'rgba(255, 255, 255, 0.8)',
            marginBottom: '2rem',
            animation: 'fadeIn 2s ease-in-out',
          }}
        >
          Plan your perfect trip around the globe in seconds.
        </p>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '2rem',
          }}
        >
          <i className="fas fa-globe-americas" style={{ fontSize: '2rem' }}></i>
          <p style={{ fontSize: '1rem' }}>
            Explore destinations with AI and plan your next adventure
          </p>
        </div>
        <a
          href="/ai"
          style={{
            backgroundColor: 'white',
            color: '#4F46E5',
            fontWeight: '600',
            padding: '0.75rem 2rem',
            borderRadius: '9999px',
            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)',
            textDecoration: 'none',
            transition: 'all 0.3s ease',
          }}
          onMouseOver={(e) => (e.target.style.backgroundColor = '#E5E7EB')}
          onMouseOut={(e) => (e.target.style.backgroundColor = 'white')}
        >
          Get Started
        </a>
      </div>

      {/* Right Globe */}
      {windowSize.width && windowSize.height && (
        <div
          style={{
            position: 'relative',
            width: '50%',
            height: '100%',
            overflow: 'hidden',
          }}
        >
          <Globe
            globeImageUrl="https://raw.githubusercontent.com/vasturiano/three-globe/master/example/img/earth-day.jpg"
            backgroundColor="rgba(0,0,0,0)"
            width={windowSize.width / 2}
            height={windowSize.height}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
            }}
            autoRotate={true}
            autoRotateSpeed={0.5}
            showGraticules={true} // Show latitude/longitude lines for reference
          />
        </div>
      )}
    </section>
  );
};

export default Hero;

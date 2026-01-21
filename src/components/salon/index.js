export default function SalonGrid() {
    const horizontals = [
      '/salon/salon1.png',
      '/salon/salon2.png',
      '/salon/salon3.png',
      '/salon/salon4.png',
      '/salon/salon5.png',
      '/salon/salon6.png',
      '/salon/salon7.png',
    ];
  
    const verticals = [
      '/salon/salon8.png',
      '/salon/salon9.png',
      '/salon/salon10.png',
      '/salon/salon11.png',
    ];
  
    return (
      <div className="h-screen w-screen p-4 overflow-hidden">
        <div className="h-full w-full flex flex-col gap-4">
          {/* Row 1: 4 horizontales */}
          <div className="flex-1 grid grid-cols-4 gap-4">
            {horizontals.slice(0, 4).map((src, index) => (
              <div key={index} className="relative w-full h-full">
                <img
                  src={src}
                  alt={`Salon ${index + 1}`}
                  className="w-full h-full object-contain"
                />
              </div>
            ))}
          </div>
  
          {/* Row 2: 3 horizontales */}
          <div className="flex-1 grid grid-cols-3 gap-4">
            {horizontals.slice(4, 7).map((src, index) => (
              <div key={index + 4} className="relative w-full h-full">
                <img
                  src={src}
                  alt={`Salon ${index + 5}`}
                  className="w-full h-full object-contain"
                />
              </div>
            ))}
          </div>
  
          {/* Row 3: 4 verticales */}
          <div className="flex-1 grid grid-cols-8 gap-2">
            {verticals.map((src, index) => (
              <div key={index} className="relative w-full h-full">
                <img
                  src={src}
                  alt={`Salon ${index + 8}`}
                  className="w-full h-full object-contain"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
export default function SalonGrid2({ isHovered }) {
    // Definimos el layout asimétrico: true = imagen, false = espacio vacío
    const gridLayout = [
      // Fila 1: 4 fotos (posiciones 1, 2, 4, 5 - vacíos en 3 y 6)
      true, true, false, true, false, true,
      // Fila 2: 4 fotos (posiciones 1, 3, 4, 6 - vacíos en 2 y 5)
      true, false, true, true, false, true,
      // Fila 3: 3 fotos (posiciones 2, 3, 5 - vacíos en 1, 4 y 6)
      false, true, true, false, true, false
    ];
  
    // Contador para las imágenes
    let imageCounter = 1;

    if (!isHovered) return null;

  return (
    <div className="absolute left-4 right-4 top-28 bottom-32 flex items-center pointer-events-none">
      <div className="grid grid-cols-6 gap-4 w-full h-[70vh]">
        {gridLayout.map((hasImage, index) => (
          <div
            key={index}
            className="relative bg-gray-100/50 rounded-lg overflow-hidden"
          >
            {hasImage && (
              <img
                src={`/salon/salon${imageCounter++}.png`}
                alt={`Salon ${imageCounter - 1}`}
                className="w-full h-full object-contain p-2"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
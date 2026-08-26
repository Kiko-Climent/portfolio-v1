const BrainStorm = () => {
    return (
        <div className="w-full h-full">
            <div className="w-full h-full flex items-center justify-center text-[clamp(1.0625rem,1.75vw,1.3125rem)] leading-[1]">
                {/*
                  3 columnas: nombre | cuadrado | título.
                  El segundo cuadrado vive en la columna del título, así
                  queda justo debajo de la "C" de Creative.
                */}
                <div className="grid grid-cols-[auto_auto_auto] items-center gap-x-1 gap-y-0">
                    <h1 className="whitespace-nowrap">Kiko Climent</h1>
                    <div className="w-3 h-3 border-2 border-black bg-transparent" />
                    <h2 className="whitespace-nowrap">Portfolio 2026</h2>

                    <div />
                    <div />
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 border-2 border-black bg-transparent" />
                        <h2 className="whitespace-nowrap">Creative Frontend Developer</h2>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default BrainStorm;

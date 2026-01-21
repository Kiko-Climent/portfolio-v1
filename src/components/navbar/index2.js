// Fibonaci grid layout

export default function Navbar2() {
    return (
        <div className="flex top-4 left-4 right-4 leading-[0.9] z-50 text-xl md:text-[1.35rem] lg:text-2xl absolute">
            <div className="w-[61.8%] flex flex-col">
                <h1>Kiko Climent</h1>
                <h2>Portfolio 2026</h2>
            </div>
            <div className="w-[38.2%] flex flex-col">
                <p>Fullstack web developer</p>
                <p>climent.kiko@gmail.com</p>
                <p>(+49) 176 58260660</p>
            </div>
        </div>
    )
}
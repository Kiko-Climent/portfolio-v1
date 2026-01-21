export default function Footer({ onSalonHover }) {
    return (
        <div className="flex bottom-4 left-4 right-4 z-50 text-xl absolute">
            <div className="flex w-1/2"></div>
            <div className="flex w-1/2 flex-col text-[clamp(1.25rem,2vw,1.5rem)] leading-[0.95] whitespace-nowrap">
          {[
            ["Johnny Carretes", "01"],
            ["Salon Vilarnau", "02"],
            ["Against Low Trends", "03"],
            ["Acid Discos", "04"],
            ["About", "me"],
          ].map(([title, number]) => (
            <div
              key={number}
              className="flex"
              onMouseEnter={() => number === "02" && onSalonHover(true)}
              onMouseLeave={() => number === "02" && onSalonHover(false)}
            >
              <h1 className={`w-1/2 ${number === "02" ? "cursor-pointer" : ""}`}>
                {title}
              </h1>
              <p className={`w-1/2 text-right ${number === "02" ? "cursor-pointer" : ""}`}>
                {number}
              </p>
            </div>
          ))}
        </div>
        </div>
    )
}
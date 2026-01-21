// Fibonaci grid layout

export default function Footer2() {
    return (
        <div className="flex bottom-4 left-4 right-4 z-50 text-xl md:text-[1.35rem] lg:text-2xl absolute">
            <div className="flex w-[61.8%]"></div>
            <div className="flex w-[38.2%] flex-col leading-[0.9]">
          {[
            ["Johnny Carretes", "01"],
            ["Salon Vilarnau", "02"],
            ["Against Low Trends", "03"],
            ["AllThatJazz", "04"],
            ["Acid Discos", "05"],
            ["About", "me"],
          ].map(([title, number]) => (
            <div
              key={number}
              className="flex"
            >
              <h1 className="w-[61.8%]">{title}</h1>
              <p className="w-[38.2%] text-right">{number}</p>
            </div>
          ))}
        </div>
        </div>
    )
}
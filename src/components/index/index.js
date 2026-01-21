export default function Index() {
    return (
      <div className="h-screen w-screen">
        {/* Contenedor con padding real */}
        <div className="flex flex-col justify-end h-full pr-8 pb-8 items-end text-2xl">
          {[
            ["Johnny Carretes", "01"],
            ["Salon Vilarnau", "02"],
            ["Against Low Trends", "03"],
            ["AllThatJazz", "04"],
          ].map(([title, number]) => (
            <div
              key={number}
              className="flex justify-between items-center w-[50vw]"
            >
              <h1>{title}</h1>
              <p>{number}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
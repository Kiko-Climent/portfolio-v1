/**
 * Relevo de la foto del About: del hover del footer (la tarjeta de SpeedSlider)
 * a la página (AboutPaper). Las dos pintan la misma foto en la misma caja
 * (cols 7–8 bajo el navbar, mismo encuadre), así que al hacer click la
 * tarjeta se queda hasta que el About pinta su primer fotograma con los
 * retales unidos; entonces la tarjeta se va y los retales se separan.
 *
 *  arm()        el click viene del hover del About (page.js)
 *  isArmed()    el About entra desde la foto entera en vez de con la cortina
 *  release()    el About ya pinta la foto: la tarjeta se puede ir
 *  cancel()     red de seguridad (page.js) si el About no llega a pintar
 *  onRelease()  page.js suelta la tarjeta
 *
 * gridExit: el grid del home avisa de cuándo empieza y acaba de taparse, así
 * el About espera a que acabe para separar los retales y sacar sus textos
 * (el grid y los textos ocupan la misma zona de la izquierda).
 */
let armed = false;
const listeners = new Set();

export const aboutHandoff = {
  arm() {
    armed = true;
  },
  isArmed() {
    return armed;
  },
  release() {
    if (!armed) return;
    armed = false;
    listeners.forEach((fn) => fn());
  },
  cancel() {
    armed = false;
  },
  onRelease(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

let gridHiding = false;
const gridWaiters = [];

export const gridExit = {
  start() {
    gridHiding = true;
  },
  end() {
    gridHiding = false;
    gridWaiters.splice(0).forEach((fn) => fn());
  },
  // fn cuando el grid ya está tapado (o ya mismo si no está saliendo).
  // Devuelve una función para cancelar la espera.
  after(fn) {
    if (!gridHiding) {
      fn();
      return () => {};
    }
    gridWaiters.push(fn);
    return () => {
      const i = gridWaiters.indexOf(fn);
      if (i >= 0) gridWaiters.splice(i, 1);
    };
  },
};

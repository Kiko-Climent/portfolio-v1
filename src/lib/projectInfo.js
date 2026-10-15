/**
 * Ficha de un proyecto, sacada de project.slider.text sin inventar datos: la
 * description se parte en Client (primer término), Scope (el resto) y Stack
 * (las tecnologías conocidas); Web es la url. La usan la ficha de escritorio
 * (ProjectImageSliderThreeGrid) y la hoja Info móvil (InfoSheetMobile2), así
 * enseñan siempre lo mismo. Para afinar los textos, editar las descriptions en
 * projects.js.
 */

export const TECH = {
  'next.js': 'Next.js', javascript: 'JavaScript', javascriptt: 'JavaScript', gsap: 'GSAP',
  'framer motion': 'Framer Motion', 'three.js': 'Three.js', shaders: 'Shaders', vercel: 'Vercel',
  tailwindcss: 'Tailwind CSS', 'motion ui': 'Motion UI', firebase: 'Firebase',
  responsive: 'Responsive', 'headless tech': 'Headless',
};

export const capFirst = (str) => (str ? str.charAt(0).toUpperCase() + str.slice(1) : str);

export function parseInfo(text) {
  const terms = (text?.description || '')
    .split(',')
    .map((t) => t.trim().replace(/[.,]+$/, ''))
    .filter(Boolean);
  const stack = [];
  const rest = [];
  terms.forEach((t) => {
    const tech = TECH[t.toLowerCase()];
    if (tech) {
      if (!stack.includes(tech)) stack.push(tech);
    } else rest.push(t);
  });
  return {
    client: capFirst(rest[0] || ''),
    scope: capFirst(rest.slice(1).join(', ').toLowerCase()),
    stack: stack.join(', '),
  };
}

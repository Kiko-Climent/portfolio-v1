export const projects = {
    salon: {
      id: 'salon',
      imagesPath: '/salon',
      imagesCount: 11,
      gridLayout: [
        1, 2, null, 3, 4, null,
        5, null, 6, null, 7, 8,
        null, 9, 10, null, 11, null,
      ],
      slider: {
        images: [
          { id: 1, top: '0%', left: '5%', width: '70%', page: 'Styles', view: 'desktop', path: '/styles' },
          { id: 2, top: '35%', left: '35%', width: '70%', page: 'Intro / Loader', view: 'desktop', path: '/' },
          { id: 3, top: '15%', left: '10%', width: '35%', page: 'Home Page', view: 'mobile', path: '/home' },
          { id: 4, top: '10%', left: '20%', width: '75%', page: 'Home / Opening Hours', view: 'desktop', path: '/home' },
          { id: 5, top: '5%',  left: '3%', width: '70%',   page: 'Home', view: 'desktop', path: '/home'},
          { id: 6, top: '15%', left: '10%', width: '75%', page: 'About Section', view: 'desktop', path: '/home' },
          { id: 7, top: '10%', left: '15%', width: '75%', page: 'Hero Section', view: 'desktop', path: '/home' },
          { id: 8, top: '10%', left: '5%', width: '35%',  page: 'Home Page', view: 'desktop', path: '/home' },
          { id: 9, top: '20%', left: '25%', width: '25%', page: 'Styles', view: 'mobile', path: '/styles' },
          { id: 10, top: '0%', left: '45%', width: '35%', page: 'Home / Staff', view: 'desktop', path: '/home' },
          { id: 11, top: '15%', left: '30%', width: '30%', page: 'Footer', view: 'mobile', path: '/home' }
        ],
        text: {
          title: 'vilarnau.de',
          url: 'https://www.vilarnau.de/',
          description: 'Hair salon, Web & Interaction, Clean Layout, Fast Motion, Editorial Design, Minimal Storytelling, Layered UI, Fluid Scroll, Modern Typography, Headless Tech, Next.js, JavaScript, GSAP, Framer Motion, Vercel, TailwindCSS, Motion UI, Responsive.'
        }
      },
      hover: {
        images: [
          { id: 1, width: '75%' },
          { id: 2, width: '75%' },
          { id: 3, width: '35%' },
          { id: 4, width: '75%' },
          { id: 5, width: '75%' },
          { id: 6, width: '75%' },
          { id: 7, width: '75%' },
          { id: 8, width: '75%' },
          { id: 9, width: '35%' },
          { id: 10, width: '75%' },
          { id: 11, width: '35%' }
        ]
      }
    },
    johnny: {
      id: 'johnny',
      imagesPath: '/johnny',
      imagesCount: 13,
      gridLayout: [null, null, 1, null, null, 2,
        null, 3, null, 4, null, null,
        6, { type: 'video', src: '/motion/promojohnny.mp4' }, null, 5, null, 7,
      ],
      slider: {
        images: [
          { id: 1, top: '25%', left: '5%', width: '75%', page: 'Hero Section', view: 'Desktop', path: '/' },
          { id: 2, top: '10%', left: '20%', width: '70%', page: 'Works Menu', view: 'Desktop', path: '/work' },
          { id: 3, top: '30%', left: '10%', width: '75%', page: 'Photo Detail', view: 'Desktop', path: '/work/johnny_de_noche' },
          { id: 4, top: '25%', left: '15%', width: '65%', page: 'Canvas, Detail', view: 'Desktop', path: '/canvas' },
          { id: 5, top: '5%', left: '32.5%', width: '65%', page: 'Orbital', view: 'Desktop', path: '/orbital' },
          { id: 6, top: '2%', left: '5%', width: '27%', page: 'Canvas, Detail', view: 'Mobile', path: '/canvas' },
          { id: 7, top: '7%', left: '50%', width: '27%', page: 'Canvas', view: 'Mobile', path: '/canvas' },
          { id: 8, top: '39%', left: '20%', width: '75%', page: 'Photo Detail', view: 'Desktop', path: '/work/leak_of_dreams'},
          { id: 9, top: '25%', left: '38%', width: '27%', page: 'Hero Section', view: 'Mobile', path: '/' },
          { id: 10, top: '15%', left: '30%', width: '40%', page: 'Works Menu', view: 'Tablet', path: '/work' },
          { id: 11, top: '2%', left: '55%', width: '27%', page: 'Orbital', view: 'Mobile', path: '/orbital' },
          { id: 12, top: '8%', left: '15%', width: '27%', page: 'Works Menu', view: 'Mobile', path: '/work' },
          { id: 13, top: '19%', left: '70%', width: '27%', page: 'Photo Detail', view: 'Mobile', path: '/work/johnny_de_noche' },
        ],
        text: {
          title: 'johnnycarretes.com',
          url: 'https://www.johnnycarretes.com/',
          description: 'analog photography, portfolio, immersive experience, infinite canvas, 3D, creative, web aesthetic, brutalist design, strong immagery, editorial, Next.js, JavaScript, GSAP, Framer Motion, Three.js, Shaders, Vercel, TailwindCSS, Motion UI, Responsive.'
        }
      },
      hover: {
        images: [
          { id: 1, width: '75%' },
          { id: 2, width: '75%' },
          { id: 3, width: '75%' },
          { id: 4, width: '75%' },
          { id: 5, width: '75%' },
          { id: 6, width: '35%' },
          { id: 7, width: '35%' },
          { id: 8, width: '75%' },
          { id: 9, width: '35%' },
          { id: 10, width: '40%' },
          { id: 11, width: '35%' },
          { id: 12, width: '35%' },
          { id: 13, width: '35%' },
        ]
      }
    },
    alt: {
      id: 'alt',
      imagesPath: '/alt',
      imagesCount: 7,
      gridLayout: [],
      slider: {
        images: [
          { id: 9, top: '23%', left: '17%', width: '70%', page: 'Hero, Roster', view: 'Desktop', path: '/home' },
          { id: 10, top: '3%', left: '20%', width: '75%', page: 'Hero, Roster (Hovered)', view: 'Desktop', path: '/home' },
          { id: 11, top: '10%', left: '5%', width: '35%', page: 'Hero, Roster', view: 'Mobile', path: '/home' },
          { id: 12, top: '5%', left: '10%', width: '70%', page: 'Artist, Detail', view: 'Desktop', path: '/artist/pyramidal_decode/' },
          { id: 13, top: '15%', left: '30%', width: '35%', page: 'Artist Page', view: 'Mobile', path: '/artist/unkle_fon' },
          { id: 14, top: '15%', left: '30%', width: '35%', page: 'About Page', view: 'Desktop', path: '/about/' },
          { id: 15, top: '30%', left: '5%', width: '75%', page: 'Contact Page', view: 'Desktop', path: '/contact' },
        ],
        text: {
          title: 'againstlt.com',
          url: 'https://againstlt.com/',
          description: 'booking agency, dj, techno, dark, underground, big typography, Next.js, Firebase, Javascriptt, Framer Motion, TailwindCss, Responsive,'
        }
      },
      hover: {
        images: [
          { id: 9, width: '75%' },
          { id: 10, width: '75%' },
          { id: 11, width: '35%' },
          { id: 12, width: '75%' },
          { id: 13, width: '35%' },
          { id: 14, width: '75%' },
          { id: 15, width: '75%' },
        ]
      }
    },
    mmdiscos: {
      id: 'mmdiscos',
      imagesPath: '/mmdiscos',
      imagesCount: 9,
      gridLayout: [],
      slider: {
        images: [
          { id: 1, top: '5%', left: '25%', width: '70%', page: 'Releases / Slider', view: 'Desktop', path: '/releases' },
          { id: 2, top: '15%', left: '5%', width: '70%', page: 'Releases, Detail', view: 'Desktop', path: '/releases' },
          { id: 3, top: '10%', left: '20%', width: '27%', page: 'Home Page, Highlights', view: 'Mobile', path: '/' },
          { id: 4, top: '30%', left: '28%', width: '70%', page: 'Home Page, Highlights', view: 'Desktop', path: '/' },
          { id: 5, top: '20%', left: '10%', width: '75%', page: 'Releases / Index, Detail', view: 'Desktop', path: '/releases' },
          { id: 6, top: '22%', left: '5%', width: '27%', page: 'Releases / Index, Detail', view: 'Mobile', path: '/releases' },
          { id: 7, top: '8%', left: '35%', width: '27%', page: 'Home, Footer', view: 'Mobile', path: '/' },
          { id: 8, top: '18%', left: '22%', width: '70%', page: 'Home, Footer', view: 'Desktop', path: '/' },
          { id: 9, top: '22%', left: '5%', width: '27%', page: 'Hero', view: 'Desktop', path: '/' }
        ],
        text: {
          title: 'mmdiscos.com',
          url: 'https://mmdiscos.com/',
          description: 'record label, underground, balearic, white space, minimalism, swiss editorial design, Next.js, gsap, three.js, shaders, javascript, vercel, tailwindcss, responsive'
        }
      },
      hover: {
        images: [
          { id: 1, width: '75%' },
          { id: 2, width: '75%' },
          { id: 3, width: '35%' },
          { id: 4, width: '75%' },
          { id: 5, width: '75%' },
          { id: 6, width: '35%' },
          { id: 7, width: '35%' },
          { id: 8, width: '75%' },
          { id: 9, width: '75%' },
        ]
      }
    },
    about: {
      id: 'about',
      imagesPath: '/about',
      imagesCount: 1,
      gridLayout: [],
      slider: {
        images: [
          { id: 1, top: '15%', left: '30%', width: '40%' },
        ],
        text: {
          title: 'about',
          description: 'full-stack web developer focused on the front-end, blending code and creativity to craft immersive digital experiences. As a creative coder, I love pushing interfaces through motion, interaction, and 3D, working mainly with GSAP, Three.js, and WebGL. I\'m part of AllThatJazz, a graphic and digital creation atelier, where I explore experimental design and creative development. When I\'m not coding, you\'ll find me following football or basketball, listening to music, or diving into sci-fi films. My work is heavily inspired by brutalism, minimalism, Asian culture, and the raw aesthetics of the 90s.'
        }
      },
      hover: {
        images: [
          { id: 1, width: '40%' },
        ]
      }
    }
  };
  
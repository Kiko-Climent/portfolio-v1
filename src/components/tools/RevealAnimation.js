"use client";

import { useRef, useEffect } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function RevealImage({ src, alt = "", origin = "left" }) {
  const imgRef = useRef(null);

  useEffect(() => {
    if (!imgRef.current) return;
    const el = imgRef.current;
  
    gsap.set(el, {
      scale: 0,
      transformOrigin: origin === "left" ? "0% 50%" : "100% 50%",
      willChange: "transform",
    });
  
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: el,
        start: "top 80%",   // cuando el top entra al 80% de viewport
        toggleActions: "play none none reverse", // se reproduce al entrar
      },
    });
  
    tl.to(el, {
      scale: 1,
      duration: 1,
      ease: "power3.out",
    });
  
    return () => {
      tl.kill();
    };
  }, [origin]);
  

  return (
    <div
      ref={imgRef}
      className="reveal-img relative w-full h-[60vh] overflow-hidden will-change-transform"
    >
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover backface-hidden transform-gpu"
      />
    </div>
  );
}

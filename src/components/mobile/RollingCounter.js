'use client';

/**
 * Contador rodante "03 / 13" del detalle móvil. Cada dígito es una columna
 * 0–9 (dos vueltas, para pasar de 9 a 0 hacia delante) que se desplaza en
 * proporción al progreso continuo del slider (sliderBus 'progress'): a mitad
 * de camino entre la 3 y la 4 se ve el 3 medio subido.
 * Como el papel ya no hace snap, al quedarse quieto entre dos imágenes es el
 * contador el que se asienta solo en el número de la imagen más cercana al ancla.
 * Escribe el transform directamente en el DOM, sin re-renders. El total queda fijo.
 */

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { sliderBus } from '@/lib/sliderBus';
import { pad2 } from '@/components/data/grid';

const CELLS = Array.from({ length: 20 }, (_, i) => i % 10);
const digitAt = (n, place) => Math.floor(n / place) % 10;
// Sin progreso nuevo durante esto, el contador se asienta en el número más cercano.
const SETTLE_IDLE_MS = 160;
const SETTLE = { duration: 0.6, ease: 'power3.out' };

export default function RollingCounter({ total }) {
    const tensRef = useRef(null);
    const onesRef = useRef(null);
    const labelRef = useRef(null);

    useEffect(() => {
        let lastRounded = -1;
        let count = 0;
        let settleTimer = null;
        let settleTween = null;
        const shown = { value: 0 };

        const paint = (value) => {
            if (!count) return;
            const base = Math.floor(value);
            const frac = value - base;
            const a = (((base % count) + count) % count) + 1;
            const b = (((base + 1) % count + count) % count) + 1;
            [
                [tensRef.current, 10],
                [onesRef.current, 1],
            ].forEach(([el, place]) => {
                if (!el) return;
                const da = digitAt(a, place);
                const db = digitAt(b, place);
                // Cada dígito rueda por el camino corto (hacia delante o hacia
                // atrás). Antes siempre rodaba hacia delante: al dar la vuelta
                // (13 → 01) las decenas pasaban 1 → 2 … 9 → 0.
                let delta = db - da;
                if (delta > 5) delta -= 10;
                else if (delta < -5) delta += 10;
                let pos = da + delta * frac;
                // La columna tiene dos vueltas (0–9, 0–9): si el camino baja de 0, se usa la segunda.
                if (da + Math.min(0, delta) < 0) pos += 10;
                el.style.transform = `translate3d(0, ${-pos}em, 0)`;
            });
            const rounded = frac < 0.5 ? a : b;
            if (rounded !== lastRounded && labelRef.current) {
                lastRounded = rounded;
                labelRef.current.setAttribute('aria-label', `Image ${pad2(rounded)} of ${pad2(count)}`);
            }
        };

        const settle = () => {
            const target = Math.round(shown.value);
            if (Math.abs(target - shown.value) < 1e-3) return;
            const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            settleTween = gsap.to(shown, {
                value: target,
                duration: reduceMotion ? 0 : SETTLE.duration,
                ease: SETTLE.ease,
                onUpdate: () => paint(shown.value),
            });
        };

        const off = sliderBus.on('progress', ({ value, count: c }) => {
            if (!c) return;
            count = c;
            settleTween?.kill();
            // Sigue al papel por el camino corto, aunque el progreso dé la vuelta (13 → 01).
            let next = value;
            const delta = next - (shown.value % count);
            if (delta > count / 2) next -= count;
            else if (delta < -count / 2) next += count;
            shown.value = Math.floor(shown.value / count) * count + next;
            paint(shown.value);
            clearTimeout(settleTimer);
            settleTimer = setTimeout(settle, SETTLE_IDLE_MS);
        });

        return () => {
            off();
            clearTimeout(settleTimer);
            settleTween?.kill();
        };
    }, []);

    const column = (ref) => (
        <span className="inline-block overflow-hidden" style={{ height: '1em', lineHeight: '1em' }} aria-hidden="true">
            <span ref={ref} className="flex flex-col will-change-transform">
                {CELLS.map((d, i) => (
                    <span key={i} style={{ height: '1em', lineHeight: '1em' }}>
                        {d}
                    </span>
                ))}
            </span>
        </span>
    );

    return (
        <span ref={labelRef} className="inline-flex items-end tabular-nums" role="status">
            {column(tensRef)}
            {column(onesRef)}
            <span aria-hidden="true" style={{ lineHeight: '1em' }}>
                &nbsp;/ {pad2(total)}
            </span>
        </span>
    );
}

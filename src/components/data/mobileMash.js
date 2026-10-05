import { projects } from '@/components/data/projects';
import { mediaKey } from '@/lib/media';

const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

const buildMashedImages = () => {
    const perProject = Object.values(projects)
        .filter((project) => project.id !== 'about' && project.slider?.images?.length)
        .map((project) => ({
            projectId: project.id,
            images: shuffleArray(
                project.slider.images.map((image) => ({
                    id: image.id,
                    key: mediaKey(project, image.id),
                }))
            ),
        }));

    const mashed = [];
    let previousProjectId = null;

    while (perProject.some((group) => group.images.length)) {
        const candidates = perProject.filter(
            (group) => group.images.length && group.projectId !== previousProjectId
        );
        const available = candidates.length
            ? candidates
            : perProject.filter((group) => group.images.length);
        const selected = available[Math.floor(Math.random() * available.length)];

        mashed.push(selected.images.pop());
        previousProjectId = selected.projectId;
    }

    return mashed;
};

let mash = null;

// El orden aleatorio se calcula una vez por visita: la precarga de la intro y el
// fondo 3D comparten así las mismas imágenes, y al volver de un proyecto el
// fondo se monta con texturas que ya están en caché.
export function getMobileMash() {
    if (!mash) mash = buildMashedImages();
    return mash;
}

// Slides que SliderThree3Mobile (variant "mash") pide nada más montarse: los que
// caen dentro de su loadRange (8) con slides de 2.15 de alto → los índices 0-3 y
// los 3 últimos (el carrusel es circular).
export function getInitialMashKeys() {
    const items = getMobileMash();
    const n = items.length;
    const indices = [0, 1, 2, 3, n - 3, n - 2, n - 1].filter((i) => i >= 0 && i < n);
    return [...new Set(indices)].map((i) => items[i].key);
}

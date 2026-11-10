// Las 3 carreras y qué elemento 3D usa cada una en cada modo.
export const CAREERS = [
  {
    id: 'software',
    name: 'Ingeniería de Software',
    short: 'Software',
    emoji: '💻',
    color: '#4cc9f0',
    world: 'Laptop con código',
    face: 'Gafas + holograma </>',
  },
  {
    id: 'medicina',
    name: 'Medicina',
    short: 'Medicina',
    emoji: '🩺',
    color: '#ef476f',
    world: 'Corazón latiendo',
    face: 'Espejo frontal + estetoscopio',
  },
  {
    id: 'civil',
    name: 'Ingeniería Civil',
    short: 'Civil',
    emoji: '🏗️',
    color: '#ffb703',
    world: 'Grúa torre',
    face: 'Casco de obra',
  },
];

export const careerById = (id) => CAREERS.find((c) => c.id === id) ?? CAREERS[0];
